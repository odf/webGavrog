import * as I from 'immutable';

import { floatMatrices } from '../arithmetic/types';
const ops = floatMatrices;


let _timers = null;

export const useTimers = timers => { _timers = timers };


const reductions = (xs, fn, init) =>
  xs.reduce((a, x) => a.push(fn(a.last(), x)), I.List([init]));

const pairs = as => as.pop().zip(as.shift()).push([as.last(), as.first()]);

const corners = pos => idcs => idcs.map(i => pos.get(i));

const plus = (v, w) => ops.plus(v, w)

const centroid = pos => ops.div(pos.reduce(plus), I.List(pos).size);

const dedupe = a => I.List(I.Set(a));

const normalized = v => ops.div(v, ops.norm(v));


const projection = (normal, origin = ops.times(0, normal)) => p => {
  const d = ops.minus(p, origin);
  return ops.plus(origin, ops.minus(d, ops.times(ops.times(normal, d), normal)));
};


const cycles = m => {
  const seen = {};
  const faces = [];

  m.keySeq().forEach(i => {
    if (!seen[i]) {
      const f = [];
      while (!seen[i]) {
        seen[i] = true;
        f.push(i);
        i = m.get(i);
      }
      faces.push(f);
    }
  });

  return I.fromJS(faces);
};


const faceNormal = vs => normalized(
  pairs(I.List(vs))
    .map(e => ops.crossProduct(e[0], e[1]))
    .reduce(plus)
);


export function faceNormals(pos, faces) {
  return faces.map(corners(pos)).map(faceNormal);
};


export function vertexNormals(pos, faces, faceNormals) {
  const normals = pos.map(v => ops.times(0, v)).asMutable();

  faces.forEach((f, i) => {
    const n = faceNormals.get(i);
    f.forEach(k => { normals.update(k, v => ops.plus(v, n)); });
  });

  return normals.map(normalized);
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
  const coord = (face, idx, factor) => ops.times(factor, pos.get(face.get(idx)));
  const facesByVertex = faces.groupBy(f => f.get(0));

  return pos.map((p, i) => {
    if (isFixed.get(i) || facesByVertex.get(i) == null)
      return p;

    const m = facesByVertex.get(i).size;
    const t = facesByVertex.get(i)
      .flatMap(f => [coord(f, 1, 2), coord(f, 3, 2), coord(f, 2, -1)])
      .reduce(plus);
    return ops.plus(ops.times(1/(m*m), t), ops.times((m-3)/m, p));
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
  return vs.map(v => ops.plus(ops.times(f, v), ops.times(1-f, c)));
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


const insetPoint = (corner, wd, left, right, center) => {
  const lft = normalized(ops.minus(left, corner));
  const rgt = normalized(ops.minus(right, corner));
  const dia = ops.plus(lft, rgt);

  if (ops.norm(dia) < 0.01) {
    const s = normalized(ops.minus(center, corner));
    const t = projection(lft)(s);
    return ops.plus(corner, ops.times(wd / ops.norm(t), s));
  }
  else {
    const len = wd * ops.norm(dia) / ops.norm(projection(lft)(dia));
    const s   = normalized(ops.crossProduct(dia, ops.crossProduct(lft, rgt)));
    const t   = projection(s)(ops.minus(center, corner));
    const f   = len / ops.norm(t);
    return ops.plus(corner, ops.times(f, t));
  }
};


const nextHalfEdgeAtVertex = faces => {
  const edgeLoc = I.Map().asMutable();

  faces.forEach((is, f) => {
    is.forEach((v, k) => {
      const w = is.get((k + 1) % is.size);
      edgeLoc.setIn([v, w], [f, k]);
    });
  });

  return ([f, i]) => {
    const is = faces.get(f);
    const v = is.get(i);
    const w = is.get((i + is.size - 1) % is.size);
    return edgeLoc.getIn([v, w]);
  };
};


const shrunkAt = ({ faces, pos, isFixed }, wd, isCorner) => {
  const nextIndex = (f, i) => (i + 1) % faces.get(f).size;
  const endIndex  = (f, i) => faces.get(f).get(nextIndex(f, i));
  const isSplit   = ([f, i]) => isCorner.get(endIndex(f, i));
  const nextAtVtx = nextHalfEdgeAtVertex(faces);

  const newVertexForStretch = (v, hs) => {
    const ends = hs.map(([f, i]) => pos.get(endIndex(f, i)));
    const c    = centroid(ends.length > 2 ?
                          ends.slice(1, -1) :
                          corners(pos)(faces.get(hs[0][0])));
    return insetPoint(pos.get(v), wd, ends[0], ends[ends.length-1], c);
  };

  const edgeCycle = ([f, k]) => {
    let e = [f, k];
    const hs = [];
    do {
      hs.push(e);
      e = nextAtVtx(e);
    } while(e[0] != f || e[1] != k);
    return hs;
  };

  const stretches = hs => {
    const splits = hs
      .map((e, i) => isSplit(e) ? i : null)
      .filter(i => i != null);
    return splits.map((k, i) => (
      i == 0 ?
        hs.slice(splits[splits.length-1]).concat(hs.slice(0, splits[0]+1)) :
        hs.slice(splits[i-1], splits[i]+1)));
  };

  const seen   = I.Set().asMutable();
  const mods   = I.Map().asMutable();
  const newPos = [];

  faces.forEach((is, f) => {
    is.forEach((v, k) => {
      if (seen.contains(v) || !isCorner.get(v))
        return;
      seen.add(v);

      stretches(edgeCycle([f, k])).forEach(stretch => {
        newPos.push(newVertexForStretch(v, stretch));
        for (let j = 0; j < stretch.length - 1; ++j)
          mods.set(I.List(stretch[j]), pos.size + newPos.length - 1);
      });
    });
  });

  const newFaces = faces.map(
    (is, f) => is.map((v, i) => mods.get(I.List([f, i])) || v));

  return {
    pos  : newPos,
    faces: newFaces
  };
};


const connectors = (oldFaces, newFaces) => {
  const result = I.List().asMutable();
  oldFaces.forEach((isOld, i) => {
    const isNew = newFaces.get(i);
    isOld.forEach((vo, k) => {
      const k1 = (k + 1) % isOld.size;
      if (vo != isNew.get(k) && isOld.get(k1) != isNew.get(k1))
        result.push([[vo, isOld.get(k1)], [isNew.get(k), isNew.get(k1)]]);
    });
  });
  return result.asImmutable();
};


export function insetAt({ faces, pos, isFixed }, wd, isCorner) {
  _timers && _timers.start("  insetAt(): shrinking");
  const { pos: newPos, faces: modifiedFaces } =
    shrunkAt({ faces, pos, isFixed }, wd, isCorner);
  _timers && _timers.stop("  insetAt(): shrinking");

  _timers && _timers.start("  insetAt(): computing new faces");
  const newFaces = connectors(faces, modifiedFaces)
    .map(([[vo, wo], [vn, wn]]) => I.List([vo, wo, wn, vn]));
  _timers && _timers.stop("  insetAt(): computing new faces");

  _timers && _timers.start("  insetAt(): putting things together");
  const result = {
    pos    : pos.concat(newPos),
    isFixed: isFixed.concat(newPos.map(i => true)),
    faces  : modifiedFaces.concat(newFaces)
  };
  _timers && _timers.stop("  insetAt(): putting things together");

  return result;
};


export function beveledAt({ faces, pos, isFixed }, wd, isCorner) {
  _timers && _timers.start("  beveledAt(): shrinking");
  const { pos: newPos, faces: modifiedFaces } =
    shrunkAt({ faces, pos, isFixed }, wd, isCorner);
  _timers && _timers.stop("  beveledAt(): shrinking");

  _timers && _timers.start("  beveledAt(): computing edge faces");
  const edgeFaces = I.List(
    connectors(faces, modifiedFaces)
      .map(([eo, en]) => [I.List(eo).sort(), I.List(en)])
      .groupBy(([eo]) => eo)
      .map(([[, a], [, b]]) => a.concat(b).reverse())
      .valueSeq());
  _timers && _timers.stop("  beveledAt(): computing edge faces");

  _timers && _timers.start("  beveledAt(): computing corner faces");
  const cornerFaces = cycles(I.Map(
    edgeFaces.flatMap(is => [[is.get(2), is.get(1)], [is.get(0), is.get(3)]])));
  _timers && _timers.stop("  beveledAt(): computing corner faces");

  _timers && _timers.start("  beveledAt(): putting things together");
  const result = {
    pos    : pos.concat(newPos),
    isFixed: isFixed.concat(newPos.map(i => true)),
    faces  : modifiedFaces.concat(edgeFaces).concat(cornerFaces)
  };
  _timers && _timers.stop("  beveledAt(): putting things together");

  return result;
};


export function standardized({ faces, pos, isFixed }) {
  return { faces, pos: pos.map(p => ops.toJS(p)), isFixed };
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return 'List [ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const cube = {
    pos: I.List([[0,0,0], [0,0,1], [0,1,0], [0,1,1],
                 [1,0,0], [1,0,1], [1,1,0], [1,1,1]]),
    faces: I.fromJS([[0,1,3,2],[5,4,6,7],
                     [1,0,4,5],[2,3,7,6],
                     [0,2,6,4],[3,1,5,7]]),
    isFixed: I.Range(0,8).map(i => i < 4)
  };

  const t = withFlattenedCenterFaces(cube);

  console.log(insetAt(t, 0.1, I.Range(0, 8).map(i => true)));
  console.log(beveledAt(cube, 0.1, I.Range(0, 8).map(i => true)));
}
