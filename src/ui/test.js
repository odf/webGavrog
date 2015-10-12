import * as React from 'react';

import * as delaney  from '../dsymbols/delaney';
import Display3d from './Display3d';
import makeScene from './makeScene';


const tilings = {
  dia: '<1.1:2 3:2,1 2,1 2,2:6,3 2,6>',
  pcu: '<1.1:1 3:1,1,1,1:4,3,4>'
};


const App = React.createClass({
  displayName: 'App',

  getInitialState() {
    const scene = makeScene(delaney.parse(tilings.dia));
    const camera = scene.getObjectByName('camera');
    return {
      scene: scene,
      camera: camera,
      cameraParameters: { distance: camera.position.z }
    };
  },

  handleResize(data) {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight
    });
  },

  componentDidMount() {
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  },

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },

  render() {
    return React.DOM.div(
      null,
      React.createElement(Display3d, {
        scene           : this.state.scene,
        camera          : this.state.camera,
        cameraParameters: this.state.cameraParameters,
        width           : this.state.width - 20,
        height          : this.state.height - 20
      }));
  }
});


React.render(React.createElement(App), document.getElementById('react-main'));
