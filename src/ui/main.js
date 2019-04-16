import * as csp from 'plexus-csp';

import * as pickler from '../common/pickler';
import * as version from '../version';
import parseDSymbols from '../io/ds';

import { structures } from './builtinStructures';
import { preprocess, makeScene } from './makeScene';

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


const title = model => {
  if (model.structures && model.index != null) {
    const fname = model.filename;
    const index = model.index + 1;
    const len = model.structures.length;
    const name = model.structures[model.index].name;
    const collection = fname ? `"${fname}"` : 'builtin';
    return `#${index}/${len} - ${name || ''} (${collection})`;
  }
  else
    return '';
};


const toStructure = (config, model, i) => csp.go(function*() {
  try {
    const structures = model.structures;
    const n = structures.length;
    const index = i < 0 ? n + i % n : i % n;

    if (structures[index].isRaw) {
      yield config.log('Converting structure data...');
      structures[index] = yield callWorker({
        cmd: 'processCGD',
        val: structures[index]
      });
    }

    const data = yield preprocess(structures[index], callWorker, config.log);
    const scene = yield makeScene(data, model.options, callWorker, config.log);

    const newModel =
          Object.assign({}, model, { structures, index, data, scene });

    yield config.sendScene(scene, true);
    yield config.sendTitle(title(newModel));

    return newModel;
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR processing structure ${i}!!!`);
    return model;
  }
});


const updateStructure = (config, model) => csp.go(function*() {
  try {
    const scene = yield makeScene(
      model.data, model.options, callWorker, config.log);

    yield config.sendScene(scene, false);
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


const updateDisplayList = (
  config, model, selected, update, updateNoDL
) => csp.go(function*() {
  if (model.data.displayList) {
    try {
      const currentDisplayList = model.data.displayList.slice();
      const selection = convertSelection(model.scene, selected)
            .map(k => model.scene.instances[k])
      const displayList = update(currentDisplayList, selection);

      const data = Object.assign({}, model.data, { displayList });
      const scene = yield makeScene(data, model.options, callWorker, config.log);

      yield config.sendScene(scene, false);

      return Object.assign({}, model, { data, scene });
    } catch (ex) {
      console.error(ex);
      yield config.log(`ERROR updating scene!!!`);
      return model;
    }
  }
  else
    return yield updateNoDL(config, model, selected);
});


const addTiles = (displayList, selection) => {
  const result = [];
  const seen = {};

  for (const { partIndex, neighbors, extraShiftCryst } of selection) {
    const { tileIndex, shift } = neighbors[partIndex];
    const extraShift = ops.plus(extraShiftCryst, shift);
    const item = { tileIndex, extraShift };
    const key = pickler.serialize(item);

    if (!seen[key]) {
      result.push(item);
      seen[key] = true;
    }
  }

  for (const item of displayList) {
    const key = pickler.serialize({
      tileIndex: item.tileIndex,
      extraShift: item.extraShift
    });

    if (!seen[key]) {
      result.push(item);
      seen[key] = true;
    }
  }

  return result;
};


const addCoronas = (displayList, selection) => {
  const result = [];
  const seen = {};

  for (const { partIndex, neighbors, extraShiftCryst } of selection) {
    for (const { tileIndex, shift } of neighbors) {
      const extraShift = ops.plus(extraShiftCryst, shift);
      const item = { tileIndex, extraShift };
      const key = pickler.serialize(item);

      if (!seen[key]) {
        result.push(item);
        seen[key] = true;
      }
    }
  }

  for (const item of displayList) {
    const key = pickler.serialize({
      tileIndex: item.tileIndex,
      extraShift: item.extraShift
    });

    if (!seen[key]) {
      result.push(item);
      seen[key] = true;
    }
  }

  return result;
};


const restoreTiles = (displayList, selection) => {
  const toBeRestored = {};
  for (const inst of selection)
    toBeRestored[inst.tileIndex] = true;

  return displayList.map(
    (item, i) =>
      toBeRestored[i] ? Object.assign({}, item, { skippedParts: {} }) : item
  );
};


const removeTiles = (displayList, selection) => {
  const toBeRemoved = {};
  for (const inst of selection)
    toBeRemoved[inst.tileIndex] = true;

  return displayList.filter((_, i) => !toBeRemoved[i]);
};


const removeElements = (displayList, selection) => {
  const toBeRemoved = {};
  for (const inst of selection) {
    if (toBeRemoved[inst.tileIndex] == null)
      toBeRemoved[inst.tileIndex] = {};

    toBeRemoved[inst.tileIndex][inst.partIndex] = true;
  }

  return displayList.map((item, i) => {
    if (toBeRemoved[i]) {
      const skippedParts = Object.assign({}, item.skippedParts || {});
      for (const j of Object.keys(toBeRemoved[i]))
        skippedParts[j] = true;
      return Object.assign({}, item, { skippedParts });
    }
    else
      return item;
  });
};


const removeElementsNoDL = (config, model, selected) => csp.go(function*() {
  try {
    const toBeRemoved = {};
    for (const k of convertSelection(model.scene, selected))
      toBeRemoved[k] = true;

    const instances = model.scene.instances.filter(
      (inst, k) => !toBeRemoved[k]);

    const scene = Object.assign({}, model.scene, { instances });
    yield config.sendScene(scene, false);

    return Object.assign({}, model, { scene });
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR removing element(s)!!!`);
    return model;
  }
});


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
    sendScene: (scene, reset) => app.ports.fromJS.send({ scene, reset })
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
    ['First']: () => setStructure(0),
    ['Prev']: () => setStructure(model.index - 1),
    ['Next']: () => setStructure(model.index + 1),
    ['Last']: () => setStructure(-1),
    ['Add Tile(s)']: (selected) =>
      updateModel(updateDisplayList(config, model, selected, addTiles)),
    ['Add Corona(s)']: (selected) =>
      updateModel(updateDisplayList(config, model, selected, addCoronas)),
    ['Restore Tile(s)']: (selected) =>
      updateModel(updateDisplayList(config, model, selected, restoreTiles)),
    ['Remove Tile(s)']: (selected) =>
      updateModel(updateDisplayList(config, model, selected, removeTiles)),
    ['Remove Element(s)']: (selected) =>
      updateModel(updateDisplayList(
        config, model, selected, removeElements, removeElementsNoDL))
  };

  app.ports.toJS.subscribe(({ mode, text, options, selected }) => {
    if (mode == "jump") {
      const number = parseInt(text);
      if (!Number.isNaN(number))
        setStructure(number - (number > 0));
    }
    else if (mode == "search" && text) {
      const pattern = new RegExp(`\\b${text}\\b`, 'i');
      const i = model.structures.findIndex(s => !!pattern.exec(s.name));

      if (i >= 0)
        setStructure(i);
      else
        config.log(`Name "${text}" not found.`);
    }
    else if (mode == "menuChoice") {
      if (action[text])
        action[text](selected, options);
    }
    else if (mode == "options") {
      for (const key in options)
        model.options[key] = options[key];

      updateModel(updateStructure(config, model));
    }
  });

  setStructure(0);
};


render(Document.body);
