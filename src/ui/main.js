import * as csp from 'plexus-csp';

import * as webworkers from '../common/webworkers';
import * as version from '../version';
import parseDSymbols from '../io/ds';

import { structures } from './builtinStructures';
import makeScene from './makeScene';

import { MainMenu } from '../elm/MainMenu';


const worker = webworkers.create('js/sceneWorker.js');
const callWorker = csp.nbind(worker, null);


const fileLoader = (onData, accept, multiple=false, binary=false) => {
  const input = document.createElement('input');

  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;

  input.addEventListener('change', event => {
    const files = event.target.files;

    for (let i = 0; i < files.length; ++i) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = event => onData(file, event.target.result);

      if (binary)
        reader.readAsDataURL(file);
      else
        reader.readAsText(file);
    }
  });

  return () => input.click();
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


const toStructure = (model, i, log) => csp.go(function*() {
  const structures = model.structures;
  const n = structures.length;
  const index = i < 0 ? n + i % n : i % n;

  if (structures[index].isRaw) {
    log('Converting structure data...');
    structures[index] = yield callWorker({
      cmd: 'processCGD',
      val: structures[index]
    });
  }

  const scene = yield makeScene(
      structures[index], model.options, callWorker, log);
  return Object.assign({}, model, { structures, index, scene });
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


const parseFileData = (model, file, data, log) => csp.go(function*() {
  const filename = file.name;
  let structures = [];

  if (filename.match(/\.(ds|tgs)$/)) {
    log('Parsing .ds data...');
    structures = Array.from(parseDSymbols(data));
  }
  else if (filename.match(/\.(cgd|pgr)$/)) {
    log('Parsing .cgd data...');
    structures = yield callWorker({ cmd: 'parseCGD', val: data });
  }

  return Object.assign({}, model, { filename, structures, index: null });
});


class App {
  constructor() {
    this.model = initialModel;
    this.loadFile = fileLoader(this.handleFileData.bind(this));
    this.saveFile = fileSaver();
  }

  setStructure(i) {
    csp.go(function*() {
      try {
        this.model = yield toStructure(this.model, i, this.log);
        this.titlePort.send(title(this.model));
        this.scenePort.send(currentScene(this.model));
      } catch (ex) {
        this.log(`ERROR processing structure ${i}!!!`);
        console.error(ex);
      }
    }.bind(this));
  }

  previousStructure() {
    this.setStructure(currentIndex(this.model) - 1);
  }

  nextStructure() {
    this.setStructure(currentIndex(this.model) + 1);
  }

  handleFileData(file, data) {
    csp.go(function*() {
      let loadError = false;
      try {
        this.model = yield parseFileData(this.model, file, data, this.log);
        this.titlePort.send(title(this.model));
      } catch (ex) {
        loadError = true;
        this.log(`ERROR loading from file "${file.name}"!!!`);
        console.error(ex);
      }

      if (!loadError)
        this.setStructure(0);
    }.bind(this));
  }

  saveStructure() {
    const structure = currentStructure(this.model);

    if (structure.type == 'tiling') {
      const text = structure.symbol.toString();
      const blob = new Blob([text], { type: 'text/plain' });
      this.saveFile(blob, 'gavrog.ds');
    }
    else
      throw new Error(`save not yet implemented for '${structure.type}'`);
  }

  saveScreenshot() {
    const canvas = document.getElementById('main-3d-canvas');

    if (canvas) {
      this.commandPort.send('redrawsOn');

      window.requestAnimationFrame(() => {
        if (canvas.toBlob)
          canvas.toBlob(blob => this.saveFile(blob, 'gavrog.png'));
        else {
          const binStr = atob(canvas.toDataURL().split(',')[1]);

          const len = binStr.length;
          const arr = new Uint8Array(len);
          for (let i = 0; i < len; i++ )
            arr[i] = binStr.charCodeAt(i);

          const blob = new Blob([arr], { type: 'image/png' });
          this.saveFile(blob, 'gavrog.png');
        }

        this.commandPort.send('redrawsOff');
      });
    }
    else
      this.log('ERROR: could not save screenshot - no canvas element found');
  }

  render(domNode) {
    const action = {
      ['Open...']: () => this.loadFile(),
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
          this.log(`Name "${text}" not found.`);
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

    const handlePorts = ports => {
      this.titlePort = ports.titles;
      this.scenePort = ports.scenes;
      this.commandPort = ports.commands;

      this.log = s => ports.log.send(s);

      ports.toJS.subscribe(handleElmData);
      ports.keyPresses.subscribe(handleKeyPress);
    };

    const flags = {
      revision: version.gitRev,
      timestamp: version.gitDate };

    const app = MainMenu.embed(domNode, flags);
    handlePorts(app.ports);
    this.setStructure(0);
  }
}


const app = new App();
app.render(document.getElementById('main'));
