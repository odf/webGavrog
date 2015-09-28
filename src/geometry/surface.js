import * as I from 'immutable';
import * as F from '../arithmetic/float';
import _M from '../arithmetic/matrix';
import _V from '../arithmetic/vector';

const M = _M(F, 0, 1);
const V = _V(F, 0);


const pairs = as => as.pop().zip(as.shift()).push([as.last(), as.first()]);

const corners = pos => idcs => idcs.map(i => pos.get(i));

const centroid = pos => V.scaled(1/I.List(pos).size, pos.reduce(V.plus));


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


const edgeIndexes = faces => {
  const edges    = faces.flatMap(is => pairs(is).filter(([v,w]) => v < w));
  const index    = I.Map(edges.map((e, i) => [I.List(e), i]));
  const findPair = ([v,w]) => index.get(I.List(v < w ? [v, w] : [w, v]));
  const lookup   = faces.map(is => pairs(is).map(findPair));

  return { edges, lookup }
};


export function subD({ pos, faces, isFixed }) {
  const n = pos.size;
  const m = faces.size;
  const { edges, lookup } = edgeIndexes(faces);

  const newFaces = faces.flatMap((vs, f) => {
    const edge = i => n + m + lookup.get(f).get(i);
    const prev = i => (i + vs.size - 1) % vs.size;
    return vs.map((v, i) => I.List([v, edge(i), n + f, edge(prev(i))]));
  });

  const ffix = I.Repeat(false, faces.size);
  const efix = edges.map(([v, w]) => isFixed.get(v) && isFixed.get(w));

  const efac = lookup
    .flatMap((a, f) => a.map(e => [e, f]))
    .groupBy(([e, f]) => e)
    .map(a => a.map(([e, f]) => f));

  const vnfc = newFaces.groupBy(f => f.get(0));

  const fpos = faces.map(corners(pos)).map(centroid);
  const epos = edges.map(([v, w], i) => {
    const p = I.List([pos.get(v), pos.get(w)])
      .concat(efix.get(i) ? I.List() : efac.get(i).map(v => fpos.get(v)));
    return centroid(p)
  });
  const vpos = pos.map((p, i) => {
    if (isFixed.get(i))
      return p;

    const sz = vnfc.get(i).size;
    const t = vnfc.get(i)
      .flatMap(f => [V.scaled( 2, epos.get(f.get(1) - n - m)),
                     V.scaled( 2, epos.get(f.get(3) - n - m)),
                     V.scaled(-1, fpos.get(f.get(2) - n))])
      .reduce(V.plus);
    return V.plus(V.scaled(1/(sz*sz), t), V.scaled((sz-3)/sz, p));
  });

  return {
    pos    : vpos.concat(fpos, epos),
    isFixed: isFixed.concat(ffix, efix),
    faces  : newFaces
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
    isFixed: I.Range(0,8).map(i => i < 4)
  }));
}
