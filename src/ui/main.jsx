import * as React    from 'react';
import * as ReactDOM from 'react-dom';
import * as csp      from 'plexus-csp';

import * as webworkers from '../common/webworkers';
import * as version  from '../version';
import parseDSymbols from '../io/ds';

import { structures } from './builtinStructures';
import makeScene     from './makeScene';
import Elm           from './ElmComponent';

import { TextInput } from '../elm/TextInput';
import { Options }   from '../elm/Options';
import { MainMenu }  from '../elm/MainMenu';
import { View3d }    from '../elm/View3d';


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


const defaultOptions = {
  colorByTranslationClass: false,
  skipRelaxation: false,
  extraSmooth: false,
  showSurfaceMesh: false /*,
  highlightPicked: false */
};


const optionLabel = {
  colorByTranslationClass: "Color By Translations",
  skipRelaxation: "Skip Relaxation",
  extraSmooth: "Extra-Smooth Faces",
  showSurfaceMesh: "Show Surface Mesh" /*,
  highlightPicked: "Highlight On Mouseover" */
};


const initialModel = {
  options: defaultOptions,
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


class App extends React.Component {
  constructor() {
    super();
    this.state = { windowsActive: {}, model: initialModel };
    this.loadFile = fileLoader(this.handleFileData.bind(this));
    this.saveFile = fileSaver();
  }

  componentDidMount() {
    this.setStructure(0);
  }

  log(s) {
    this.setState((state, props) => ({ log: s }));
  }

  setStructure(i) {
    csp.go(function*() {
      try {
        const model = yield toStructure(this.state.model, i,
                                        s => this.log(s));
        this.setState((state, props) => ({ model }));
        this.state.scenePort.send(currentScene(model));
      } catch (ex) {
        this.log(`ERROR processing structure ${i}!!!`);
        console.error(ex);
      }
    }.bind(this));
  }

  previousStructure() {
    this.setStructure(currentIndex(this.state.model) - 1);
  }

  nextStructure() {
    this.setStructure(currentIndex(this.state.model) + 1);
  }

  handleFileData(file, data) {
    csp.go(function*() {
      let loadError = false;
      try {
        const model = yield parseFileData(this.state.model, file, data,
                                          s => this.log(s));
        this.setState((state, props) => ({ model }));
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
    const structure = currentStructure(this.state.model);

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
      this.state.commandPort.send('redrawsOn');

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

        this.state.commandPort.send('redrawsOff');
      });
    }
    else
      this.log('ERROR: could not save screenshot - no canvas element found');
  }

  showWindow(key) {
    this.setState((state, props) => ({
      windowsActive: { ...state.windowsActive, [key]: true }
    }));
  }

  hideWindow(key) {
    this.setState((state, props) => ({
      windowsActive: { ...state.windowsActive, [key]: false }
    }));
  }

  handleKeyPress(code) {
    const key = String.fromCharCode(code).toLowerCase();
    if (key == 'p')
      this.previousStructure();
    else if (key == 'n')
      this.nextStructure();
  }

  render3dScene() {
    const handlePorts = ports => {
      this.setState((state, props) => ({
        scenePort: ports.scenes,
        commandPort: ports.commands
      }));
      ports.keyPresses.subscribe(code => this.handleKeyPress(code));
    };

    return (
      <Elm src={View3d} ports={handlePorts} />
    );
  }

  mainMenu() {
    const sendCmd = cmd => () => this.state.commandPort.send(cmd);

    const fileMenu = [
      { label: 'Open...', action: () => this.loadFile() },
      { label: 'Save Structure...', action: () => this.saveStructure() },
      { label: 'Save Screenshot...', action: () => this.saveScreenshot() }
    ];

    const structureMenu = [
      { label: 'First', action: () => this.setStructure(0) },
      { label: 'Prev', action: () => this.previousStructure() },
      { label: 'Next', action: () => this.nextStructure() },
      { label: 'Last', action: () => this.setStructure(-1) },
      { label: 'Jump...', action: () => this.showWindow('jump') },
      { label: 'Search...', action: () => this.showWindow('search') }
    ];

    const viewMenu = [
      { label: 'Center', action: sendCmd('center') },
      { label: 'Along X', action: sendCmd('viewAlongX') },
      { label: 'Along Y', action: sendCmd('viewAlongY') },
      { label: 'Along Z', action: sendCmd('viewAlongZ') }
    ];

    const helpMenu = [
      { label: 'About Gavrog...', action: () => this.showWindow('about') }
    ];

    return [
      { label: 'File',   submenu: fileMenu },
      { label: 'Structure', submenu: structureMenu },
      { label: 'View',   submenu: viewMenu },
      { label: 'Options...', action: () => this.showWindow('options') },
      { label: 'Help',   submenu: helpMenu }
    ];
  }

  renderMenu() {
    const stripSubmenu = menu => menu.map(({ label }) => label);

    const stripMenu = menu => menu.map(({ label, submenu }) =>
      ({ label, submenu: submenu ? stripSubmenu(submenu) : null }));

    const mapMenu = menu => menu.map(({ action, submenu }) =>
      submenu ? mapMenu(submenu) : action);

    const toAction = mapMenu(this.mainMenu());

    const handler = ([i, j]) => {
      if (i != null) {
        const a = toAction[i];
        if (typeof a == 'function')
          a();
        else if (j != null) {
          const b = a[j];
          if (typeof b == 'function')
            b();
        }
      }
    };

    return (
      <Elm src={MainMenu}
           flags={{
             classes: {
               menu: "infoBoxMenu",
               item: "infoBoxMenuItem",
               submenu: "infoBoxMenuSubmenu",
               subitem: "infoBoxMenuSubmenuItem",
               highlight: "infoBoxMenuHighlight"
             },
             items: stripMenu(this.mainMenu())
           }}
           ports={ ports => ports.send.subscribe(handler) } />
    );
  }

  renderMainDialog() {
    return (
      <div className="floatable infoBox">
        <img width="48" className="infoBoxLogo" src="3dt.ico"/>
        <h3 className="infoBoxHeader">Gavrog</h3>
        <span className="clearFix">
          {title(this.state.model)}<br/>
      {this.state.log || "Welcome!"}
        </span>
        {this.renderMenu()}
      </div>
    );
  }

  renderAboutDialog() {
    if (!this.state.windowsActive.about)
      return;

    return (
      <div className="floatable centered infoBox"
           onClick={() => this.hideWindow('about')}>
        <img width="48" className="infoBoxLogo" src="3dt.ico"/>
        <h3 className="infoBoxHeader">Gavrog for the Web</h3>
        <span className="clearFix">
          by Olaf Delgado-Friedrichs 2018<br/>
          The Australian National University
        </span>
        <p>
          <b>Version:</b> 0.0.0 (pre-alpha)<br/>
          <b>Revision:</b> {version.gitRev}<br/>
          <b>Timestamp:</b> {version.gitDate}
        </p>
      </div>
    );
  }

  handleJumpSubmit(text) {
    this.hideWindow('jump');

    const number = parseInt(text);

    if (!Number.isNaN(number))
      this.setStructure(number - (number > 0));
  }

  renderJumpDialog() {
    if (!this.state.windowsActive.jump)
      return;

    const handler = text => this.handleJumpSubmit(text);

    return (
      <Elm src={TextInput}
           flags={{ label: 'Jump to', placeholder: 'Number' }}
           ports={ ports => ports.send.subscribe(handler) } />
    );
  }

  handleSearchSubmit(text) {
    this.hideWindow('search');

    if (text) {
      const i = findStructureByName(this.state.model, text);

      if (i >= 0)
        this.setStructure(i);
      else
        this.log(`Name "${text}" not found.`);
    }
  }

  renderSearchDialog() {
    if (!this.state.windowsActive.search)
      return;

    const handler = text => this.handleSearchSubmit(text);

    return (
      <Elm src={TextInput}
           flags={{ label: 'Search by name', placeholder: 'Regex' }}
           ports={ ports => ports.send.subscribe(handler) } />
    );
  }

  handleOptionsSubmit(data, value) {
    this.hideWindow('options');

    if (value) {
      const options = {};
      for (const { key, value } of data)
        options[key] = value;

      const model = setOptions(this.state.model, options);
      this.setState((state, props) => ({ model }));
      this.setStructure(currentIndex(this.state.model));
    }
  }

  renderOptionsDialog() {
    if (!this.state.windowsActive.options)
      return;

    const handler = ([data, value]) => this.handleOptionsSubmit(data, value);
    const options = currentOptions(this.state.model);
    const flags = Object.keys(options).map(key => ({
      key: key,
      label: optionLabel[key],
      value: options[key]
    }));

    return (
      <Elm src={Options}
           flags={flags}
           ports={ports => ports.send.subscribe(handler)} />
    );
  }

  render() {
    const message = this.state.log || "Welcome!";

    return (
      <div>
        {this.render3dScene()}
        {this.renderMainDialog()}
        {this.renderAboutDialog()}
        {this.renderJumpDialog()}
        {this.renderSearchDialog()}
        {this.renderOptionsDialog()}
      </div>
    );
  }
}


ReactDOM.render(<App/>, document.getElementById('react-main'));
