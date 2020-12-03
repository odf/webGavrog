import { floatMatrices } from '../arithmetic/types';
const ops = floatMatrices;


const range = (n, m) => [...Array(m - n).keys()].map(i => i + n);
const sum = vs => vs.reduce((v, w) => ops.plus(v, w));
const corners = pos => idcs => idcs.map(i => pos[i]);
const centroid = pos => ops.div(sum(pos), pos.length);
const normalized = v => ops.div(v, ops.norm(v));


const projection = (normal, origin=ops.times(0, normal)) => p => {
  const d = ops.minus(p, origin);
  return ops.plus(origin,
                  ops.minus(d, ops.times(ops.times(normal, d), normal)));
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


export const tightened = ({ faces, pos, isFixed, faceLabels }) => {
  const n = pos.length;

  const px = new Float32Array(n);
  const py = new Float32Array(n);
  const pz = new Float32Array(n);

  const gx = new Float32Array(n);
  const gy = new Float32Array(n);
  const gz = new Float32Array(n);

  for (let v = 0; v < n; ++v) {
    px[v] = pos[v][0];
    py[v] = pos[v][1];
    pz[v] = pos[v][2];
  }

  for (let s = 0; s < 100; ++s) {
    for (let v = 0; v < n; ++v)
      gx[v] = gy[v] = gz[v] = 0;

    for (const f of faces) {
      const m = f.length;
      for (let k = 0; k < m; ++k) {
        const u = f[k];
        const v = f[(k + 1) % m];
        const w = f[(k + 2) % m];

        const ax = px[u] - px[v];
        const ay = py[u] - py[v];
        const az = pz[u] - pz[v];

        const bx = px[w] - px[v];
        const by = py[w] - py[v];
        const bz = pz[w] - pz[v];

        const cx = px[w] - px[u];
        const cy = py[w] - py[u];
        const cz = pz[w] - pz[u];

        const nx = by * az - bz * ay;
        const ny = bz * ax - bx * az;
        const nz = bx * ay - by * ax;

        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);

        gx[v] += (ny * cz - nz * cy) / nl;
        gy[v] += (nz * cx - nx * cz) / nl;
        gz[v] += (nx * cy - ny * cx) / nl;
      }
    }

    for (let v = 0; v < n; ++v) {
      if (!isFixed[v]) {
        px[v] += 0.05 * gx[v];
        py[v] += 0.05 * gy[v];
        pz[v] += 0.05 * gz[v];
      }
    }
  }

  pos = [];
  for (let v = 0; v < n; ++v)
    pos.push([px[v], py[v], pz[v]]);

  return { faces, pos, isFixed, faceLabels };
};


export const subD = ({ faces, pos, isFixed, faceLabels }) => {
  const nrVerts = pos.length;
  const nrFaces = faces.length;

  const posNew = [...pos].concat(faces.map(corners(pos)).map(centroid));
  const fixedNew = [...isFixed].concat(faces.map(_ => false));
  const edgeIndex = {};
  const significantEdgeNeighbors = [];

  for (let f = 0; f < faces.length; ++f) {
    const vs = faces[f];
    const k = vs.length;

    for (let i = 0; i < k; ++i) {
      const [v, w] = [vs[i], vs[(i + 1) % k]];

      let e = edgeIndex[[v, w]];
      if (e == null) {
        e = edgeIndex[[v, w]] = edgeIndex[[w, v]] = posNew.length;
        posNew.push(centroid([pos[v], pos[w]]));
        fixedNew.push(isFixed[v] && isFixed[w]);
        significantEdgeNeighbors[e] = [v, w];
      }

      if (!fixedNew[e])
        significantEdgeNeighbors[e].push(f + nrVerts);
    }
  }

  for (let e = nrVerts + nrFaces; e < posNew.length; ++e)
    posNew[e] = centroid(significantEdgeNeighbors[e].map(v => posNew[v]));

  const facesNew = [];
  const fLabelsNew = [];
  const newFacesAtVertex = pos.map(_ => []);

  for (let f = 0; f < faces.length; ++f) {
    const vs = faces[f];
    const k = vs.length;

    for (let i = 0; i < k; ++i) {
      const [u, v, w] = [vs[(i + k - 1) % k], vs[i], vs[(i + 1) % k]];

      newFacesAtVertex[v].push(facesNew.length);
      facesNew.push([v, edgeIndex[[v, w]], f + nrVerts, edgeIndex[[u, v]]]);
      fLabelsNew.push(faceLabels ? faceLabels[f] : f);
    }
  }

  for (let v = 0; v < nrVerts; ++v) {
    if (!isFixed[v]) {
      let t = ops.times(0, pos[0]);
      for (const f of newFacesAtVertex[v]) {
        const p = facesNew[f].map(v => posNew[v]);
        t = ops.plus(t, ops.minus(ops.times(2, ops.plus(p[1], p[3])), p[2]));
      }
      const m = newFacesAtVertex[v].length;
      posNew[v] = ops.plus(ops.times(1/(m*m), t), ops.times((m-3)/m, pos[v]));
    }
  }

  return {
    faces: facesNew,
    pos: posNew,
    isFixed: fixedNew,
    faceLabels: fLabelsNew,
  };
}


export const withFlattenedCenterFaces = (
  { faces, pos, isFixed, faceLabels }
) => {
  const newFaces = [];
  const newFaceLabels = [];
  const newPos = pos.slice();
  const newIsFixed = isFixed.slice();

  for (let f = 0; f < faces.length; ++f) {
    const label = faceLabels ? faceLabels[f] : f;
    const vs = faces[f];
    const ps = vs.map(i => pos[i]);
    const center = centroid(ps);

    const normal = normalized(sum(
      ps.map((p, i) => ops.crossProduct(p, ps[(i + 1) % ps.length]))
    ));

    const qs = ps.map(projection(normal, center));

    const isFlat = ps.every((p, i) => ops.norm(ops.minus(p, qs[i])) <= 0.01);

    if (isFlat) {
      newFaces.push(vs);
      newFaceLabels.push(label);
    }
    else {
      const k = newPos.length;
      const m = qs.length;

      for (const v of qs) {
        newPos.push(centroid([center, v]));
        newIsFixed.push(false);
      }

      newFaces.push(range(k, k + m));
      newFaceLabels.push(label);
      for (let i = 0; i < m; ++i) {
        const j = (i + 1) % m;
        newFaces.push([vs[i], vs[j], j + k, i + k]);
        newFaceLabels.push(label);
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

    if (is.length < 3)
      throw new Error(`Tile face of length ${is.length} found, must be >= 3`);
    else {
      const s = is.slice().sort();
      if (s.some((n, i) => n == s[i + 1]))
        throw new Error(`Tile face with duplicate vertex found.`);
    }

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
