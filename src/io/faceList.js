import { opModZ } from '../spacegroups/spacegroups';
import { buildDSymbol } from '../dsymbols/delaney';
import { minimal } from '../dsymbols/derived';
import * as common from './common';

import {
  coordinateChangesQ as opsQ,
  coordinateChangesF as opsF
} from '../geometry/types';


const mapFace = (face, toPrimitive) =>
  face.map(p => opsF.times(toPrimitive, opsF.point(p)));


const applyOpsToPoint = (p, offset, symOps, pointsEqFn) => {
  const inStabilizer = op => pointsEqFn(p, common.applyToPoint(op, p));
  const reps = common.cosetReps(symOps, inStabilizer);

  const images = {};

  for (let i = 0; i < reps.length; ++i) {
    for (const op of common.subgroup(symOps, inStabilizer))
      images[opModZ(opsQ.times(reps[i], op))] = offset + i;
  }

  const result = [];

  for (const r of reps) {
    const point = opsF.modZ(common.applyToPoint(r, p));

    const action = {};
    for (const op of symOps)
      action[op] = images[opModZ(opsQ.times(op, r))];

    result.push([ point, action ]);
  }

  return result;
};


const applyOpsToCorners = (rawFaces, symOps, pointsEqFn) => {
  const pos = [];
  const action = [];
  const faces = [];

  for (const rf of rawFaces) {
    const face = [];

    for (const p of rf) {
      const found = pos.findIndex(q => pointsEqFn(p, q));
      const index = found < 0 ? pos.length : found;

      if (found < 0) {
        for (const [p, a] of applyOpsToPoint(p, index, symOps, pointsEqFn)) {
          pos.push(p);
          action.push(a);
        }
      }

      const shift = opsF.minus(p, pos[index]).map(x => opsF.round(x));
      face.push({ index, shift });
    }

    faces.push(face);
  }

  return { pos, action, faces };
};


const compareFaces = (f1, f2) => {
  for (const i in f1) {
    const d = f1[i].index - f2[i].index;
    if (d != 0)
      return d;

    for (const j in f1[i].shift) {
      const d = f1[i].shift[j] - f2[i].shift[j];
      if (d != 0)
        return d;
    }
  }
  return false;
};


const normalizedFace = face => {
  let best = null;
  let bestShift = null;

  for (const i in face) {
    const s = face[i].shift;
    const fa = face.slice(i).concat(face.slice(0, i))
      .map(({ index, shift }) => ({ index, shift: opsF.minus(shift, s) }));
    const fb = [fa[0]].concat(fa.slice(1).reverse());

    if (best == null || compareFaces(fa, best) < 0) {
      best = fa;
      bestShift = s;
    }
    if (compareFaces(fb, best) < 0) {
      best = fb;
      bestShift = s;
    }
  }

  return { face: best, shift: bestShift };
};


const normalizedTile = tile => {
  const cmpPairs = (p, q) => (
    compareFaces(p.face, q.face) || opsF.cmp(p.shift, q.shift)
  );

  const cmpTiles = (ps, qs) => {
    for (let i = 0; i < ps.length; ++i) {
      const d = cmpPairs(ps[i], qs[i]);
      if (d)
        return d;
    }
    return 0;
  };

  let best = null;

  for (const { shift: s0 } of tile) {
    const mapped = (
      tile
        .map(({ face, shift }) => ({ face, shift: opsF.minus(shift, s0) }))
        .sort(cmpPairs)
    );
    if (best == null || cmpTiles(best, mapped) < 0)
      best = mapped;
  }

  return best;
};


const cornerAction = (pos, action) => (op, { index, shift }) => {
  const oldPos = opsF.plus(pos[index], shift);
  const newPos = common.applyToPoint(op, oldPos);
  const newIndex = action[index][op];

  return {
    index: newIndex,
    shift: opsF.minus(newPos, pos[newIndex]).map(x => opsF.round(x))
  }
};


const applyOpsToFaces = ({ pos, action, faces }, symOps) => {
  const apply = cornerAction(pos, action);
  const seen = {};
  const result = [];

  for (const f of faces) {
    for (const op of symOps) {
      const { face: fNew } = normalizedFace(f.map(e => apply(op, e)));
      const key = JSON.stringify(fNew);

      if (!seen[key]) {
        seen[key] = true;
        result.push(fNew);
      }
    }
  }

  return result;
};


const applyOpsToTiles = ({ pos, action, faces }, tiles, symOps) => {
  const apply = cornerAction(pos, action);
  const seen = {};
  const result = [];

  for (const t of tiles) {
    for (const op of symOps) {
      const mappedFaces = t.map(
        i => normalizedFace(faces[i].map(e => apply(op, e)))
      );
      const tNew = normalizedTile(mappedFaces);
      const key = JSON.stringify(tNew);

      if (!seen[key]) {
        seen[key] = true;
        result.push(tNew);
      }
    }
  }

  return result;
};


const normalized = v => opsF.div(v, opsF.norm(v));


const sectorNormals = vs => {
  const centroid = opsF.div(vs.reduce((v, w) => opsF.plus(v, w)), vs.length);

  return vs.map((v, i) => {
    const w = vs[(i + 1) % vs.length];
    return normalized(
      opsF.crossProduct(opsF.minus(w, v), opsF.minus(centroid, w)));
  });
};


const collectEdges = faces => {
  const facesAtEdge = {};

  faces.forEach((face, i) => {
    const n = face.length;
    const edges = face.map((v, i) => [v, face[(i + 1) % n]]);

    edges.forEach(([{index: v1, shift: s1}, {index: v2, shift: s2}], j) => {
      const key = JSON.stringify([v1, v2, opsF.minus(s2, s1)]);
      const keyInv = JSON.stringify([v2, v1, opsF.minus(s1, s2)]);

      if (facesAtEdge[key])
        facesAtEdge[key].push([i, j, false]);
      else if (facesAtEdge[keyInv])
        facesAtEdge[keyInv].push([i, j, true]);
      else
        facesAtEdge[key] = [[i, j, false]];
    });
  });

  return facesAtEdge;
};


const collectTileEdges = tile => {
  const facesAtEdge = {};

  tile.forEach(({ face, shift }, i) => {
    const n = face.length;
    const edges = face.map((v, i) => [v, face[(i + 1) % n]]);

    edges.forEach(([{index: v1, shift: s1}, {index: v2, shift: s2}], j) => {
      const key = JSON.stringify(
        [v1, v2, opsF.minus(s2, s1), opsF.plus(shift, s1)]
      );
      const keyInv = JSON.stringify(
        [v2, v1, opsF.minus(s1, s2), opsF.plus(shift, s2)]
      );

      if (facesAtEdge[key])
        facesAtEdge[key].push([i, j, false]);
      else if (facesAtEdge[keyInv])
        facesAtEdge[keyInv].push([i, j, true]);
      else
        facesAtEdge[key] = [[i, j, false]];
    });
  });

  return facesAtEdge;
};


const tilingBase = faces => {
  const pairings = [[], [], [], []];
  const faceOffsets = [];
  let offset = 1;

  for (const face of faces) {
    const n = face.length;

    for (let i = 0; i < 4 * n; i += 2)
      pairings[0].push([offset + i, offset + i + 1]);

    for (let i = 1; i < 2 * n; i += 2) {
      const i1 = (i + 1) % (2 * n);
      pairings[1].push([offset + i, offset + i1]);
      pairings[1].push([offset + i + 2 * n, offset + i1 + 2 * n]);
    }

    for (let i = 0; i < 2 * n; ++i)
      pairings[3].push([offset + i, offset + i + 2 * n]);

    faceOffsets.push(offset);
    offset += 4 * n;
  }

  return { pairings, faceOffsets, size: offset - 1 };
};


const op2PairingsForPlainMode = (corners, faces, offsets) => {
  const explicitFaces = faces.map(f => f.map(
    item => opsF.plus(opsF.vector(corners[item.index]), item.shift)));

  const normals = explicitFaces.map(sectorNormals)
  const facesAtEdge = collectEdges(faces);
  const getNormal = ([i, j, rev]) => opsF.times(normals[i][j], rev ? -1 : 1);

  const result = [];
  for (const key of Object.keys(facesAtEdge)) {
    const [v, w, s] = JSON.parse(key);
    const d = normalized(opsF.minus(opsF.plus(corners[w], s), corners[v]));
    const n0 = getNormal(facesAtEdge[key][0]);

    const incidences = facesAtEdge[key].map(([i, j, reverse]) => {
      const n = getNormal([i, j, reverse]);
      const angle = Math.acos(Math.max(-1, Math.min(1, opsF.times(n0, n))));

      if (opsF.determinant([d, n0, n]) < 0)
        return [i, j, reverse, 2 * Math.PI - angle];
      else
        return [i, j, reverse, angle];
    });

    incidences.sort((a, b) => a[3] - b[3]);
    const m = incidences.length;

    incidences.forEach(([face1, edge1, rev1, angle1], i) => {
      const [face2, edge2, rev2, angle2] = incidences[(i + 1) % m];
      const [offset1, size1] = [offsets[face1], faces[face1].length];
      const [offset2, size2] = [offsets[face2], faces[face2].length];

      let a, b, c, d;

      if (rev1) {
        const k = offset1 + 2 * (size1 + edge1);
        a = k + 1;
        b = k;
      } else {
        const k = offset1 + 2 * edge1;
        a = k;
        b = k + 1;
      }

      if (rev2) {
        const k = offset2 + 2 * edge2;
        c = k + 1;
        d = k;
      } else {
        const k = offset2 + 2 * (size2 + edge2);
        c = k;
        d = k + 1;
      }

      result.push([a, c]);
      result.push([b, d]);
    });
  }

  return result;
};


const op2PairingsForTileMode = (faces, offsets, tiles) => {
  const tilesAtFace = {};

  for (let i = 0; i < tiles.length; ++i) {
    for (const { face, shift } of tiles[i]) {
      const key = JSON.stringify(face);
      if (tilesAtFace[key] == null)
        tilesAtFace[key] = [];
      tilesAtFace[key].push([i, shift]);
    }
  }

  for (const key in tilesAtFace) {
    const n = tilesAtFace[key].length;
    if (n != 2)
      throw new Error(`Face is incident to ${n} tile(s).`);
  }

  for (let tIdx = 0; tIdx < tiles.length; ++tIdx) {
    const tile = tiles[tIdx];
    const facesAtEdge = collectTileEdges(tile);

    for (const key of Object.keys(facesAtEdge)) {
      const flist = facesAtEdge[key];
      if (flist.length != 2)
        throw new Error(`tile edge incident to ${flist.length} edge(s)`);

      const [[Da, Ea], [Db, Eb]] = flist.map(([fIdx, eIdx, rev]) => {
        const { face, shift } = tile[fIdx];
        const taf = tilesAtFace[JSON.stringify(face)];

        let t;
        if (taf[0][0] == tIdx && opsQ.eq(taf[0][1], shift))
          t = 0;
        else if (taf[1][0] == tIdx && opsQ.eq(taf[1][1], shift))
          t = 1;
        else
          throw new Error(`face-tile inconsistency`);

        return [ null, null ];
      });
    }
  }
};


const makeDSymbol = (dim, size, pairings) => {
  const s = pairings.map(p => {
    const r = [];
    for (const [D, E] of p) {
      r[D] = E;
      r[E] = D;
    }
    return r;
  });

  return buildDSymbol({
    dim,
    size,
    getS: (i, D) => s[i][D],
    getV: (i, D) => 1
  });
};


export const tilingFromFacelist = spec => {
  const { name, group } = spec;
  const { warnings, errors, ops, toPrimitive, gram } = common.fromSpec(spec);

  const pointsEq = common.pointsAreCloseModZ(gram, 0.001);

  const facesIn = spec.faces.map(face => mapFace(face, toPrimitive));
  const cornerData = applyOpsToCorners(facesIn, ops, pointsEq);
  const faces = applyOpsToFaces(cornerData, ops);

  const { pairings, faceOffsets, size } = tilingBase(faces);

  if (spec.tiles.length == 0)
    pairings[2] = op2PairingsForPlainMode(cornerData.pos, faces, faceOffsets);
  else {
    const tiles = applyOpsToTiles(cornerData, spec.tiles, ops);
    pairings[2] = op2PairingsForTileMode(faces, faceOffsets, tiles);
  }

  const cover = makeDSymbol(3, size, pairings);
  const symbol = minimal(cover);

  // TODO include original vertex positions in output

  return { name, group: group.name, symbol, cover, warnings, errors };
};
