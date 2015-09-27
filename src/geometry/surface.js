import * as I from 'immutable';
import * as F from '../arithmetic/float';
import _M from '../arithmetic/matrix';
import _V from '../arithmetic/vector';

const M = _M(F, 0, 1);
const V = _V(F, 0);


const pairs = as => as.pop().zip(as.shift()).push([as.last(), as.first()]);

const corners = pos => idcs => idcs.map(i => pos.get(i));

const centroid = pos => V.scaled(1/pos.size, pos.reduce(V.plus));


const faceNormal = vs => V.normalized(
  pairs(I.List(vs))
    .map(e => V.crossProduct(e[0], e[1]))
    .reduce(V.plus)
);


export function faceNormals(pos, faces) {
  return faces.map(corners(pos)).map(faceNormal);
};


export function vertexNormals(pos, faces, faceNormals) {
  const normals = pos.map(v => V.scaled(0, v)).asMutable();

  faces.forEach((f, i) => {
    const n = faceNormals.get(i);
    f.forEach(k => { normals.update(k, v => V.plus(v, n)); });
  });

  return normals.map(V.normalized);
};


export function subD({ pos, faces, isFixed }) {
  const n        = pos.size;
  const m        = faces.size;
  const rPos     = pos.asMutable();
  const rIsFixed = isFixed.asMutable();

  faces.map(corners(pos)).map(centroid).forEach(v => rPos.push(v));
  I.Repeat(false, faces.size).forEach(x => rIsFixed.push(x));

  const rFaces    = I.List().asMutable();
  const edgeIndex = I.Map().asMutable();

  faces.forEach((vs, f) => {
    const k = vs.size;
    const edgePointIndices = [];

    pairs(vs).forEach(([v, w]) => {
      let e = edgeIndex.get(I.List([w, v]));
      if (e == null) {
        e = rPos.size;
        rPos.push(V.scaled(0.5, V.plus(pos.get(v), pos.get(w))));
        rIsFixed.push(isFixed.get(v) && isFixed.get(w));
      }
      edgeIndex.set(I.List([v, w]), e);
      edgePointIndices.push(e);
    });

    I.Range(0, k)
      .map(j => I.List([
        n + f,
        edgePointIndices[(j + k - 1) % k],
        vs.get(j),
        edgePointIndices[j]
      ]))
      .forEach(f => rFaces.push(f));
  });

  return {
    pos    : rPos.asImmutable(),
    faces  : rFaces.asImmutable(),
    isFixed: rIsFixed.asImmutable()
  };
};


if (require.main == module) {
  const pos = I.fromJS([[0,0,0], [0,0,1], [0,1,0], [0,1,1],
                        [1,0,0], [1,0,1], [1,1,0], [1,1,1]]).map(V.make);

  const faces = I.fromJS([[0,1,3,2],[5,4,6,7],
                          [1,0,4,5],[2,3,7,6],
                          [0,2,6,4],[3,1,5,7]]);

  const normals = faceNormals(pos, faces);

  console.log(normals);

  console.log(vertexNormals(pos, faces, normals));

  console.log(subD({
    pos,
    faces,
    isFixed: I.List(I.Repeat(true, 8))
  }));
}
