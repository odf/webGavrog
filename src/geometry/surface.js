'use strict';

var I = require('immutable');
var F = require('../arithmetic/float');
var M = require('../arithmetic/matrix')(F, 0, 1);
var V = require('../arithmetic/vector')(F, 0);


var faceNormal = function faceNormal(vs) {
  vs = I.List(vs);

  var es = vs.pop().zip(vs.shift()).push([vs.last(), vs.first()]);
  var normal = es
    .map(function(e) { return V.crossProduct(e[0], e[1]); })
    .reduce(V.plus);

  return V.normalized(normal);
};


var faceNormals = function faceNormals(pos, faces) {
  return faces.map(function(idcs) {
    return faceNormal(idcs.map(function(i) { return pos.get(i); }));
  });
};


var vertexNormals = function vertexNormals(pos, faces, faceNormals) {
  var normals = pos.map(function(v) { return V.scaled(0, v); });

  I.Range(0, faces.size).forEach(function(i) {
    var n = faceNormals.get(i);
    faces.get(i).forEach(function(k) {
      normals = normals.set(k, V.plus(normals.get(k), n));
    });
  });

  return normals.map(V.normalized);
};


var pos = I.fromJS([[0,0,0], [0,0,1], [0,1,0], [0,1,1],
                    [1,0,0], [1,0,1], [1,1,0], [1,1,1]]).map(V.make);

var faces = I.fromJS([[0,1,3,2],[5,4,6,7],
                      [1,0,4,5],[2,3,7,6],
                      [0,2,6,4],[3,1,5,7]]);

var normals = faceNormals(pos, faces);

console.log(normals);

console.log(vertexNormals(pos, faces, normals));
