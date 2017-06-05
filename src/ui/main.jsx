import * as React    from 'react';
import * as ReactDOM from 'react-dom';
import * as csp      from 'plexus-csp';
import validate      from 'plexus-validate';

import Form          from '../plexus-form';

import * as version  from '../version';
import * as delaney  from '../dsymbols/delaney';
import parseDSymbols from '../io/ds';
import * as cgd      from '../io/cgd';

import Display3d     from './Display3d';
import Floatable     from './Floatable';
import Menu          from './Menu';
import makeScene     from './makeScene';


const tilings = [
  { name: 'bcu',
    symbol: delaney.parse('<1.1:2 3:2,1 2,1 2,2:4,4 2,6>')
  },
  { name: 'pcu',
    symbol: delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>')
  },
  { name: 'nbo',
    symbol: delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,4 2,4>')
  },
  { name: 'dia',
    symbol: delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>')
  },
  { name: 'srs',
    symbol: delaney.parse(`
      <1.1:10 3:2 4 6 8 10,10 3 5 7 9,10 9 8 7 6,4 3 10 9 8:10,3 2 2 2 2 3,10>
      `)
  }
];


const findName = data => (
  ((data.find(s => s.key == 'name') || {}).args || [])[0]);


const parseTilings = (filename, data, log) => {
  if (filename.match(/\.cgd$/)) {
    log('Parsing .cgd data...');
    return cgd.blocks(data)
              .filter(block => block.type == 'tiling')
              .map(block => ({ ...block, name: findName(block.content) }));
  }
  else if (filename.match(/\.ds$/))
    return Array.from(parseDSymbols(data));
  else
    return [];
};


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
    this.state = { windowsActive: {}, options: {} };
    this.loader = new FileLoader(this.handleFileData.bind(this));
    this.saver = new FileSaver();
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

  handleResize(data) {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight
    });
  }

  log(s) {
    this.setState({ log: s });
  }

  title(fname, index, len, name) {
    const prefix = fname ? `File "${fname}" ` : 'Tiling ';
    const postfix = name ? `: ${name}` : '';
    this.setState({ title: `${prefix}#${index} (of ${len})${postfix}` });
  }

  setTiling(i, symbolList) {
    csp.go(function*() {
      const syms = symbolList || this.state.syms;
      const n = syms.length;
      const index = i < 0 ? n + i % n : i % n;

      if (syms[index].symbol == null) {
        this.log('Converting face list data...');
        syms[index] = cgd.processed(syms[index]);
      }

      this.title(this.state.filename, index + 1, syms.length, syms[index].name);

      try {
        const scene = yield makeScene(
          syms[index].symbol,
          syms[index].cover,
          this.state.options,
          s => this.log(s));
        const camera = scene.getObjectByName('camera');
        const cameraParameters = { distance: camera.position.z };

        this.setState({ syms, index, scene, camera, cameraParameters });
      } catch(ex) { console.error(ex); }
    }.bind(this));
  }

  handleFileData(file, data) {
    this.setState({ filename: file.name });
    this.setTiling(0, parseTilings(file.name, data, s => this.log(s)));
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

  render3dScene() {
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
                   options          = {this.state.options}
                   ref              = {d => this.display = d}
                   />
      );
  }

  renderMenu() {
    const fileMenu = [
      { label: 'Open...', action: () => this.loader.select() },
      { label: 'Save Tiling...', action: () => this.saveTiling() },
      { label: 'Save Screenshot...', action: () => this.saveScreenshot() }
    ];

    const tilingMenu = [
      { label: 'First', action: () => this.setTiling(0) },
      { label: 'Prev', action: () => this.setTiling(this.state.index - 1) },
      { label: 'Next', action: () => this.setTiling(this.state.index + 1) },
      { label: 'Last', action: () => this.setTiling(-1) },
      { label: 'Jump...', action: () => this.showWindow('jump') },
      { label: 'Search...', action: () => this.showWindow('search') }
    ];

    const viewMenu = [
      { label: 'Center', action: () => this.display.center() },
      { label: 'Along X', action: () => this.display.viewAlongX() },
      { label: 'Along Y', action: () => this.display.viewAlongY() },
      { label: 'Along Z', action: () => this.display.viewAlongZ() }
    ];

    const helpMenu = [
      { label: 'About Gavrog...', action: () => this.showWindow('about') }
    ];

    const mainMenu = [
      { label: 'File',   submenu: fileMenu },
      { label: 'Tiling', submenu: tilingMenu },
      { label: 'View',   submenu: viewMenu },
      { label: 'Options...', action: () => this.showWindow('options') },
      { label: 'Help',   submenu: helpMenu }
    ];

    return <Menu className="infoBoxMenu" spec={mainMenu}/>;
  }

  renderMainDialog() {
    return (
      <Floatable className="infoBox">
        <img width="48" className="infoBoxLogo" src="3dt.ico"/>
        <h3 className="infoBoxHeader">Gavrog</h3>
        <span className="clearFix">
          {this.state.title}<br/>
          {this.state.log || "Welcome!"}
        </span>
        {this.renderMenu()}
      </Floatable>
    );
  }

  renderAboutDialog() {
    if (!this.state.windowsActive.about)
      return;

    return (
      <Floatable className="infoBox"
                 fixed={true}
                 x="c"
                 y="c"
                 onClick={() => this.hideWindow('about')}>
        <img width="48" className="infoBoxLogo" src="3dt.ico"/>
        <h3 className="infoBoxHeader">Gavrog for Web</h3>
        <span className="clearFix">
          by Olaf Delgado-Friedrichs 2017<br/>
          The Australian National University
        </span>
        <p>
          <b>Version:</b> 0.0.0 (pre-alpha)<br/>
          <b>Revision:</b> {version.gitRev}<br/>
          <b>Timestamp:</b> {version.gitDate}
        </p>
      </Floatable>
    );
  }

  handleJumpSubmit(data) {
    this.hideWindow('jump');

    if (data.number)
      this.setTiling(data.number - (data.number > 0));
  }

  renderJumpDialog() {
    if (!this.state.windowsActive.jump)
      return;

    const schema = {
      title: 'Jump to Tiling',
      type: 'object',
      properties: {
        number: {
          title: 'Index in file',
          type: 'integer'
        }
      }
    };

    return (
      <Floatable className="infoBox" x="c" y="c">
        <Form buttons={[]}
              enterKeySubmits="Jump"
              onSubmit={(data, val) => this.handleJumpSubmit(data, val)}
              validate={validate}
              schema={schema}>
        </Form>
      </Floatable>
    );
  }

  handleSearchSubmit(data, value) {
    this.hideWindow('search');

    if (value == "Cancel")
      return;

    if (data.name) {
      const i = this.state.syms.findIndex(s => s.name == data.name);
      if (i >= 0)
        this.setTiling(i);
      else
        this.log(`Name "${data.name}" not found.`);
    }
  }

  renderSearchDialog() {
    if (!this.state.windowsActive.search)
      return;

    const searchSchema = {
      title: 'Search Tiling',
      type: 'object',
      properties: {
        name: {
          title: 'Name of tiling',
          type: 'string'
        }
      }
    };

    return (
      <Floatable className="infoBox" x="c" y="c">
        <Form buttons={['Search', 'Cancel']}
              enterKeySubmits="Search"
              onSubmit={(data, val) => this.handleSearchSubmit(data, val)}
              validate={validate}
              schema={searchSchema}>
        </Form>
      </Floatable>
    );
  }

  handleOptionsSubmit(data, value) {
    this.hideWindow('options');

    if (value == "Cancel")
      return;

    this.setState((state, props) => ({ options: data }));
    this.setTiling(this.state.index);
  }

  renderOptionsDialog() {
    if (!this.state.windowsActive.options)
      return;

    const schema = {
      title: 'Options',
      description: 'Options',
      type: 'object',
      properties: {
        showNet: {
          title: 'Show Net',
          type: 'boolean'
        },
        extraSmooth: {
          title: 'Extra-Smooth Faces',
          type: 'boolean'
        },
        showSurfaceMesh: {
          title: 'Show Surface Mesh',
          type: 'boolean'
        },
        highlightPicked: {
          title: 'Highlight On Mouseover',
          type: 'boolean'
        }
      }
    };

    return (
      <Floatable className="infoBox" x="c" y="c">
        <Form buttons={['Apply', 'Cancel']}
              enterKeySubmits="Apply"
              onSubmit={(data, val) => this.handleOptionsSubmit(data, val)}
              validate={validate}
              schema={schema}
              values={this.state.options}>
        </Form>
      </Floatable>
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
