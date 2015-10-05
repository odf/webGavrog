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

const projection = (normal, origin = V.scaled(0, normal)) => p => {
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


const halfEdgeReversals = faces => {
  const edges = dedupe(faces.flatMap(is => pairs(is).map(I.List)));
  const index = I.Map(edges.map((e, i) => [e, i]));
  const etofi = I.Map(faces.flatMap((is, f) => (
    pairs(is).map(([v, w], i) => (
      [I.List([v, w]), [f, i]])))));

  return faces.map(is => pairs(is).map(([v, w]) => etofi.get(I.List([w, v]))));
};


const halfEdgesByStartVertex = faces => faces
  .flatMap((is, f) => is.map((v, i) => [[f, i], v]))
  .groupBy(([_, v]) => v)
  .map(a => a.map(([p, _]) => p));


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


const flattened = vs => vs.map(projection(faceNormal(vs), centroid(vs)));

const scaled = (f, vs) => {
  const c = centroid(vs);
  return vs.map(v => V.plus(V.scaled(f, v), V.scaled(1-f, c)));
};


const withCenterFaces = ({ faces, pos, isFixed }, fn) => {
  const centerFaces = faces.map(corners(pos)).map(fn);
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


const bevelPoint = (corner, wd, left, right, center) => {
  const lft = V.normalized(V.minus(left, corner));
  const rgt = V.normalized(V.minus(right, corner));
  const dia = V.plus(lft, rgt);

  if (V.norm(dia) < 0.01) {
    return V.plus(corner, V.scaled(wd, V.normalized(V.minus(center, corner))));
  }
  else {
    const len = wd * V.norm(dia) / V.norm(projection(lft)(dia));
    const s   = V.normalized(V.crossProduct(dia, V.crossProduct(lft, rgt)));
    const t   = projection(s)(V.minus(center, corner));
    const f   = len / V.norm(t);
    return V.plus(corner, V.scaled(f, t));
  }
};


export function beveled(surface, wd) {
  return withCenterFaces(surface, vs => {
    const n = vs.size;
    const c = centroid(vs);

    return vs.map((v, i) => (
      bevelPoint(v, wd, vs.get((i + n - 1) % n), vs.get((i + 1) % n), c)));
  });
};


const steps = (start, next, endCond) => {
  const result = [];

  let current = start;
  do {
    result.push(current);
    current = next(current);
  } while (!endCond(current));
  result.push(current);

  return result;
};


export function beveledAt({ faces, pos, isFixed }, wd, isCorner) {
  const reversals = halfEdgeReversals(faces);
  const halfEdges = halfEdgesByStartVertex(faces);
  const faceSize  = f => faces.get(f).size;
  const nextIndex = (f, i) => (i + 1) % faceSize(f);
  const prevIndex = (f, i) => (i + faceSize(f) - 1) % faceSize(f);
  const endIndex  = (f, i) => faces.get(f).get(nextIndex(f, i));
  const isSplit   = ([f, i]) => isCorner.get(endIndex(f, i));
  const nextAtVtx = ([f, i]) => reversals.get(f).get(prevIndex(f, i));

  const modifications = I.List(halfEdges)
    .filter(([v]) => isCorner.get(v))
    .flatMap(([v, hs]) => hs.filter(isSplit).map(([f, i]) => {
      const edges = steps([f, i], nextAtVtx, isSplit);
      const pts   = edges.map(([f, i]) => pos.get(endIndex(f, i)));
      const bevel = bevelPoint(pos.get(v), wd, pts[0], pts[pts.length-1],
                               centroid(pts.slice(1, -1)));
      return [bevel, I.fromJS(edges.slice(0, -1))];
    }));

  const newPos = modifications.map(([p]) => p);
  const modsByHalfEdge = I.Map(
    modifications.flatMap(([p, hs], i) => hs.map(h => [h, i + pos.size])));

  const newFaces = faces.map((is, f) => (
    is.map((v, i) => modsByHalfEdge.get(I.List([f, i])) || v)));

  return {
    pos    : pos.concat(newPos),
    isFixed: pos.map(i => false).concat(newPos.map(i => true)),
    faces  : newFaces
  };
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

  const normals = faceNormals(cube.pos, cube.faces);

  console.log(normals);

  console.log(vertexNormals(cube.pos, cube.faces, normals));

  console.log(subD(cube));
  console.log(smooth(cube));
  console.log();

  const t = withFlattenedCenterFaces(cube);
  console.log(t);
  console.log();

  beveledAt(t, 0.1, I.Range(0, 8).map(i => true));
}
