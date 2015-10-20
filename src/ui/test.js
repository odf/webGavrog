import * as React from 'react';
import * as csp   from 'plexus-csp';

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
    return {};
  },

  handleResize(data) {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight
    });
  },

  componentDidMount() {
    const setState = this.setState.bind(this);

    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    csp.go(function*() {
      try {
        const scene = yield makeScene(delaney.parse(tilings.dia));
        const camera = scene.getObjectByName('camera');
        const cameraParameters = { distance: camera.position.z };

        setState({ scene, camera, cameraParameters });
      } catch(ex) { console.error(ex); }
    });
  },

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },

  render3d() {
    if (this.state.scene != null)
      return React.createElement(Display3d, {
        scene           : this.state.scene,
        camera          : this.state.camera,
        cameraParameters: this.state.cameraParameters,
        width           : this.state.width,
        height          : this.state.height
      });
  },

  render() {
    return React.DOM.div(
      null,
      this.render3d(),
      React.DOM.p(
        {
          style: {
            zIndex    : 10,
            position  : 'fixed',
            top       : '10px',
            right     : '10px',
            margin    : '0',
            background: 'lightyellow',
            border    : '1px solid lightgray',
            padding   : '5px'
          }
        },
        "Hello Gavrog!"
      ));
  }
});


React.render(React.createElement(App), document.getElementById('react-main'));
