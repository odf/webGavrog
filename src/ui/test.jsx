import * as React from 'react';
import * as csp   from 'plexus-csp';

import * as delaney  from '../dsymbols/delaney';
import Display3d from './Display3d';
import Floatable from './Floatable';
import makeScene from './makeScene';


const tilings = {
  dia: '<1.1:2 3:2,1 2,1 2,2:6,3 2,6>',
  pcu: '<1.1:1 3:1,1,1,1:4,3,4>'
};


const App = React.createClass({
  displayName: 'App',

  getInitialState() {
    return {};
  },

  handleResize(data) {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight
    });
  },

  log(s) {
    this.setState({ log: s });
  },

  componentDidMount() {
    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    csp.go(function*() {
      try {
        const scene = yield makeScene(delaney.parse(tilings.dia), this.log);
        const camera = scene.getObjectByName('camera');
        const cameraParameters = { distance: camera.position.z };

        this.setState({ scene, camera, cameraParameters });
      } catch(ex) { console.error(ex); }
    }.bind(this));
  },

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },

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
  },

  render() {
    const message = this.state.log || "Welcome!";

    return (
      <div>
        {this.render3d()}
        <Floatable className="infoBox">
          <img className="logo" src="3dt.ico"/>
          <h3 className="infoHeader">Gavrog</h3>
          {message}
        </Floatable>
      </div>
    );
  }
});


React.render(<App/>, document.getElementById('react-main'));
