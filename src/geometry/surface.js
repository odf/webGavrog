import * as I from 'immutable';
import * as F from '../arithmetic/float';
import _M from '../arithmetic/matrix';
import _V from '../arithmetic/vector';

const M = _M(F, 0, 1);
const V = _V(F, 0);


const faceNormal = function faceNormal(vs) {
  vs = I.List(vs);

  const es = vs.pop().zip(vs.shift()).push([vs.last(), vs.first()]);
  const normal = es
    .map(e => V.crossProduct(e[0], e[1]))
    .reduce(V.plus);

  return V.normalized(normal);
};


const faceNormals = function faceNormals(pos, faces) {
  return faces.map(idcs => faceNormal(idcs.map(i => pos.get(i))));
};


const vertexNormals = function vertexNormals(pos, faces, faceNormals) {
  let normals = pos.map(v => V.scaled(0, v));

  I.Range(0, faces.size).forEach(function(i) {
    const n = faceNormals.get(i);
    faces.get(i).forEach(function(k) {
      normals = normals.set(k, V.plus(normals.get(k), n));
    });
  });

  return normals.map(V.normalized);
};


const pos = I.fromJS([[0,0,0], [0,0,1], [0,1,0], [0,1,1],
                      [1,0,0], [1,0,1], [1,1,0], [1,1,1]]).map(V.make);

const faces = I.fromJS([[0,1,3,2],[5,4,6,7],
                        [1,0,4,5],[2,3,7,6],
                        [0,2,6,4],[3,1,5,7]]);

const normals = faceNormals(pos, faces);

console.log(normals);

console.log(vertexNormals(pos, faces, normals));
