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
  camera.position.z = 4.5 * r;

  camera.add(light(0xffffff, 3.0 * r, 4.5 * r, r));
  camera.add(light(0x666666, -4.5 * r, -4.5 * r, r));

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
    return {
      scene: makeScene(),
      cameraParameters: { distance: 4.5 }
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
    var scene = this.state.scene;

    return $.div(
      null,
      React.createElement(Display3d, {
        scene           : scene,
        camera          : scene.getObjectByName('camera'),
        cameraParameters: this.state.cameraParameters,
        width           : this.state.width - 10,
        height          : this.state.height - 40
      }));
  }
});


React.render(React.createElement(App), document.getElementById('react-main'));
