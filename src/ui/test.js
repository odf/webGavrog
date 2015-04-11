'use strict';

var I     = require('immutable');
var THREE = require('three');
var React = require('react');
var $     = React.DOM;

var R     = require('../arithmetic/float');
var vec   = require('../arithmetic/vector')(R, 0);

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


var geometry = function geometry(vertices, faces) {
  var geom = new THREE.Geometry();

  vertices.forEach(function(v) {
    geom.vertices.push(new THREE.Vector3(v[0], v[1], v[2]));
  });

  faces.forEach(function(f) {
    f.forEach(function(v, i) {
      if (i > 0 && i+1 < f.length)
        geom.faces.push(new THREE.Face3(f[0], f[i], f[i+1]));
    });
  });

  geom.computeFaceNormals();
  return geom;
};


var stick = function stick(p, q, radius, segments) {
  var n = segments;
  var d = vec.normalized(vec.minus(q, p));
  var ex = vec.make([1,0,0]);
  var ey = vec.make([0,1,0]);
  var t = vec.dotProduct(d, ex) > 0.9 ? ey : ex;
  var u = vec.crossProduct(d, t);
  var v = vec.crossProduct(d, u);
  var a = Math.PI * 2 / n;

  var section = I.Range(0, n).map(function(i) {
    var x = a * i;
    var c = Math.cos(x) * radius;
    var s = Math.sin(x) * radius;
    return vec.plus(vec.scaled(c, u), vec.scaled(s, v));
  });

  return geometry(
    I.List().concat(section.map(function(c) { return vec.plus(c, p); }),
                    section.map(function(c) { return vec.plus(c, q); }))
      .map(function(v) { return v.data.toJS(); }),
    I.Range(0, n).map(function(i) {
      var j = (i + 1) % n;
      return [i, j, j+n, i+n];
    })
  );
}


var ballAndStick = function ballAndStick(
  name, positions, edges, ballMaterial, stickMaterial)
{
  var model = new THREE.Object3D();
  var ball  = new THREE.SphereGeometry(2, 16, 8);

  positions.forEach(function(p) {
    var s = new THREE.Mesh(ball, ballMaterial);
    s.position.x = p[0];
    s.position.y = p[1];
    s.position.z = p[2];
    model.add(s);
  });

  edges.forEach(function(e) {
    var u = e[0];
    var v = e[1];
    var s = stick(vec.make(positions[e[0]]), vec.make(positions[e[1]]), 1, 8);
    s.computeVertexNormals();
    model.add(new THREE.Mesh(s, stickMaterial));
  });

  return model;
};


var makeScene = function(model, camera) {
  var scene  = new THREE.Scene();

  if (!model) {
    var ballMaterial = new THREE.MeshPhongMaterial({
      color    : 0xff0000,
      shininess: 50
    });
    var stickMaterial = new THREE.MeshPhongMaterial({
      color    : 0x0000ff,
      shininess: 50
    });
    model = ballAndStick(
      'cube',
      [[-10,-10,-10], [-10,-10, 10], [-10, 10,-10], [-10, 10, 10],
       [ 10,-10,-10], [ 10,-10, 10], [ 10, 10,-10], [ 10, 10, 10]],
      [[0,1], [2,3], [4,5], [6,7],
       [0,2], [1,3], [4,6], [5,7],
       [0,4], [1,5], [2,6], [3,7]],
      ballMaterial,
      stickMaterial
    );
  }

  if (!camera)
    camera = makeCamera(18);

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
