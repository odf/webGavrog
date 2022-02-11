import * as csp from 'plexus-csp';

import * as pickler from '../common/pickler';
import * as version from '../version';
import * as builtin from './builtinStructures';
import * as displayList from './displayList';
import * as fileIO from './fileIO';
import * as makeScene from './makeScene';

import parseDSymbols from '../io/ds';
import Worker from './sceneWorker';
import { Elm } from '../elm/GuiMain';
import { makeGraph } from '../pgraphs/periodic';


const createWorker = log => {
  let lastId = 0;
  const callbacks = {};
  const worker = new Worker();

  worker.onmessage = event => {
    const { id, output, status } = pickler.unpickle(event.data);

    if (status == 'success') {
      callbacks[id](null, output);
      delete callbacks[id];
    }
    else if (status == 'error') {
      callbacks[id](output);
      delete callbacks[id];
    }
    else {
      log(output == null ? '' : '' + output);
    }
  };

  return (input, cb) => {
    const id = ++lastId;
    callbacks[id] = cb;
    worker.postMessage(pickler.pickle({ id, input }));
  };
};


const title = model => {
  if (model.structures && model.index != null) {
    const s = model.structures[model.index];
    const mod = (s.type == 'tiling') && model.options.tilingModifier;
    const ext = mod == 'dual' ? '-d' : mod == 't-analog' ? '-t' : '';
    const name = (s.name || 'unnamed') + ext;

    const fname = model.filename;
    const index = model.index + 1;
    const len = model.structures.length;
    const collection = (
      fname == null ? 'builtin' : fname == "URL" ? '' : `"${fname}"`
    );
    const groupName = model.data.sgInfo.groupName;
    return `#${index}/${len} - ${name} (${collection}) ${groupName}`;
  }
  else
    return '';
};


const gotoStructure = (config, model, i) => csp.go(function* () {
  const structures = model.structures;
  const n = structures.length;
  const index = i < 0 ? n + i % n : i % n;

  let newModel = model;

  try {
    if (structures[index].isRaw) {
      yield config.log('Converting structure data...');
      structures[index] = yield config.worker({
        cmd: 'processCGD',
        val: structures[index]
      });
    }

    const data = yield makeScene.preprocess(
      structures[index], model.options, config.worker, config.log
    );
    data.displayList = yield makeScene.makeDisplayList(
      data, model.options, config.worker, config.log
    );
    const scene = yield makeScene.makeScene(
      data, model.options, config.worker, config.log
    );

    newModel = Object.assign({}, model, { structures, index, data, scene });

    yield config.sendScene(scene, data.dim, true);
    yield config.sendTitle(title(newModel));
  }
  catch (ex) {
    console.error(ex);
    yield config.log(`ERROR processing structure ${index + 1}!!!`);

    newModel = Object.assign({}, model, { index });
  }

  return newModel;
});


const fieldChanged = (key, newObj, oldObj) =>
  newObj[key] != null && newObj[key] != oldObj[key];


const updateStructure = (config, model, options) => csp.go(function* () {
  try {
    const dim = model.data.dim;

    const changedMod =
      model.data.type == 'tiling' &&
      fieldChanged('tilingModifier', options, model.options);

    const changedMeshes =
      fieldChanged('showUnitCell', options, model.options) ||
      fieldChanged('netVertexRadius', options, model.options) ||
      fieldChanged('netEdgeRadius', options, model.options) ||
      fieldChanged('edgeWidth2d', options, model.options) ||
      fieldChanged('edgeWidth', options, model.options) ||
      fieldChanged('extraSmooth', options, model.options) ||
      fieldChanged('skipRelaxation', options, model.options);

    options = Object.assign({}, model.options, options);
    model = Object.assign({}, model, { options });

    if (changedMod)
      return yield gotoStructure(config, model, model.index);
    else {
      const scene = yield makeScene.makeScene(
        model.data, model.options, config.worker, config.log
      );

      if (changedMeshes)
        yield config.sendScene(scene, model.data.dim, false);
      else
        yield config.sendInstances(scene, model.data.dim, false);

      return Object.assign({}, model, { scene });
    }
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR updating structure!!!`);
    return model;
  }
});


const tweakScene = (config, model, selected, tweakFn) => csp.go(function* () {
  try {
    const selection = [];
    for (const { meshIndex, instanceIndex } of selected) {
      const instances = model.scene.instances.filter(
        inst => inst.meshIndex == meshIndex
      );
      selection.push(instances[instanceIndex]);
    }

    const displayList = tweakFn(model.data.displayList, selection);
    const data = Object.assign({}, model.data, { displayList });

    const scene = yield makeScene.makeScene(
      data, model.options, config.worker, config.log
    );

    yield config.sendInstances(scene, model.data.dim, false);

    return Object.assign({}, model, { data, scene });
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR updating scene!!!`);
    return model;
  }
});


const freshDisplayList = (config, model, options) => csp.go(function* () {
  try {
    options = Object.assign({}, model.options, options);
    model = Object.assign({}, model, { options });

    const displayList = yield makeScene.makeDisplayList(
      model.data, model.options, config.worker, config.log
    );
    const data = Object.assign({}, model.data, { displayList });

    const scene = yield makeScene.makeScene(
      data, model.options, config.worker, config.log
    );

    yield config.sendInstances(scene, model.data.dim, false);

    return Object.assign({}, model, { scene, data });
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR updating scene!!!`);
    return model;
  }
});


const newFile = (config, model, { file, data }) => csp.go(function* () {
  try {
    const filename = file.name;
    let structures = [];

    if (filename.match(/\.(ds|tgs)$/)) {
      yield config.log('Parsing .ds data...');
      structures = Array.from(parseDSymbols(data));
    }
    else if (filename.match(/\.(cgd|pgr)$/)) {
      yield config.log('Parsing .cgd data...');
      structures = yield config.worker({ cmd: 'parseCGD', val: data });
    }

    const newModel =
      Object.assign({}, model, { filename, structures, index: null });

    yield config.sendTitle(title(newModel));
    return yield gotoStructure(config, newModel, 0);
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR loading from file "${file.name}"!!!`);
  }
});


const createInitialModel = () => {
  const parsedUrl = new URL(window.location.href);
  const params = parsedUrl.searchParams;
  const key = params.get("key");

  if (key == null)
    return { options: {}, structures: builtin.structures };
  else {
    const name = params.get("name");
    const ns = key.split("_").map(s => parseInt(s))
    const dim = ns[0];

    const edges = [];
    for (var i = 1; i < ns.length; i += dim + 2) {
      edges.push([ns[i], ns[i + 1], ns.slice(i + 2, i + 2 + dim)])
    }
    const graph = makeGraph(edges);
    const structures = [{
      name, graph, type: 'periodic_graph', warnings: [], errors: []
    }];

    return { filename: "URL", options: {}, structures }
  }
}


const dispatch = (config, model, action, selected, options, arg) => {
  const update = m => csp.go(function* () { Object.assign(model, yield m); });
  const setStructure = i => update(gotoStructure(config, model, i));
  const modifyScene = fn => update(tweakScene(config, model, selected, fn));

  switch (action) {
    case 'Open...':
      config.loadFile(item => update(newFile(config, model, item)));
      break;
    case 'Save Structure...':
      fileIO.saveStructure(config, model);
      break;
    case 'Save Screenshot...':
      fileIO.saveScreenshot(config, options);
      break;
    case 'Save Scene As OBJ...':
      fileIO.saveSceneOBJ(config, model);
      break;
    case 'First':
      setStructure(0);
      break;
    case 'Prev':
      setStructure(model.index - 1);
      break;
    case 'Next':
      setStructure(model.index + 1);
      break;
    case 'Last':
      setStructure(-1);
      break;
    case 'Add Tile(s)':
      modifyScene(displayList.addTiles);
      break;
    case 'Add Corona(s)':
      modifyScene(displayList.addCoronas);
      break;
    case 'Restore Tile(s)':
      modifyScene(displayList.restoreTiles);
      break;
    case 'Remove Tile(s)':
      modifyScene(displayList.removeTiles);
      break;
    case 'Remove Tile Class(es)':
      modifyScene(displayList.removeTileClasses(model.data.tiles || []));
      break;
    case 'Remove Element(s)':
      modifyScene(displayList.removeElements);
      break;
    case 'Fresh Display List':
      update(freshDisplayList(config, model, options));
      break;
    case 'Jump':
      setStructure(arg);
      break;
    case 'Set Options':
      update(updateStructure(config, model, options));
      break;
  }
};


const render = domNode => {
  const model = createInitialModel();

  const app = Elm.GuiMain.init({
    node: domNode,
    flags: { revision: version.gitRev, timestamp: version.gitDate }
  });

  const log = text => app.ports.fromJS.send({ log: text });

  const config = {
    loadFile: fileIO.fileLoader(),
    saveFile: fileIO.fileSaver(),
    log,
    worker: csp.nbind(createWorker(log), null),
    sendTitle: text => app.ports.fromJS.send({ title: text }),
    sendScene: ({ meshes, instances }, dim, reset) => {
      app.ports.fromJS.send({ meshes, instances, dim, reset })
    },
    sendInstances: ({ instances }, dim, reset) => {
      app.ports.fromJS.send({ instances, dim, reset })
    }
  };

  app.ports.toJS.subscribe(({ mode, text, options, selected }) => {
    switch (mode) {
      case 'action':
        dispatch(config, model, text, selected, options);
        break;
      case 'options':
        dispatch(config, model, 'Set Options', selected, options);
        break;
      case 'jump':
        const number = parseInt(text);
        if (!Number.isNaN(number)) {
          const i = number - (number > 0);
          dispatch(config, model, 'Jump', selected, options, i);
        }
        break;
      case 'search':
        if (text) {
          const pattern = new RegExp(`^${text}$`, 'i');
          const i = model.structures.findIndex(s => !!pattern.exec(s.name));

          if (i >= 0)
            dispatch(config, model, 'Jump', selected, options, i);
          else
            config.log(`Name "${text}" not found.`);
        }
        break;
    }
  });

  dispatch(config, model, 'First');
};


render(Document.body);
