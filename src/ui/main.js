import * as csp from 'plexus-csp';

import * as pickler from '../common/pickler';
import * as version from '../version';
import parseDSymbols from '../io/ds';

import { structures } from './builtinStructures';
import * as makeScene from './makeScene';

import { Elm } from '../elm/GuiMain';

import { floatMatrices } from '../arithmetic/types';
const ops = floatMatrices;

import Worker from './sceneWorker';

const create = () => {
  let   lastId    = 0;
  const callbacks = {};
  const worker    = new Worker();

  worker.onmessage = event => {
    const { id, output, ok } = pickler.unpickle(event.data);
    const cb = callbacks[id];

    if (cb) {
      if (ok)
        cb(null, output);
      else
        cb(output);
    }

    delete callbacks[id];
  };

  return (input, cb) => {
    const id = ++lastId;
    callbacks[id] = cb || null;
    worker.postMessage(pickler.pickle({ id, input }));
  };
};

const callWorker = csp.nbind(create(), null);


const fileLoader = (accept, multiple=false, binary=false) => {
  const input = document.createElement('input');
  let callback = () => {};

  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;

  input.addEventListener('change', event => {
    const files = event.target.files;

    for (let i = 0; i < files.length; ++i) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = event => callback({ file, data: event.target.result });

      if (binary)
        reader.readAsDataURL(file);
      else
        reader.readAsText(file);
    }
  });

  return (onData) => {
    callback = onData;
    input.click();
  };
};


const fileSaver = () => {
  const link = document.createElement('a');

  link.style.display = 'none';
  document.body.appendChild(link);

  return (blob, filename) => {
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
  }
};


const structureName = model => {
  const s = model.structures[model.index];

  let ext = '';
  if (s.type == 'tiling') {
    if (model.options.tilingModifier == 'dual')
      ext = '-d';
    else if (model.options.tilingModifier == 't-analog')
      ext = '-t';
  }

  return (s.name || 'unnamed') + ext;
};


const title = model => {
  if (model.structures && model.index != null) {
    const fname = model.filename;
    const index = model.index + 1;
    const len = model.structures.length;
    const name = structureName(model);
    const collection = fname ? `"${fname}"` : 'builtin';
    const groupName = model.data.sgInfo.groupName;
    return `#${index}/${len} - ${name} (${collection}) ${groupName}`;
  }
  else
    return '';
};


const toStructure = (config, model, i) => csp.go(function*() {
  const structures = model.structures;
  const n = structures.length;
  const index = i < 0 ? n + i % n : i % n;

  let newModel = model;

  try {
    if (structures[index].isRaw) {
      yield config.log('Converting structure data...');
      structures[index] = yield callWorker({
        cmd: 'processCGD',
        val: structures[index]
      });
    }

    const data = yield makeScene.preprocess(
      structures[index], model.options, callWorker, config.log
    );
    const scene = yield makeScene.makeScene(
      data, model.options, callWorker, config.log
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


const updateStructure = (config, model) => csp.go(function*() {
  try {
    const scene = yield makeScene.makeScene(
      model.data, model.options, callWorker, config.log
    );

    yield config.sendScene(scene, model.data.dim, false);
    return Object.assign({}, model, { scene } );
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR updating structure!!!`);
    return model;
  }
});


const convertSelection = (scene, selected) => {
  const inSelection = scene.meshes.map(_ => ({}));
  for (const { meshIndex, instanceIndex } of selected)
    inSelection[meshIndex][instanceIndex] = true;

  const indexedInstances = scene.instances.map((inst, i) => [inst, i]);
  const globalIndices = [];

  for (let i = 0; i < scene.meshes.length; ++i) {
    const instancesForMesh = indexedInstances.filter(
      ([{ meshIndex }, k]) => meshIndex == i);

    for (let j = 0; j < instancesForMesh.length; ++j) {
      if (inSelection[i][j])
        globalIndices.push(instancesForMesh[j][1]);
    }
  }

  return globalIndices;
};


const updateDisplayList = (config, model, selected, update) => csp.go(
  function*() {
    try {
      const currentDisplayList = model.data.displayList.slice();
      const selection = convertSelection(model.scene, selected)
            .map(k => model.scene.instances[k])
      const displayList = update(currentDisplayList, selection);

      const data = Object.assign({}, model.data, { displayList });
      const scene = yield makeScene.makeScene(
        data, model.options, callWorker, config.log
      );

      yield config.sendScene(scene, model.data.dim, false);

      return Object.assign({}, model, { data, scene });
    } catch (ex) {
      console.error(ex);
      yield config.log(`ERROR updating scene!!!`);
      return model;
    }
  }
);


const freshDisplayList = (config, model, options) => csp.go(
  function*() {
    try {
      const displayList = yield makeScene.makeDisplayList(
        model.data, options, callWorker, config.log
      );

      const data = Object.assign({}, model.data, { displayList });
      const scene = yield makeScene.makeScene(
        data, model.options, callWorker, config.log
      );

      yield config.sendScene(scene, model.data.dim, false);

      const newOptions = Object.assign({}, model.options, options);
      return Object.assign({}, model, { data, scene, options: newOptions });
    } catch (ex) {
      console.error(ex);
      yield config.log(`ERROR updating scene!!!`);
      return model;
    }
  }
);


const newFile = (config, model, { file, data }) => csp.go(function*() {
  try {
    const filename = file.name;
    let structures = [];

    if (filename.match(/\.(ds|tgs)$/)) {
      yield config.log('Parsing .ds data...');
      structures = Array.from(parseDSymbols(data));
    }
    else if (filename.match(/\.(cgd|pgr)$/)) {
      yield config.log('Parsing .cgd data...');
      structures = yield callWorker({ cmd: 'parseCGD', val: data });
    }

    const newModel =
          Object.assign({}, model, { filename, structures, index: null });

    yield config.sendTitle(title(newModel));
    return yield toStructure(config, newModel, 0);
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR loading from file "${file.name}"!!!`);
  }
});


const saveStructure = (config, model) => {
  const structure = model.structures[model.index];

  if (structure.type == 'tiling') {
    const text = structure.symbol.toString();
    const blob = new Blob([text], { type: 'text/plain' });
    config.saveFile(blob, 'gavrog.ds');
  }
  else
    config.log(`ERROR: not yet implemented for '${structure.type}'`);
};


const saveScreenshot = (config, options) => {
  const srcCanvas = document.getElementById('main-3d-canvas');

  if (srcCanvas) {
    window.requestAnimationFrame(() => {
      const canvas = document.createElement("canvas");
      canvas.width = srcCanvas.width;
      canvas.height = srcCanvas.height;

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = options.backgroundColor;
      ctx.fillRect(0, 0, srcCanvas.width, srcCanvas.height);
      ctx.drawImage(srcCanvas, 0, 0);

      if (canvas.toBlob)
        canvas.toBlob(blob => config.saveFile(blob, 'gavrog.png'));
      else {
        const binStr = atob(canvas.toDataURL().split(',')[1]);

        const len = binStr.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++ )
          arr[i] = binStr.charCodeAt(i);

        const blob = new Blob([arr], { type: 'image/png' });
        config.saveFile(blob, 'gavrog.png');
      }

      config.log('Screenshot taken.');
    });
  }
  else
    config.log('ERROR: could not save screenshot - no canvas element found');
};


const saveSceneOBJ = (config, model) => {
  const { meshes, instances } = model.scene;

  const lines = [];
  let offset = 1;

  for (const { meshIndex, transform } of instances) {
    const { basis, shift } = transform;
    const mesh = meshes[meshIndex];

    for (const v of mesh.vertices) {
      const pos = ops.plus(ops.times(v.pos, basis), shift);
      lines.push('v ' + pos.join(' '));
    }

    for (const v of mesh.vertices) {
      const normal = ops.times(v.normal, basis);
      lines.push('vn ' + normal.join(' '));
    }

    for (const f of mesh.faces) {
      const vs = f.map(v => v + offset);
      lines.push('f ' + vs.map(v => `${v}//${v}`).join(' '));
    }

    offset += mesh.vertices.length;
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  config.saveFile(blob, 'gavrog.obj');
};


const render = domNode => {
  const model = { options: {}, structures };

  const app = Elm.GuiMain.init({
    node: domNode,
    flags: {
      revision: version.gitRev,
      timestamp: version.gitDate
    }});

  const config = {
    loadFile: fileLoader(),
    saveFile: fileSaver(),
    log: text => app.ports.fromJS.send({ log: text }),
    sendTitle: text => app.ports.fromJS.send({ title: text }),
    sendScene: (scene, dim, reset) =>
      app.ports.fromJS.send({ scene, dim, reset })
  };

  const updateModel = deferred => csp.go(function*() {
    Object.assign(model, yield deferred);
  });

  const openFile = () => config.loadFile(
    ({ file, data }) => updateModel(newFile(config, model, { file, data })));

  const setStructure = i => updateModel(toStructure(config, model, i));

  const action = {
    ['Open...']: openFile,
    ['Save Structure...']: () => saveStructure(config, model),
    ['Save Screenshot...']: (selected, options) =>
      saveScreenshot(config, options),
    ['Save Scene As OBJ...']: () => saveSceneOBJ(config, model),
    ['First']: () => setStructure(0),
    ['Prev']: () => setStructure(model.index - 1),
    ['Next']: () => setStructure(model.index + 1),
    ['Last']: () => setStructure(-1),
    ['Add Tile(s)']: (selected) => updateModel(updateDisplayList(
      config, model, selected, makeScene.addTiles
    )),
    ['Add Corona(s)']: (selected) => updateModel(updateDisplayList(
      config, model, selected, makeScene.addCoronas
    )),
    ['Restore Tile(s)']: (selected) => updateModel(updateDisplayList(
      config, model, selected, makeScene.restoreTiles
    )),
    ['Remove Tile(s)']: (selected) => updateModel(updateDisplayList(
      config, model, selected, makeScene.removeTiles
    )),
    ['Remove Tile Class(es)']: (selected) => updateModel(updateDisplayList(
      config, model, selected,
      makeScene.removeTileClasses(model.data.tiles || [])
    )),
    ['Remove Element(s)']: (selected) => updateModel(updateDisplayList(
      config, model, selected, makeScene.removeElements
    )),
    ['Fresh Display List']: (_, options) => updateModel(freshDisplayList(
      config, model, options
    ))
  };

  app.ports.toJS.subscribe(({ mode, text, options, selected }) => {
    if (mode == "jump") {
      const number = parseInt(text);
      if (!Number.isNaN(number))
        setStructure(number - (number > 0));
    }
    else if (mode == "search" && text) {
      const pattern = new RegExp(`^${text}$`, 'i');
      const i = model.structures.findIndex(s => !!pattern.exec(s.name));

      if (i >= 0)
        setStructure(i);
      else
        config.log(`Name "${text}" not found.`);
    }
    else if (mode == "action") {
      if (action[text])
        action[text](selected, options);
    }
    else if (mode == "options") {
      const changedMod = (
        model.data.type == 'tiling' &&
          options.tilingModifier &&
          options.tilingModifier != model.options.tilingModifier
      );

      for (const key in options)
        model.options[key] = options[key];

      if (changedMod)
        setStructure(model.index);
      else
        updateModel(updateStructure(config, model));
    }
  });

  setStructure(0);
};


render(Document.body);
