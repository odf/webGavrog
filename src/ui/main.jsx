import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as csp   from 'plexus-csp';

import * as delaney  from '../dsymbols/delaney';
import parseDSymbols from '../io/ds';

import Display3d from './Display3d';
import Floatable from './Floatable';
import Menu      from './Menu';
import makeScene from './makeScene';


const triangleUp    = '\u25b2';
const triangleRight = '\u25ba';
const triangleDown  = '\u25bc';
const triangleLeft  = '\u25c0';


const tilings = [
  { name: 'pcu', symbol: delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>') },
  { name: 'dia', symbol: delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>') },
  { name: 'fcu', symbol: delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>') }
];


class FileLoader {
  constructor(onData, accept, multiple=false, binary=false) {
    this.onData = onData;
    this.accept = accept;
    this.multiple = multiple;
    this.binary = binary;
  }

  _getInputElement() {
    if (!this.input) {
      this.input = document.createElement('input');

      this.input.type = 'file';
      this.input.accept = this.accept;
      this.input.multiple = this.multiple;
      this.input.addEventListener('change', event => this._loadFile(event));
    }

    return this.input;
  }

  _loadFile(event) {
    const onData = this.onData;

    for (const file of event.target.files) {
      const reader = new FileReader();

      reader.onload = event => onData(file, event.target.result);

      if (this.binary)
        reader.readAsDataURL(file);
      else
        reader.readAsText(file);
    }
  }

  select() {
    this._getInputElement().click();
  }

  destroy() {
    if (this.input)
      document.body.removeChild(this.input);
    this.input = null;
  }
}


class FileSaver {
  constructor() {
  }

  _getDownloadLink() {
    if (!this.link) {
      this.link = document.createElement('a');
      this.link.style.display = 'none';
      document.body.appendChild(this.link);
    }
    return this.link;
  }

  save(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = this._getDownloadLink();

    link.download = filename;
    link.href = url;
    link.click();
  }

  destroy() {
    if (this.link)
      document.body.removeChild(this.link);
    this.link = null;
  }
}


class App extends React.Component {
  constructor() {
    super();
    this.state = {};
    this.loader = new FileLoader(this.handleFileData.bind(this));
    this.saver = new FileSaver();
  }

  handleResize(data) {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight
    });
  }

  log(s) {
    this.setState({ log: s });
  }

  title(fname, index, name) {
    const prefix = fname ? `File "${fname}" ` : 'Tiling ';
    const postfix = name ? `: ${name}` : '';
    this.setState({ title: `${prefix}#${index}${postfix}` });
  }

  setTiling(i, symbolList) {
    const syms = symbolList || this.state.syms;
    const n = syms.length;
    const index = i < 0 ? n + i % n : i % n;
    const ds = syms[index].symbol;

    this.title(this.state.filename, index + 1, syms[index].name);

    csp.go(function*() {
      try {
        const scene = yield makeScene(ds, s => this.log(s));
        const camera = scene.getObjectByName('camera');
        const cameraParameters = { distance: camera.position.z };

        this.setState({ syms, index, scene, camera, cameraParameters });
      } catch(ex) { console.error(ex); }
    }.bind(this));
  }

  componentDidMount() {
    this.handleResize();
    this.resizeListener = data => this.handleResize(data);
    window.addEventListener('resize', this.resizeListener);

    this.setTiling(0, tilings);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeListener);
  }

  toggleMenu() {
    this.setState({ hideMenu: !this.state.hideMenu });
  }

  render3d() {
    const keyHandlers = {
      'p': () => this.setTiling(this.state.index - 1),
      'n': () => this.setTiling(this.state.index + 1)
    };

    if (this.state.scene != null)
      return (
        <Display3d scene            = {this.state.scene}
                   camera           = {this.state.camera}
                   cameraParameters = {this.state.cameraParameters}
                   width            = {this.state.width}
                   height           = {this.state.height}
                   keyHandlers      = {keyHandlers}
                   />
      );
  }

  handleFileData(file, data) {
    this.setState({ filename: file.name });
    this.setTiling(0, Array.from(parseDSymbols(data)));
  }

  saveTiling() {
    const text = this.state.syms[this.state.index].symbol.toString();
    const blob = new Blob([text], { type: 'text/plain' });
    this.saver.save(blob, 'gavrog.ds');
  }

  saveScreenshot() {
    const canvas = document.getElementById('main-3d-canvas');

    if (canvas)
      canvas.toBlob(blob => this.saver.save(blob, 'gavrog.png'));
  }

  renderTrigger() {
    return (
      <div className="infoBoxTrigger"
           onClick={() => this.toggleMenu()}>
        {this.state.hideMenu ? triangleDown : triangleUp}
      </div>
    );
  }

  renderMenu() {
    const fileMenu = [
      { label: 'Open...', action: () => this.loader.select() },
      { label: 'Save Tiling...', action: () => this.saveTiling() },
      { label: 'Save Screenshot...', action: () => this.saveScreenshot() }];

    const tilingMenu = [
      { label: 'First', action: () => this.setTiling(0) },
      { label: 'Prev', action: () => this.setTiling(this.state.index - 1) },
      { label: 'Next', action: () => this.setTiling(this.state.index + 1) },
      { label: 'Last', action: () => this.setTiling(-1) },
      { label: 'Search...', action: () => this.log('Tiling -> Search...') }];

    const viewMenu = [
      { label: 'Along X', action: () => this.log('View -> Along X') },
      { label: 'Along Y', action: () => this.log('View -> Along Y') },
      { label: 'Along Z', action: () => this.log('View -> Along Z') }
    ];

    const helpMenu = [
      { label: 'About Gavrog...', action: () => this.log('Help -> About') }
    ];

    const mainMenu = [
      { label: 'File',   submenu: fileMenu },
      { label: 'Tiling', submenu: tilingMenu },
      { label: 'View',   submenu: viewMenu },
      { label: 'Options...', action: () => this.log('Options...') },
      { label: 'Help',   submenu: helpMenu }];

    if (!this.state.hideMenu)
      return <Menu className="infoBoxMenu" spec={mainMenu}/>;
  }

  renderMainDialog() {
    return (
      <Floatable className="infoBox">
        {this.renderTrigger()}
        <img width="48" className="infoBoxLogo" src="3dt.ico"/>
        <h3 className="infoBoxHeader">Gavrog</h3>
        <span className="clearFix">
          {this.state.title}
          <br/>
          {this.state.log || "Welcome!"}
        </span>
        {this.renderMenu()}
      </Floatable>
    );
  }

  render() {
    const message = this.state.log || "Welcome!";

    return (
      <div>
        {this.render3d()}
        {this.renderMainDialog()}
      </div>
    );
  }
}


ReactDOM.render(<App/>, document.getElementById('react-main'));
