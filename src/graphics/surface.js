import * as I from 'immutable';
import * as S from '../common/lazyseq';

import { floatMatrices } from '../arithmetic/types';
const ops = floatMatrices;


let _timers = null;

export const useTimers = timers => { _timers = timers };


const surfToJS = ({ faces, pos, isFixed }) => ({
  faces: faces.toJS(),
  pos: pos.toArray(),
  isFixed: isFixed.toJS()
});


const surfFromJS = ({ faces, pos, isFixed }) => ({
  faces: I.fromJS(faces),
  pos: I.List(pos),
  isFixed: I.fromJS(isFixed)
});


const pairs = as => S.seq(as).consecCirc(2).map(s => s.toArray()).toArray();
const sum = vs => vs.reduce((v, w) => ops.plus(v, w));
const corners = pos => idcs => idcs.map(i => pos[i]);
const centroid = pos => ops.div(sum(pos), S.seq(pos).length);
const normalized = v => ops.div(v, ops.norm(v));


const edgeIndexes = faces => {
  const edges = [];
  const edgeIndex = {};
  const lookup = {};

  for (let f = 0; f < faces.length; ++f) {
    const ps = pairs(faces[f]);
    lookup[f] = {};

    for (let i = 0; i < ps.length; ++i) {
      const [v, w] = ps[i].slice().sort();
      if (edgeIndex[[v, w]] == null) {
        edgeIndex[[v, w]] = edges.length;
        edges.push([v, w]);
      }
      lookup[f][i] = edgeIndex[[v, w]];
    }
  }

  return { edges, lookup };
};


const adjustedPositions = (faces, pos, isFixed) => {
  const coord = (face, idx, factor) => ops.times(factor, pos[face[idx]]);

  const facesByVertex = pos.map(_ => []);
  for (const f of faces)
    facesByVertex[f[0]].push(f);

  return pos.map((p, i) => {
    if (isFixed[i] || facesByVertex[i].length == 0)
      return p;

    const m = facesByVertex[i].length;

    let t = ops.times(0, pos[0]);
    for (const f of facesByVertex[i])
      t = ops.plus(t, sum([coord(f, 1, 2), coord(f, 3, 2), coord(f, 2, -1)]));

    return ops.plus(ops.times(1/(m*m), t), ops.times((m-3)/m, p));
  });
};


export const subD = ({ faces, pos, isFixed }) => {
  const n = pos.length;
  const m = faces.length;
  const { edges, lookup } = edgeIndexes(faces);

  const newFaces = [];
  for (let f = 0; f < faces.length; ++f) {
    const vs = faces[f];
    const edge = i => n + m + lookup[f][i];
    const prev = i => (i + vs.length - 1) % vs.length;

    for (let i = 0; i < vs.length; ++i)
      newFaces.push([vs[i], edge(i), n + f, edge(prev(i))]);
  }

  const ffix = Array(faces.length).fill(false);
  const fpos = faces.map(corners(pos)).map(centroid);

  const facesByEdge = {};
  for (const f of Object.keys(lookup)) {
    for (const e of Object.values(lookup[f])) {
      if (facesByEdge[e] == null)
        facesByEdge[e] = [f];
      else
        facesByEdge[e].push(f);
    }
  }

  const efix = edges.map(([v, w]) => isFixed[v] && isFixed[w]);
  const epos = edges.map(([v, w], i) => centroid(
    (efix[i] ? [] : facesByEdge[i].map(v => fpos[v]))
      .concat([pos[v], pos[w]])));

  return {
    faces: newFaces,
    pos: adjustedPositions(newFaces, pos.concat(fpos, epos), isFixed),
    isFixed: isFixed.concat(ffix, efix)
  };
};


const withCenterFaces = ({ faces, pos, isFixed }, fn) => {
  const newFaces = [];
  const newPos = pos.slice();
  const newIsFixed = isFixed.slice();

  for (const is of faces) {
    const centerFace = fn(is.map(i => pos[i]));

    if (centerFace == null)
      newFaces.push(is);
    else {
      const k = newPos.length;
      const m = centerFace.length;

      for (const v of centerFace) {
        newPos.push(v);
        newIsFixed.push(false);
      }

      newFaces.push(S.range(k, k + m).toArray());
      for (let i = 0; i < m; ++i) {
        const j = (i + 1) % m;
        newFaces.push([is[i], is[j], j + k, i + k]);
      }
    }
  }

  return { faces: newFaces, pos: newPos, isFixed: newIsFixed };
};


const faceNormal = vs => normalized(sum(
  pairs(vs).map(([v, w]) => ops.crossProduct(v, w))));


const projection = (normal, origin=ops.times(0, normal)) => p => {
  const d = ops.minus(p, origin);
  return ops.plus(origin, ops.minus(d, ops.times(ops.times(normal, d), normal)));
};


const flattenedOrSuppressedFace = vs => {
  const ws = vs.map(projection(faceNormal(vs), centroid(vs)));

  for (let i = 0; i < vs.length; ++i) {
    if (ops.norm(ops.minus(vs[i], ws[i])) > 0.01 * ops.norm(ws[i]))
      return ws;
  }

  return null;
};


const scaled = (f, vs) => {
  if (vs == null)
    return vs;

  const c = centroid(vs);
  return vs.map(v => ops.plus(ops.times(f, v), ops.times(1-f, c)));
};


export const withFlattenedCenterFaces = surface =>
  withCenterFaces(surface, vs => scaled(0.5, flattenedOrSuppressedFace(vs)));


const insetPoint = (corner, wd, left, right, center) => {
  const lft = normalized(ops.minus(left, corner));
  const rgt = normalized(ops.minus(right, corner));
  const dia = ops.plus(lft, rgt);

  if (ops.norm(dia) < 0.01) {
    const s = normalized(ops.minus(center, corner));
    const t = projection(lft)(s);
    return ops.plus(corner, ops.times(wd / ops.norm(t), s));
  }
  else if (ops.norm(ops.crossProduct(lft, rgt)) < 0.01) {
    return ops.plus(corner, ops.times(wd, lft));
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
  const edgeLoc = {};

  for (let f = 0; f < faces.length; ++f) {
    const is = faces[f];
    for (let k = 0; k < is.length; ++k)
      edgeLoc[[is[k], is[(k + 1) % is.length]]] = [f, k];
  }

  return ([f, i]) => {
    const is = faces[f];
    return edgeLoc[[is[i], is[(i + is.length - 1) % is.length]]];
  };
};


const shrunkAt = ({ faces, pos, isFixed }, wd, isCorner) => {
  const nextIndex = (f, i) => (i + 1) % faces.get(f).size;
  const endIndex  = (f, i) => faces.get(f).get(nextIndex(f, i));
  const isSplit   = ([f, i]) => isCorner.get(endIndex(f, i));
  const nextAtVtx = nextHalfEdgeAtVertex(faces.toJS());

  const newVertexForStretch = (v, hs) => {
    const ends = hs.map(([f, i]) => pos.get(endIndex(f, i)));
    const c    = centroid(ends.length > 2 ?
                          ends.slice(1, -1) :
                          corners(pos.toArray())(faces.get(hs[0][0])));
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


export const insetAt = (surf, wd, isCorner) => {
  const { faces, pos, isFixed } = surfFromJS(surf);
  const { pos: newPos, faces: modifiedFaces } =
    shrunkAt({ faces, pos, isFixed }, wd, I.fromJS(isCorner));

  const newFaces = connectors(faces, modifiedFaces)
    .map(([[vo, wo], [vn, wn]]) => I.List([vo, wo, wn, vn]));

  const result = {
    pos    : pos.concat(newPos),
    isFixed: isFixed.concat(newPos.map(i => true)),
    faces  : modifiedFaces.concat(newFaces)
  };

  return surfToJS(result);
};


const cycles = m => {
  const seen = {};
  const faces = [];

  for (const k of Object.keys(m)) {
    if (!seen[k]) {
      let i = parseInt(k);
      const f = [];
      while (!seen[i]) {
        seen[i] = true;
        f.push(i);
        i = m[i];
      }
      faces.push(f);
    }
  }

  return faces;
};


export const beveledAt = (surf, wd, isCorner) => {
  const { faces, pos, isFixed } = surfFromJS(surf);
  const { pos: newPos, faces: modifiedFaces } =
    shrunkAt({ faces, pos, isFixed }, wd, I.fromJS(isCorner));

  const edgeFaces = I.List(
    connectors(faces, modifiedFaces)
      .map(([eo, en]) => [I.List(eo).sort(), I.List(en)])
      .groupBy(([eo]) => eo)
      .map(([[, a], [, b]]) => a.concat(b).reverse())
      .valueSeq());

  const m = {};
  for (const is of edgeFaces) {
    const [a, b, c, d] = is.toArray();
    m[c] = b;
    m[a] = d;
  }

  const result = {
    pos    : pos.concat(newPos),
    isFixed: isFixed.concat(newPos.map(i => true)),
    faces  : modifiedFaces.concat(edgeFaces).concat(cycles(m))
  };

  return surfToJS(result);
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return 'List [ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const cube = {
    pos: [[0,0,0], [0,0,1], [0,1,0], [0,1,1],
          [1,0,0], [1,0,1], [1,1,0], [1,1,1]],
    faces: [[0,1,3,2],[5,4,6,7],
            [1,0,4,5],[2,3,7,6],
            [0,2,6,4],[3,1,5,7]],
    isFixed: Array(8).fill(0).map((_, i) => i < 4)
  };

  const t = withFlattenedCenterFaces(cube);

  console.log(insetAt(t, 0.1, Array(8).fill(true)));
  console.log();
  console.log(beveledAt(cube, 0.1, Array(8).fill(true)));
  console.log();
  console.log(subD(cube));
}
