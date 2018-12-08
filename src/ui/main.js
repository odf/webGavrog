import * as csp from 'plexus-csp';

import * as webworkers from '../common/webworkers';
import * as version from '../version';
import parseDSymbols from '../io/ds';

import { structures } from './builtinStructures';
import makeScene from './makeScene';

import { Elm } from '../elm/MainMenu';


const worker = webworkers.create('js/sceneWorker.js');
const callWorker = csp.nbind(worker, null);


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
    const prefix = fname ? `File "${fname}" ` : 'Builtin structure ';
    const postfix = name ? `: ${name}` : '';
    return `${prefix}#${index} (of ${len})${postfix}`;
  }
  else if (model.filename)
    return `File "${model.filename}"...`;
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

    const scene = yield makeScene(
      structures[index], model.options, callWorker, config.log);
    const newModel = Object.assign({}, model, { structures, index, scene });

    yield config.sendScene(scene);
    yield config.sendTitle(title(newModel));

    return newModel;
  } catch (ex) {
    console.error(ex);
    yield config.log(`ERROR processing structure ${i}!!!`);
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


const saveScreenshot = (config, model) => {
  const canvas = document.getElementById('main-3d-canvas');

  if (canvas) {
    window.requestAnimationFrame(() => {
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

  const app = Elm.MainMenu.init({
    node: domNode,
    flags: {
      revision: version.gitRev,
      timestamp: version.gitDate
    }});

  const send = key => val => app.ports.fromJS.send(
    Object.assign({ title: null, log: null, scene: null }, { [key]: val }));

  const config = {
    loadFile: fileLoader(),
    saveFile: fileSaver(),
    log: send('log'),
    sendTitle: send('title'),
    sendScene: send('scene')
  };

  const openFile = () => config.loadFile(
    ({ file, data }) => csp.go(function*() {
      Object.assign(model, yield newFile(config, model, { file, data }));
    })
  );

  const setStructure = i => csp.go(function*() {
    Object.assign(model, yield toStructure(config, model, i));
  });

  const action = {
    ['Open...']: openFile,
    ['Save Structure...']: () => saveStructure(config, model),
    ['Save Screenshot...']: () => saveScreenshot(config, model),
    ['First']: () => setStructure(0),
    ['Prev']: () => setStructure(model.index - 1),
    ['Next']: () => setStructure(model.index + 1),
    ['Last']: () => setStructure(-1)
  };

  app.ports.toJS.subscribe(({ mode, text, options }) => {
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
    else if (mode == "selected" && action[text])
      action[text]();
    else if (mode == "options") {
      for (const { key, value } of options)
        model.options[key] = value;

      setStructure(model.index);
    }
  });

  setStructure(0);
};


render(document.getElementById('main'));
