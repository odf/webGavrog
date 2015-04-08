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


var makeCamera = function(model) {
  var camera = new THREE.PerspectiveCamera(25, 1, 0.1, 10000);
  var r = model ? model.geometry.boundingSphere.radius : 1;

  camera.name = 'camera';
  camera.position.z = 5*r;

  camera.add(light(0xffffff, 3*r, 5*r, r));
  camera.add(light(0x666666, -5*r, -5*r, r));

  return camera;
};


var makeScene = function(model, camera) {
  var scene  = new THREE.Scene();

  if (!model) {
    var geometry = new THREE.SphereGeometry(1, 32, 32);
    var material = new THREE.MeshPhongMaterial({
      color    : 0xff0000,
      shininess: 50
    });
    model = new THREE.Mesh(geometry, material);
  }

  if (!camera)
    camera = makeCamera(model);

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
