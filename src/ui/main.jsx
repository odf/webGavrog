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
import { Menu }      from '../elm/Menu';
import { View3d }    from '../elm/View3d';


if (!HTMLCanvasElement.prototype.toBlob) {
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    value(callback, type, quality) {
      const binStr = atob(this.toDataURL(type, quality).split(',')[1]);

      const len = binStr.length;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++ )
        arr[i] = binStr.charCodeAt(i);

      callback(new Blob([arr], { type: type || 'image/png' }));
    }
  });
}


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


class App extends React.Component {
  constructor() {
    super();
    this.state = { windowsActive: {}, options: defaultOptions };
    this.loadFile = fileLoader(this.handleFileData.bind(this));
    this.saveFile = fileSaver();
  }

  componentDidMount() {
    this.setStructure(0, structures);
  }

  log(s) {
    this.setState({ log: s });
  }

  title(fname, index, len, name) {
    const prefix = fname ? `File "${fname}" ` : 'Structure ';
    const postfix = name ? `: ${name}` : '';
    this.setState({ title: `${prefix}#${index} (of ${len})${postfix}` });
  }

  setStructure(i, structures) {
    structures = structures || this.state.structures;
    const n = structures.length;
    const index = i < 0 ? n + i % n : i % n;

    this.setState({ structures, index });

    this.title(
      this.state.filename,
      index + 1,
      structures.length,
      structures[index].name);

    csp.go(function*() {
      try {
        if (structures[index].isRaw) {
          this.log('Converting structure data...');
          structures[index] = yield callWorker({
            cmd: 'processCGD',
            val: structures[index]
          });
        }

        const scene = yield makeScene(
          structures[index],
          this.state.options,
          callWorker,
          s => this.log(s));

        this.setState({ structures, index, scene });

        if (this.state.scenePort)
          this.state.scenePort.send(scene);
      } catch(ex) {
        this.log('ERROR processing the structure!!!');
        console.error(ex);
      }
    }.bind(this));
  }

  handleFileData(file, data) {
    const filename = file.name;
    this.setState({ filename });

    csp.go(function*() {
      let list = [];

      if (filename.match(/\.(ds|tgs)$/))
        list = Array.from(parseDSymbols(data));
      else if (filename.match(/\.(cgd|pgr)$/)) {
        this.log('Parsing .cgd data...');
        list = yield callWorker({ cmd: 'parseCGD', val: data });
      }

      this.setStructure(0, list);
    }.bind(this));
  }

  saveStructure() {
    const structure = this.state.structures[this.state.index];

    if (structure.type == 'tiling') {
      const text = structure.symbol.toString();
      const blob = new Blob([text], { type: 'text/plain' });
      this.saveFile(blob, 'gavrog.ds');
    }
    else
      throw new Error(`save not yet implemented for '${structure.type}'`);
  }

  saveScreenshot() {
    this.state.commandPort.send('redrawsOn');
    window.requestAnimationFrame(() => {
      const canvas = document.getElementById('main-3d-canvas');

      if (canvas)
        canvas.toBlob(blob => this.saveFile(blob, 'gavrog.png'));
      else
        this.log('ERROR: could not save screenshot - no canvas element found');
      this.state.commandPort.send('redrawsOff');
    });
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
      this.setStructure(this.state.index - 1);
    else if (key == 'n')
      this.setStructure(this.state.index + 1)
  }

  render3dScene() {
    const handlePorts = ports => {
      this.setState({
        scenePort: ports.scenes,
        commandPort: ports.commands
      });
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
      { label: 'Prev', action: () => this.setStructure(this.state.index - 1) },
      { label: 'Next', action: () => this.setStructure(this.state.index + 1) },
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
          <Elm src={Menu}
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
                  {this.state.title}<br/>
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
      const pattern = new RegExp(`\\b${text}\\b`, 'i');

      csp.go(function*() {
        const i = this.state.structures.findIndex(s => !!pattern.exec(s.name));
        if (i >= 0)
          this.setStructure(i);
        else
          this.log(`Name "${text}" not found.`);
      }.bind(this));
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

      this.setState((state, props) => ({ options }));
      this.setStructure(this.state.index);
    }
  }

  renderOptionsDialog() {
    if (!this.state.windowsActive.options)
      return;

    const handler = ([data, value]) => this.handleOptionsSubmit(data, value);
    const options = this.state.options;
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
