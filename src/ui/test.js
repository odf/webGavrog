'use strict';

var THREE = require('three');
var React = require('react');
var $     = React.DOM;

var Display3d = require('./Display3d');


var light = function(color, x, y, z) {
  var light = new THREE.PointLight(color);

  light.position.set(x, y, z);

  return light;
};


var makeCamera = function(distance) {
  var camera = new THREE.PerspectiveCamera(25, 1, 0.1, 10000);
  camera.name = 'camera';
  camera.position.z = 5*distance;

  camera.add(light(0xffffff,  3*distance,  5*distance, distance));
  camera.add(light(0x666666, -5*distance, -5*distance, distance));

  return camera;
};


var makeScene = function(model, camera) {
  var scene  = new THREE.Scene();

  if (!model) {
    var sphere = new THREE.SphereGeometry(1, 12, 6);
    var sphereMat = new THREE.MeshPhongMaterial({
      color    : 0xff0000,
      shininess: 50
    });
    var rod = new THREE.CylinderGeometry(0.5, 0.5, 4, 6);
    var rodMat = new THREE.MeshPhongMaterial({
      color    : 0x0000ff,
      shininess: 50
    });
    model = new THREE.Object3D();
    var s1 = new THREE.Mesh(sphere, sphereMat);
    s1.position.x = -2;
    model.add(s1);
    var s2 = new THREE.Mesh(sphere, sphereMat);
    s2.position.x = 2;
    model.add(s2);
    var t = new THREE.Mesh(rod, rodMat);
    t.rotation.z = 1.5707;
    model.add(t);
  }

  if (!camera)
    camera = makeCamera(3);

  scene.add(model);
  scene.add(camera);

  return scene;
};


var App = React.createClass({
  displayName: 'App',

  getInitialState: function() {
    var scene = makeScene();
    var camera = scene.getObjectByName('camera');
    return {
      scene: scene,
      camera: camera,
      cameraParameters: { distance: camera.position.z }
    };
  },

  handleResize: function(data) {
    this.setState({
      width: window.innerWidth,
      height: window.innerHeight
    });
  },

  componentDidMount: function() {
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  },

  componentWillUnmount: function() {
    window.removeEventListener('resize', this.handleResize);
  },

  render: function() {
    return $.div(
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
