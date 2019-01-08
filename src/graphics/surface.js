import * as S from '../common/lazyseq';

import { floatMatrices } from '../arithmetic/types';
const ops = floatMatrices;


const pairs = as => S.seq(as).consecCirc(2).map(s => s.toArray()).toArray();
const sum = vs => vs.reduce((v, w) => ops.plus(v, w));
const corners = pos => idcs => idcs.map(i => pos[i]);
const centroid = pos => ops.div(sum(pos), S.seq(pos).length);
const normalized = v => ops.div(v, ops.norm(v));


export const tightened = ({ faces, pos, isFixed, faceLabels }) => {
  pos = pos.slice();

  for (let s = 0; s < 10; ++s) {
    const gradients = pos.map(v => ops.times(v, 0));

    for (const f of faces) {
      const m = f.length;
      for (let i = 0; i < m; ++i) {
        const u = f[i];
        const v = f[(i + 1) % m];
        const w = f[(i + 2) % m];

        const a = ops.minus(pos[u], pos[v]);
        const b = ops.minus(pos[w], pos[v]);
        const c = ops.minus(pos[w], pos[u]);
        const n = ops.crossProduct(b, a);
        const g = ops.div(ops.crossProduct(n, c), ops.norm(n));

        gradients[v] = ops.plus(gradients[v], g);
      }
    }

    pos = pos.map(
      (v, i) => isFixed[i] ? v : ops.plus(v, ops.times(0.1, gradients[i]))
    );
  }

  return { faces, pos, isFixed, faceLabels };
};


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


export const subD = ({ faces, pos, isFixed, faceLabels }) => {
  const n = pos.length;
  const m = faces.length;
  const { edges, lookup } = edgeIndexes(faces);

  if (faceLabels == null)
    faceLabels = [...faces.keys()];

  const newFaces = [];
  const newFaceLabels = [];
  for (let f = 0; f < faces.length; ++f) {
    const vs = faces[f];
    const edge = i => n + m + lookup[f][i];
    const prev = i => (i + vs.length - 1) % vs.length;

    for (let i = 0; i < vs.length; ++i) {
      newFaces.push([vs[i], edge(i), n + f, edge(prev(i))]);
      newFaceLabels.push(faceLabels[f]);
    }
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
    isFixed: isFixed.concat(ffix, efix),
    faceLabels: newFaceLabels
  };
};


const withCenterFaces = ({ faces, pos, isFixed, faceLabels }, fn) => {
  const newFaces = [];
  const newFaceLabels = [];
  const newPos = pos.slice();
  const newIsFixed = isFixed.slice();

  if (faceLabels == null)
    faceLabels = [...faces.keys()];

  for (let f = 0; f < faces.length; ++f) {
    const is = faces[f];
    const centerFace = fn(is.map(i => pos[i]));

    if (centerFace == null) {
      newFaces.push(is);
      newFaceLabels.push(faceLabels[f]);
    }
    else {
      const k = newPos.length;
      const m = centerFace.length;

      for (const v of centerFace) {
        newPos.push(v);
        newIsFixed.push(false);
      }

      newFaces.push(S.range(k, k + m).toArray());
      newFaceLabels.push(faceLabels[f]);
      for (let i = 0; i < m; ++i) {
        const j = (i + 1) % m;
        newFaces.push([is[i], is[j], j + k, i + k]);
        newFaceLabels.push(faceLabels[f]);
      }
    }
  }

  return {
    faces: newFaces,
    pos: newPos,
    isFixed: newIsFixed,
    faceLabels: newFaceLabels
  };
};


const faceNormal = vs => normalized(sum(
  pairs(vs).map(([v, w]) => ops.crossProduct(v, w))));


const projection = (normal, origin=ops.times(0, normal)) => p => {
  const d = ops.minus(p, origin);
  return ops.plus(origin,
                  ops.minus(d, ops.times(ops.times(normal, d), normal)));
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


const edgeCycle = faces => {
  const edgeLoc = {};

  for (let f = 0; f < faces.length; ++f) {
    const is = faces[f];
    for (let k = 0; k < is.length; ++k)
      edgeLoc[[is[k], is[(k + 1) % is.length]]] = [f, k];
  }

  return ([f0, k0]) => {
    const result = [];
    let [f, k] = [f0, k0];

    do {
      const is = faces[f];
      result.push([f, k]);
      [f, k] = edgeLoc[[is[k], is[(k + is.length - 1) % is.length]]];
    } while (f != f0 || k != k0);

    return result;
  };
};


const shrunkAt = ({ faces, pos }, wd, isCorner) => {
  const nextIndex = (f, i) => (i + 1) % faces[f].length;
  const endIndex = (f, i) => faces[f][nextIndex(f, i)];
  const isSplit = ([f, i]) => isCorner[endIndex(f, i)];
  const cycle = edgeCycle(faces);

  const newVertexForStretch = (v, hs) => {
    const ends = hs.map(([f, i]) => pos[endIndex(f, i)]);
    const c = centroid(
      ends.length > 2 ? ends.slice(1, -1) : corners(pos)(faces[hs[0][0]]));
    return insetPoint(pos[v], wd, ends[0], ends[ends.length-1], c);
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

  const seen = {};
  const mods = {};
  const newPos = [];

  for (let f = 0; f < faces.length; ++f) {
    const is = faces[f];

    for (let k = 0; k < is.length; ++k) {
      const v = is[k];

      if (!seen[v] && isCorner[v]) {
        seen[v] = true;

        for (const stretch of stretches(cycle([f, k]))) {
          newPos.push(newVertexForStretch(v, stretch));
          for (let j = 0; j < stretch.length - 1; ++j)
            mods[stretch[j]] = pos.length + newPos.length - 1;
        }
      }
    }
  }

  return {
    pos: newPos,
    faces: faces.map((is, f) => is.map((v, i) => mods[[f, i]] || v))
  };
};


const connectors = (oldFaces, newFaces) => {
  const result = [];

  for (let i = 0; i < oldFaces.length; ++i) {
    const isOld = oldFaces[i];
    const isNew = newFaces[i];

    for (let k = 0; k < isOld.length; ++k) {
      const k1 = (k + 1) % isOld.length;
      if (isOld[k] != isNew[k] && isOld[k1] != isNew[k1])
        result.push([isOld[k], isOld[k1], isNew[k1], isNew[k]]);
    }
  }

  return result;
};


export const insetAt = ({ faces, pos, isFixed, faceLabels }, wd, isCorner) => {
  const { pos: newPos, faces: modifiedFaces } =
    shrunkAt({ faces, pos, isFixed }, wd, isCorner);

  if (faceLabels == null)
    faceLabels = [...faces.keys()];

  return {
    faces: modifiedFaces.concat(connectors(faces, modifiedFaces)),
    pos: pos.concat(newPos),
    isFixed: isFixed.concat(newPos.map(i => true)),
    faceLabels
  };
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


export const beveledAt = (surfaceIn, wd, isCorner) => {
  let { faces, pos, isFixed, faceLabels } = surfaceIn;
  const { pos: newPos, faces: modifiedFaces } =
    shrunkAt({ faces, pos, isFixed }, wd, isCorner);

  if (faceLabels == null)
    faceLabels = [...faces.keys()];

  const edgeFaces = [];
  const seen = {};

  for (const [a, b, c, d] of connectors(faces, modifiedFaces)) {
    const [f, e] = seen[[b, a]] || [];
    if (e == null)
      seen[[a, b]] = [d, c];
    else
      edgeFaces.push([c, d, e, f]);
  }

  const m = {};
  for (const [a, b, c, d] of edgeFaces) {
    m[c] = b;
    m[a] = d;
  }

  return {
    faces: modifiedFaces.concat(edgeFaces).concat(cycles(m)),
    pos: pos.concat(newPos),
    isFixed: isFixed.concat(newPos.map(i => true)),
    faceLabels
  };
};


export const averageRadius = solids => {
  let sum = 0;
  let count = 0;

  for (const { pos, faces } of solids) {
    for (const vs of faces) {
      const corners = vs.map(v => pos[v]);
      const center = centroid(corners);

      for (const p of corners) {
        sum += ops.norm(ops.minus(center, p));
        count += 1;
      }
    }
  }

  return sum / count;
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
