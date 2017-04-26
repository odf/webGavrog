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


const tilings = {
  pcu: '<1.1:1 3:1,1,1,1:4,3,4>',
  dia: '<1.1:2 3:2,1 2,1 2,2:6,3 2,6>',
  fcu: '<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'
};


class Uploader extends React.Component {
  componentDidMount() {
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = this.props.accept;
    input.multiple = this.props.multiple;
    input.addEventListener('change', event => this.loadFile(event));

    this._input = input;
  }

  loadFile(event) {
    const handleData = this.props.handleData;

    for (const file of event.target.files) {
      const reader = new FileReader();

      reader.onload = event => handleData(file, event.target.result);

      if (this.props.isBinary)
        reader.readAsDataURL(file);
      else
        reader.readAsText(file);
    }
  }

  render() {
    return (
      <button onClick={() => this._input.click()}>
        {this.props.prompt || 'Load'}
      </button>
    );
  }
}


class App extends React.Component {
  constructor() {
    super();
    this.state = {};
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

  setTiling(ds) {
    csp.go(function*() {
      try {
        const scene = yield makeScene(ds, s => this.log(s));
        const camera = scene.getObjectByName('camera');
        const cameraParameters = { distance: camera.position.z };

        this.setState({ scene, camera, cameraParameters });
      } catch(ex) { console.error(ex); }
    }.bind(this));
  }

  componentDidMount() {
    this.handleResize();
    this.resizeListener = data => this.handleResize(data);
    window.addEventListener('resize', this.resizeListener);
    this.setTiling(delaney.parse(tilings.fcu));
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeListener);
  }

  toggleMenu() {
    this.setState({ showMenu: !this.state.showMenu });
  }

  setLoaderState(onOff) {
    this.setState({ showLoader: onOff });
  }

  render3d() {
    if (this.state.scene != null)
      return (
        <Display3d scene            = {this.state.scene}
                   camera           = {this.state.camera}
                   cameraParameters = {this.state.cameraParameters}
                   width            = {this.state.width}
                   height           = {this.state.height}
                   />
      );
  }

  handleFileData(data) {
    const syms = Array.from(parseDSymbols(data));
    this.setLoaderState(false);
    this.setTiling(syms[0].symbol);
  }

  renderTrigger() {
    return (
      <div className="infoBoxTrigger"
           onClick={() => this.toggleMenu()}>
        {this.state.showMenu ? triangleUp : triangleDown}
      </div>
    );
  }

  renderMenu() {
    const fileMenu = [
      { label: 'Open...', action: () => this.setLoaderState(true) }];

    const tilingMenu = [
      { label: 'First', action: () => this.log('Tiling -> First') },
      { label: 'Prev', action: () => this.log('Tiling -> Prev') },
      { label: 'Next', action: () => this.log('Tiling -> Next') },
      { label: 'Last', action: () => this.log('Tiling -> Last') },
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

    if (this.state.showMenu)
      return <Menu className="infoBoxMenu" spec={mainMenu}/>;
  }

  renderMainDialog() {
    const message = this.state.log || "Welcome!";

    return (
      <Floatable className="infoBox">
        {this.renderTrigger()}
        <img width="48" className="infoBoxLogo" src="3dt.ico"/>
        <h3 className="infoBoxHeader">Gavrog</h3>
        <span className="clearFix">{message}</span>
        {this.renderMenu()}
        {this.renderLoader()}
      </Floatable>
    );
  }

  renderLoader() {
    if (this.state.showLoader)
      return (
        <Uploader handleData={(file, data) => this.handleFileData(data)}/>
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
