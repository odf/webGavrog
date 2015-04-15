'use strict';

var I     = require('immutable');
var THREE = require('three');
var React = require('react');
var $     = React.DOM;

var R         = require('../arithmetic/float');
var vec       = require('../arithmetic/vector')(R, 0);
var delaney   = require('../dsymbols/delaney');
var tilings   = require('../dsymbols/tilings');
var periodic  = require('../pgraphs/periodic');

var Display3d = require('./Display3d');


var CoverVertex = I.Record({
  v: undefined,
  s: undefined
});

var graphPortion = function graphPortion(graph, start, dist) {
  var adj  = periodic.adjacencies(graph);

  var v0 = new CoverVertex({ v: start, s: vec.constant(graph.dim) });
  var vertices = I.Map([[v0, 0]]);
  var edges = I.Set();
  var thisShell = I.List([v0]);

  I.Range(1, dist+1).forEach(function(i) {
    var nextShell = I.Set();
    thisShell.forEach(function(v) {
      var i = vertices.get(v);

      adj.get(v.v).forEach(function(t) {
        var w = new CoverVertex({ v: t.v, s: vec.plus(v.s, vec.make(t.s)) });

        if (vertices.get(w) == null) {
          vertices = vertices.set(w, vertices.size);
          nextShell = nextShell.add(w);
        }

        var j = vertices.get(w);

        if (!edges.contains(I.List([i, j])) && !edges.contains(I.List([j, i])))
          edges = edges.add(I.List([i, j]));
      });
    });

    thisShell = nextShell;
  });

  var verts = I.List();
  vertices.keySeq().forEach(function(v) {
    verts = verts.set(vertices.get(v), v);
  });

  return {
    vertices: verts,
    edges   : edges.map(function(e) { return e.toArray(); })
  };
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
  var u = vec.normalized(vec.crossProduct(d, t));
  var v = vec.normalized(vec.crossProduct(d, u));
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
  name, positions, edges, ballRadius, stickRadius, ballMaterial, stickMaterial)
{
  var model = new THREE.Object3D();
  var ball  = new THREE.SphereGeometry(ballRadius, 16, 8);

  positions.forEach(function(p) {
    var s = new THREE.Mesh(ball, ballMaterial);
    s.position.x = p[0];
    s.position.y = p[1];
    s.position.z = p[2];
    model.add(s);
  });

  edges.forEach(function(e) {
    var u = vec.make(positions[e[0]]);
    var v = vec.make(positions[e[1]]);
    var s = stick(u, v, stickRadius, 8);
    s.computeVertexNormals();
    model.add(new THREE.Mesh(s, stickMaterial));
  });

  return model;
};


var light = function(color, x, y, z) {
  var light = new THREE.PointLight(color);

  light.position.set(x, y, z);

  return light;
};


var makeScene = function(model, camera) {
  var scene  = new THREE.Scene();

  var ballMaterial = new THREE.MeshPhongMaterial({
    color    : 0xff0000,
    shininess: 50
  });

  var stickMaterial = new THREE.MeshPhongMaterial({
    color    : 0x0000ff,
    shininess: 50
  });

  var ds  = delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>');
  var net = tilings.net(ds);
  var g   = graphPortion(net, 0, 3);
  var pos = periodic.barycentricPlacementAsFloat(net);
  var verts = g.vertices.map(function(v) {
    return vec.plus(vec.make(pos.get(v.v)), v.s).data.toJS();
  }).toArray();
  if (delaney.dim(ds) == 2)
    verts = verts.map(function(p) {
      return [p[0], p[1], 0];
    });

  var model = ballAndStick(
    'cube',
    verts,
    g.edges,
    0.1,
    0.05,
    ballMaterial,
    stickMaterial
  );

  var distance = 18;
  var camera = new THREE.PerspectiveCamera(25, 1, 0.1, 10000);
  camera.name = 'camera';
  camera.position.z = 5*distance;

  camera.add(light(0xffffff,  3*distance,  5*distance, distance));
  camera.add(light(0x666666, -5*distance, -5*distance, distance));

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
