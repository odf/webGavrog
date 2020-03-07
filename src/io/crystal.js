import { lattices } from '../spacegroups/lattices';
import { opModZ, primitiveSetting } from '../spacegroups/spacegroups';
import * as unitCells from '../spacegroups/unitCells';

import { buildDSymbol } from '../dsymbols/delaney';
import * as derived from '../dsymbols/derived';

import { makeGraph } from '../pgraphs/periodic';
import fromPointCloud from '../pgraphs/fromPointCloud';

import {
  coordinateChangesQ as opsQ,
  coordinateChangesF as opsF
} from '../geometry/types';


const applyToVector = (op, vector) =>
  opsF.times(opsQ.toJS(opsQ.linearPart(op)), vector);


const applyToPoint = (op, point) => opsF.point(opsF.plus(
  applyToVector(op, opsF.vector(point)),
  opsQ.toJS(opsQ.shiftPart(op))
));


const dot = (v, w, gram) => {
  let s = 0;
  for (const i in v) {
    for (const j in w)
      s += v[i] * gram[i][j] * w[j];
  }
  return s;
};


const dotProduct = gram => (v, w) => dot(v, w, gram);


const pointsAreCloseModZ = (gram, maxDist) => {
  const limit = maxDist * maxDist;
  const eps = Math.pow(2, -40);
  const { dirichletVectors } = lattices(opsF, eps, dotProduct(gram));
  const vecs = dirichletVectors(opsF.identityMatrix(gram.length));

  return (p, q) => {
    const d = opsF.minus(p, q);
    let changed;

    do {
      changed = false;

      for (const v of vecs) {
        const t = dot(d, v, gram) / dot(v, v, gram);

        if (t < -0.5 || t > 0.5+eps) {
          const f = Math.round(t);

          for (let i = 0; i < d.length; ++i)
            d[i] -= f * v[i];

          changed = true;
        }
      }
    } while (changed);

    return dot(d, d, gram) < limit;
  };
};


const vectorsAreClose = (gram, maxDist) => {
  const limit = maxDist * maxDist;

  return (v, w) => {
    const d = opsF.minus(v, w);
    return dot(d, d, gram) < limit;
  };
};


const lookupPointModZ = (p, nodes, areEqualFn) => {
  for (const { pos: q, id: node } of nodes) {
    if (areEqualFn(p, q)) {
      const shift = opsF.minus(p, q).map(x => opsF.round(x));
      return { node, shift };
    }
  }

  return { pos: p };
};


const subgroup = (symOps, inSubgroup) => {
  const sub = symOps.filter(inSubgroup).map(opModZ);

  for (const a of sub) {
    for (const b of sub) {
      if (!inSubgroup(opsQ.times(a, b)))
        throw new Error('inconsistent subgroup condition');
    }
  }

  return sub;
};


const cosetReps = (symOps, inSubgroup) => {
  const sub = subgroup(symOps, inSubgroup);
  const seen = {};
  const result = [];

  for (const op of symOps) {
    if (!seen[opModZ(op)]) {
      result.push(op);

      for (const t of sub)
        seen[opModZ(opsQ.times(op, t))] = true;
    }
  }

  return result;
};


const applyOpsToNodes = (nodes, symOps, equalFn) => {
  const result = [];

  for (let repIndex = 0; repIndex < nodes.length; ++repIndex) {
    const v = nodes[repIndex];
    const point = v.positionPrimitive;
    const inStabilizer = op => equalFn(point, applyToPoint(op, point));

    for (const operator of cosetReps(symOps, inStabilizer)) {
      result.push({
        id: result.length,
        name: v.name,
        pos: opsF.modZ(applyToPoint(operator, point)),
        degree: v.coordination,
        repIndex,
        operator
      });
    }
  }

  return result;
};


const applyOpsToEdges = (edges, nodes, symOps, pointsEqFn, vectorsEqFn) => {
  const result = [];

  for (let repIndex = 0; repIndex < edges.length; ++repIndex) {
    const e = edges[repIndex];
    const src = e.from.positionPrimitive;
    const vec = opsF.minus(e.to.positionPrimitive, src);

    const inStabilizer = op => (
      pointsEqFn(src, applyToPoint(op, src)) &&
        vectorsEqFn(vec, applyToVector(op, vec))
    );

    for (const operator of cosetReps(symOps, inStabilizer)) {
      const from = opsF.modZ(applyToPoint(operator, src));
      const to = opsF.plus(from, applyToVector(operator, vec));

      result.push({
        from: lookupPointModZ(from, nodes, pointsEqFn),
        to: lookupPointModZ(to, nodes, pointsEqFn),
        repIndex,
        operator
      });
    }
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
        const images = {};
        const inStabilizer = op => pointsEqFn(p, applyToPoint(op, p));
        const reps = cosetReps(symOps, inStabilizer);

        for (const r of reps) {
          for (const op of subgroup(symOps, inStabilizer))
            images[opModZ(opsQ.times(r, op))] = pos.length;
          pos.push(opsF.modZ(applyToPoint(r, p)));
        }

        for (const r of reps) {
          const m = {};
          for (const op of symOps)
            m[op] = images[opModZ(opsQ.times(op, r))];
          action.push(m);
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
  const newPos = applyToPoint(op, oldPos);
  const newIndex = action[index][op];

  return {
    index: newIndex,
    shift: opsF.minus(newPos, pos[newIndex]).map(x => opsF.round(x))
  }
};


const applyOpsToFaces = (pos, action, faces, symOps) => {
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


const applyOpsToTiles = (pos, action, faces, tiles, symOps) => {
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


const op2PairingsForTileMode = (faces, offsets, tiles, tilesAtFace) => {
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


const convertEdge = ({ from, to }) =>
  [from.node, to.node, opsF.minus(to.shift, from.shift)];


const degreesSatisfied = (nodes, edges) => {
  const left = nodes.map(v => v.degree);
  for (const [i, j, _] of edges) {
    --left[i];
    --left[j];
  }

  return left.every(n => n <= 0);
};


const withInducedEdges = (nodes, givenEdges, gram) => {
  const pointAsFloat = pos => opsF.point(opsF.vector(pos));
  const nodesF = nodes.map(({ id, pos, degree }) =>
                           ({ id, pos: pointAsFloat(pos), degree }));
  return fromPointCloud(nodesF, givenEdges, dotProduct(gram));
};


const matrixError = (A, B) => opsF.norm(opsF.minus(A, B)) / opsF.norm(A);


const mapNode = coordChange => (
  ({ name, coordination, position }, i) => ({
    name,
    index: i,
    coordination,
    positionInput: position,
    positionPrimitive: opsF.modZ(opsF.times(coordChange, opsF.point(position)))
  })
);


const mapEdge = (coordChange, nodes) => {
  const mapEnd = p => {
    if (opsF.typeOf(p) == 'Vector') {
      return {
        positionInput: p,
        positionPrimitive: opsF.times(coordChange, opsF.point(p))
      }
    }
    else {
      const { positionInput, positionPrimitive } = (
        nodes.find(v => v.name == p) || {}
      );
      return { nodeGiven: p, positionInput, positionPrimitive };
    };
  };

  return ([from, to], index) => ({
    index,
    from: mapEnd(from),
    to: mapEnd(to)
  });
};


const commonFromSpec = spec => {
  const warnings = spec.warnings.slice();
  const errors = spec.errors.slice();

  if (spec.group.error) {
    errors.push(spec.group.error);
    return { warnings, errors };
  }

  const { operators } = spec.group;
  const cellGram = unitCells.symmetrizedGramMatrix(spec.cellGram, operators);

  if (matrixError(cellGram, spec.cellGram) > 0.01) {
    const parms = unitCells.unitCellParameters(cellGram);
    warnings.push(`Unit cell resymmetrized to ${parms}`);
  }

  const primitive = primitiveSetting(operators);
  const ops = primitive.ops;
  const cell = opsQ.toJS(primitive.cell);
  const toPrimitive = opsQ.toJS(primitive.fromStd.oldToNew);

  const gram = unitCells.symmetrizedGramMatrix(
    opsF.times(cell, opsF.times(cellGram, opsF.transposed(cell))),
    ops.map(op => opsQ.transposed(opsQ.linearPart(op)))
  );

  return { warnings, errors, ops, toPrimitive, gram };
};


export const netFromCrystal = spec => {
  const { warnings, errors, ops, toPrimitive, gram } = commonFromSpec(spec);

  const pointsEq = pointsAreCloseModZ(gram, 0.001);
  const vectorsEq = vectorsAreClose(gram, 0.001);

  const nodesIn = spec.nodes.map(mapNode(toPrimitive));
  const edgesIn = spec.edges.map(mapEdge(toPrimitive, nodesIn));
  const nodes = applyOpsToNodes(nodesIn, ops, pointsEq);
  const edgesRaw = applyOpsToEdges(edgesIn, nodes, ops, pointsEq, vectorsEq)

  let edges = edgesRaw.map(convertEdge);
  if (!degreesSatisfied(nodes, edges))
    edges = withInducedEdges(nodes, edges, gram);

  return {
    name: spec.name,
    group: spec.group.name,
    nodes,
    graph: makeGraph(edges),
    warnings,
    errors
  };
};


export const tilingFromFacelist = spec => {
  const { warnings, errors, ops, toPrimitive, gram } = commonFromSpec(spec);

  const facesIn = spec.faces.map(
    f => f.map(p => opsF.times(toPrimitive, opsF.point(p))));

  const pointsEq = pointsAreCloseModZ(gram, 0.001);
  const { pos, action, faces: codedFaces } =
    applyOpsToCorners(facesIn, ops, pointsEq);

  const faces = applyOpsToFaces(pos, action, codedFaces, ops);
  const { pairings, faceOffsets, size } = tilingBase(faces);

  if (spec.tiles.length == 0) {
    pairings[2] = op2PairingsForPlainMode(pos, faces, faceOffsets);
  }
  else {
    const tiles = applyOpsToTiles(pos, action, codedFaces, spec.tiles, ops);

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

    pairings[2] =
      op2PairingsForTileMode(faces, faceOffsets, tiles, tilesAtFace);
  }

  const ds = makeDSymbol(3, size, pairings);

  // TODO include original vertex positions in output

  return {
    name: spec.name,
    group: spec.group.name,
    symbol: derived.minimal(ds),
    cover: ds,
    warnings,
    errors
  };
};
