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
  loadFile(event) {
    const files = event.target.files;
    const handleData = this.props.handleData;

    if (files[0]) {
      const reader = new FileReader();

      reader.onload = e => handleData(e.target.result);

      if (this.props.isBinary)
        reader.readAsArrayBuffer(files[0]);
      else
        reader.readAsText(files[0]);
    }
  }

  render() {
    return (
      <div>
        <p>{this.props.prompt || ""}</p>
        <input type="file" onChange={event => this.loadFile(event)}/>
      </div>
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
    window.addEventListener('resize', data => this.handleResize(data));
    this.setTiling(delaney.parse(tilings.fcu));
  }

  componentWillUnmount() {
    window.removeEventListener('resize', data => this.handleResize(data));
  }

  toggleMenu() {
    this.setState({ showMenu: !this.state.showMenu });
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
    const syms = Array.from(parseDSymbols(data))
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
    const tilingMenu = [
      { label: 'First' },
      { label: 'Prev' },
      { label: 'Next' },
      { label: 'Last' }];

    const mainMenu = [
      { label: 'File' },
      { label: 'Tiling', submenu: tilingMenu },
      { label: 'View' },
      { label: 'Options' },
      { label: 'Help' }];

    if (this.state.showMenu)
      return <Menu className="infoBoxMenu" spec={mainMenu}/>;
  }

  render() {
    const message = this.state.log || "Welcome!";

    return (
      <div>
        {this.render3d()}
        <Floatable className="infoBox">
          {this.renderTrigger()}
          <img width="48" className="infoBoxLogo" src="3dt.ico"/>
          <h3 className="infoBoxHeader">Gavrog</h3>
          <span className="clearFix">{message}</span>
          <Uploader handleData={data => this.handleFileData(data)}/>
          {this.renderMenu()}
        </Floatable>
      </div>
    );
  }
}


ReactDOM.render(<App/>, document.getElementById('react-main'));
