import * as csp from 'plexus-csp';

import * as webworkers from '../common/webworkers';
import * as version from '../version';
import parseDSymbols from '../io/ds';

import { structures } from './builtinStructures';
import makeScene from './makeScene';

import { MainMenu } from '../elm/MainMenu';


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


const initialModel = {
  options: {},
  filename: null,
  structures,
  index: null,
  scene: null
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
      config.log('Converting structure data...');
      structures[index] = yield callWorker({
        cmd: 'processCGD',
        val: structures[index]
      });
    }

    const scene = yield makeScene(
      structures[index], model.options, callWorker, config.log);
    const newModel = Object.assign({}, model, { structures, index, scene });

    config.sendTitle(title(newModel));
    config.sendScene(scene);

    return newModel;
  } catch (ex) {
    config.log(`ERROR processing structure ${i}!!!`);
    console.error(ex);
    return model;
  }
});


const setOptions = (model, options) => {
  const newOptions = Object.assign({}, model.options, options);
  return Object.assign({}, model, { options: newOptions });
};


const findStructureByName = (model, regexText) => {
  const pattern = new RegExp(`\\b${regexText}\\b`, 'i');
  return model.structures.findIndex(s => !!pattern.exec(s.name));
};


const currentIndex = model => model.index;
const currentStructure = model => model.structures[model.index];
const currentScene = model => model.scene;
const currentOptions = model => model.options;


const newFile = (config, model, { file, data }) => csp.go(function*() {
  try {
    const filename = file.name;
    let structures = [];

    if (filename.match(/\.(ds|tgs)$/)) {
      config.log('Parsing .ds data...');
      structures = Array.from(parseDSymbols(data));
    }
    else if (filename.match(/\.(cgd|pgr)$/)) {
      config.log('Parsing .cgd data...');
      structures = yield callWorker({ cmd: 'parseCGD', val: data });
    }

    const newModel =
          Object.assign({}, model, { filename, structures, index: null });

    config.sendTitle(title(newModel));
    return yield toStructure(config, newModel, 0);
  } catch (ex) {
    config.log(`ERROR loading from file "${file.name}"!!!`);
    console.error(ex);
  }
});


const saveStructure = (config, model) => {
  const structure = currentStructure(model);

  if (structure.type == 'tiling') {
    const text = structure.symbol.toString();
    const blob = new Blob([text], { type: 'text/plain' });
    config.saveFile(blob, 'gavrog.ds');
  }
  else
    throw new Error(`save not yet implemented for '${structure.type}'`);
};


const saveScreenshot = (config, model) => {
  const canvas = document.getElementById('main-3d-canvas');

  if (canvas) {
    config.sendCommand('redrawsOn');

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

      config.sendCommand('redrawsOff');
    });
  }
  else
    config.log('ERROR: could not save screenshot - no canvas element found');
};


class App {
  setStructure(i) {
    csp.go(function*() {
      this.model = yield toStructure(this.config, this.model, i);
    }.bind(this));
  }

  previousStructure() {
    this.setStructure(currentIndex(this.model) - 1);
  }

  nextStructure() {
    this.setStructure(currentIndex(this.model) + 1);
  }

  openFile() {
    this.config.loadFile(({ file, data }) => csp.go(function*() {
      this.model = yield newFile(this.config, this.model, { file, data });
    }.bind(this)));
  }

  saveStructure() {
    saveStructure(this.config, this.model);
  }

  saveScreenshot() {
    saveScreenshot(this.config, this.model);
  }

  render(domNode) {
    const action = {
      ['Open...']: () => this.openFile(),
      ['Save Structure...']: () => this.saveStructure(),
      ['Save Screenshot...']: () => this.saveScreenshot(),
      ['First']: () => this.setStructure(0),
      ['Prev']: () => this.previousStructure(),
      ['Next']: () => this.nextStructure(),
      ['Last']: () => this.setStructure(-1)
    };

    const handleElmData = ({ mode, text, options: data }) => {
      if (mode == "jump") {
        const number = parseInt(text);
        if (!Number.isNaN(number))
          this.setStructure(number - (number > 0));
      }
      else if (mode == "search") {
        const i = text ? findStructureByName(this.model, text) : -1;
        if (i >= 0)
          this.setStructure(i);
        else
          this.config.log(`Name "${text}" not found.`);
      }
      else if (mode == "selected") {
        if (action[text])
          action[text]()
      }
      else if (mode == "options") {
        const options = {};
        for (const { key, value } of data)
          options[key] = value;

        this.model = setOptions(this.model, options);
        this.setStructure(currentIndex(this.model));
      }
    };

    const handleKeyPress = code => {
      const key = String.fromCharCode(code).toLowerCase();
      if (key == 'p')
        this.previousStructure();
      else if (key == 'n')
        this.nextStructure();
    };

    const app = MainMenu.embed(domNode, {
      revision: version.gitRev,
      timestamp: version.gitDate });

    this.config = {
      loadFile: fileLoader(),
      saveFile: fileSaver(),
      log: app.ports.log.send,
      sendTitle: app.ports.titles.send,
      sendScene: app.ports.scenes.send,
      sendCommand: app.ports.commands.send
    };

    app.ports.toJS.subscribe(handleElmData);
    app.ports.keyPresses.subscribe(handleKeyPress);

    this.model = initialModel;
    this.setStructure(0);
  }
}


const app = new App();
app.render(document.getElementById('main'));
