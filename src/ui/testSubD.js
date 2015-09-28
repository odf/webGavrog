import * as I     from 'immutable';
import * as THREE from 'three';
import * as React from 'react';

import * as F from '../arithmetic/float';
import _V from '../arithmetic/vector';
const V = _V(F, 0);

import * as surface from '../geometry/surface';

import Display3d from './Display3d';


const geometry = function geometry(vertices, faces) {
  const geom = new THREE.Geometry();

  vertices.forEach(v => {
    geom.vertices.push(new THREE.Vector3(v[0], v[1], v[2]));
  });

  faces.forEach(function(f) {
    f.forEach(function(v, i) {
      if (i > 0 && i+1 < f.length)
        geom.faces.push(new THREE.Face3(f[0], f[i], f[i+1]));
    });
  });

  geom.computeFaceNormals();
  geom.computeVertexNormals();
  return geom;
};


const model = material => {
  const s0 = {
    pos: I.fromJS([[0,0,0], [0,0,1], [0,1,0], [0,1,1],
                   [1,0,0], [1,0,1], [1,1,0], [1,1,1]]).map(V.make),
    faces: I.fromJS([[0,1,3,2],[5,4,6,7],
                     [1,0,4,5],[2,3,7,6],
                     [0,2,6,4],[3,1,5,7]]),
    isFixed: I.Range(0, 8).map(i => i < 4)
  };
  const s = I.Range(0, 3).reduce(s => surface.subD(s), s0);

  return new THREE.Mesh(
    geometry(s.pos.map(v => v.data.toJS()), s.faces.toJS()),
    material);
};


const light = function(color, x, y, z) {
  const light = new THREE.PointLight(color);

  light.position.set(x, y, z);

  return light;
};


const apply = function(v, A) {
  return V.make(M.times(M.make([v.data]), A).data.first());
};


const makeScene = function() {
  const scene  = new THREE.Scene();

  const material = new THREE.MeshPhongMaterial({
    color    : 0x0000ff,
    shininess: 50
  });

  const distance = 3;
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 10000);
  camera.name = 'camera';
  camera.position.z = 5*distance;

  camera.add(light(0xffffff,  3*distance,  5*distance, distance));
  camera.add(light(0x666666, -5*distance, -5*distance, distance));

  const m = model(material);

  scene.add(m);
  scene.add(new THREE.WireframeHelper(m, 0x00ff00));
  scene.add(camera);

  return scene;
};


const App = React.createClass({
  displayName: 'App',

  getInitialState() {
    const scene = makeScene();
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
