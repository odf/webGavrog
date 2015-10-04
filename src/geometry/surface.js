import * as I from 'immutable';
import * as F from '../arithmetic/float';
import _M from '../arithmetic/matrix';
import _V from '../arithmetic/vector';

const M = _M(F, 0, 1);
const V = _V(F, 0);


const reductions = (xs, fn, init) =>
  xs.reduce((a, x) => a.push(fn(a.last(), x)), I.List([init]));

const pairs = as => as.pop().zip(as.shift()).push([as.last(), as.first()]);

const corners = pos => idcs => idcs.map(i => pos.get(i));

const centroid = pos => V.scaled(1/I.List(pos).size, pos.reduce(V.plus));

const dedupe = a => I.List(I.Set(a));

const projection = (origin, normal) => p => {
  const d = V.minus(p, origin);
  return V.plus(origin, V.minus(d, V.scaled(V.dotProduct(normal, d), normal)));
};


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
  const eKey     = ([v, w]) => I.List(v < w ? [v, w] : [w, v]);
  const edges    = dedupe(faces.flatMap(is => pairs(is).map(eKey)));
  const index    = I.Map(edges.map((e, i) => [e, i]));
  const findPair = ([v,w]) => index.get(eKey([v, w]));
  const lookup   = faces.map(is => pairs(is).map(findPair));

  return { edges, lookup }
};


const adjustedPositions = (faces, pos, isFixed) => {
  const coord = (face, idx, factor) => V.scaled(factor, pos.get(face.get(idx)));
  const facesByVertex = faces.groupBy(f => f.get(0));

  return pos.map((p, i) => {
    if (isFixed.get(i) || facesByVertex.get(i) == null)
      return p;

    const m = facesByVertex.get(i).size;
    const t = facesByVertex.get(i)
      .flatMap(f => [coord(f, 1, 2), coord(f, 3, 2), coord(f, 2, -1)])
      .reduce(V.plus);
    return V.plus(V.scaled(1/(m*m), t), V.scaled((m-3)/m, p));
  });
};


export function subD({ faces, pos, isFixed }) {
  const n = pos.size;
  const m = faces.size;
  const { edges, lookup } = edgeIndexes(faces);

  const newFaces = faces.flatMap((vs, f) => {
    const edge = i => n + m + lookup.get(f).get(i);
    const prev = i => (i + vs.size - 1) % vs.size;
    return vs.map((v, i) => I.List([v, edge(i), n + f, edge(prev(i))]));
  });

  const ffix = I.Repeat(false, faces.size);
  const fpos = faces.map(corners(pos)).map(centroid);

  const facesByEdge = lookup
    .flatMap((a, f) => a.map(e => [e, f]))
    .groupBy(([e, f]) => e)
    .map(a => a.map(([e, f]) => f));

  const efix = edges.map(([v, w]) => isFixed.get(v) && isFixed.get(w));
  const epos = edges.map(([v, w], i) => centroid(
    (efix.get(i) ? I.List() : facesByEdge.get(i).map(v => fpos.get(v)))
      .concat([pos.get(v), pos.get(w)])));

  return {
    pos    : adjustedPositions(newFaces, pos.concat(fpos, epos), isFixed),
    isFixed: isFixed.concat(ffix, efix),
    faces  : newFaces
  };
};


export function neighbors(faces) {
  return faces
    .flatMap(is => pairs(is).flatMap(([v, w]) => [[v, w], [w, v]]))
    .groupBy(([v, w]) => v)
    .map(a => dedupe(a.map(([v, w]) => w)))
  ;
};


export function smooth({ faces, pos, isFixed }) {
  const nbs = neighbors(faces);
  const newPositions = pos.map((p, i) => (
    isFixed.get(i) ? p : centroid(nbs.get(i).map(v => pos.get(v)))
  ));

  return {
    faces,
    pos: newPositions,
    isFixed
  };
};


const flattened = vs => vs.map(projection(centroid(vs), faceNormal(vs)));

const scaled = (f, vs) => {
  const c = centroid(vs);
  return vs.map(v => V.plus(V.scaled(f, v), V.scaled(1-f, c)));
};


const withCenterFaces = ({ faces, pos, isFixed }, fn) => {
  const centerFaces = faces
    .map(corners(pos))
    .map(vs => scaled(0.5, flattened(vs)));
  const offsets = reductions(centerFaces, (a, vs) => a + vs.size, pos.size);
  const extraPositions = centerFaces.flatten(1);

  const newFaces = faces.flatMap((is, f) => {
    const k = offsets.get(f);
    const m = is.size;
    const center = I.List(I.Range(k, k+m));
    const gallery = I.Range(0, m).map(i => {
      const j = (i + 1) % m;
      return I.List([is.get(i), is.get(j), j+k, i+k]); 
    });
    return I.List(gallery).push(center);
  });

  return {
    faces  : newFaces,
    pos    : pos.concat(extraPositions),
    isFixed: isFixed.concat(extraPositions.map(p => false))
  };
};


export function withFlattenedCenterFaces(surface) {
  return withCenterFaces(surface, vs => scaled(0.5, flattened(vs)));
};


if (require.main == module) {
  const cube = {
    pos: I.fromJS([[0,0,0], [0,0,1], [0,1,0], [0,1,1],
                   [1,0,0], [1,0,1], [1,1,0], [1,1,1]]).map(V.make),
    faces: I.fromJS([[0,1,3,2],[5,4,6,7],
                     [1,0,4,5],[2,3,7,6],
                     [0,2,6,4],[3,1,5,7]]),
    isFixed: I.Range(0,8).map(i => i < 4)
  };

  const cds = {
    pos: I.fromJS([
      [-1,-1,-2], [-1,-1, 0], [-1,-1, 2],
      [-1, 1,-2], [-1, 1, 0], [-1, 1, 2],
      [ 1,-1,-2], [ 1,-1, 0], [ 1,-1, 2],
      [ 1, 1,-2], [ 1, 1, 0], [ 1, 1, 2]
    ]).map(V.make),

    faces: I.fromJS([
      [  6,  7,  8,  2,  1,  0],
      [  3,  4,  5, 11, 10,  9],
      [  1,  2,  8,  7, 10, 11,  5,  4],
      [  7,  6,  0,  1,  4,  3,  9, 10]
    ]),

    isFixed: I.Range(0, 12).map(i => true)
  };

  const normals = faceNormals(cube.pos, cube.faces);

  console.log(normals);

  console.log(vertexNormals(cube.pos, cube.faces, normals));

  console.log(subD(cube));
  console.log(smooth(cube));
  console.log(withFlattenedCenterFaces(cds));
}
