import * as spacegroups from '../geometry/spacegroups';
import { lattices } from '../geometry/lattices';
import * as sgtable from '../geometry/sgtable';
import * as unitCells from '../geometry/unitCells';
import * as pg from '../pgraphs/periodic';
import * as delaney from '../dsymbols/delaney';
import * as derived from '../dsymbols/derived';

import fromPointCloud from '../pgraphs/fromPointCloud';

import {
  coordinateChangesQ,
  coordinateChangesF
} from '../geometry/types';

const opsQ = coordinateChangesQ;
const opsF = coordinateChangesF;


let _timers = null;

export function useTimers(timers) {
  _timers = timers;
};


const matrixError = (A, B) => opsF.norm(opsF.minus(A, B)) / opsF.norm(A);
const flatMap = (fn, xs) => xs.reduce((t, x, i) => t.concat(fn(x, i)), []);


const applyToPoint = (op, point) => {
  const [M, t] = [opsQ.linearPart(op), opsQ.shiftPart(op)]
    .map(x => opsQ.toJS(x));

  return opsF.point(opsF.plus(opsF.times(M, opsF.vector(point)), t));
};


const applyToVector = (op, vector) =>
  opsF.times(opsQ.toJS(opsQ.linearPart(op)), vector);


const mapNode = coordinateChange => ({ name, coordination, position }, i) => ({
  name,
  index: i,
  coordination,
  positionInput: position,
  positionPrimitive: opsF.modZ(
    opsF.times(coordinateChange, opsF.point(position)))
});


const findNode = (nodes, name) => {
  for (const v of nodes)
    if (v.name == name)
      return v;
};


const mapEnd = (coordinateChange, nodes) => p => {
  if (opsF.typeOf(p) == 'Vector') {
    return {
      positionInput: p,
      positionPrimitive: opsF.times(coordinateChange, opsF.point(p))
    }
  }
  else {
    const { positionInput, positionPrimitive } = findNode(nodes, p) || {};
    return { nodeGiven: p, positionInput, positionPrimitive };
  };
};


const mapEdge = (coordinateChange, nodes) => {
  const emap = mapEnd(coordinateChange, nodes);

  return ([from, to], index) => ({
    index,
    from: emap(from),
    to: emap(to)
  });
};


const dotProduct = gram => (v, w) => {
  let s = 0;
  for (const i in v)
    for (const j in w)
      s += v[i] * gram[i][j] * w[j];
  return s;
};


const shiftIntoDirichletDomain = (pos, dirichletVecs, dot) => {
  const eps = Math.pow(2, -40);
  const adjust = (p, v, f) => p.map((x, i) => x - f * v[i]);
  const vecsWithLengths = dirichletVecs.map(v => [v, dot(v, v)]);

  let p = pos.slice();
  let changed;

  do {
    changed = false;

    for (const [v, lv] of vecsWithLengths) {
      const t = dot(p, v) / lv;
      if (t < -0.5 || t > 0.5+eps) {
        p = adjust(p, v, Math.round(t));
        changed = true;
      }
    }
  } while (changed);

  return p;
};


const pointsAreCloseModZ = (gram, maxDist) => {
  const n = gram.length;
  const limit = maxDist * maxDist;
  const dot = dotProduct(gram);
  const eps = Math.pow(2, -40);
  const { dirichletVectors } = lattices(opsF, eps, dot);

  const vecs = dirichletVectors(opsF.identityMatrix(n));

  return (p, q) => {
    _timers && _timers.start("pointsAreCloseModZ");

    const d0 = p.coords.map((x, i) => (x - q.coords[i]) % 1);
    const d = shiftIntoDirichletDomain(d0, vecs, dot);
    const result = dot(d, d) < limit;

    _timers && _timers.stop("pointsAreCloseModZ");

    return result;
  };
};


const vectorsAreClose = (gram, maxDist) => {
  const n = gram.length;
  const limit = maxDist * maxDist;
  const dot = dotProduct(gram);

  return (v, w) => {
    const d = opsF.minus(v, w);
    return dot(d, d) < limit;
  };
};


const lookupPointModZ = (p, nodes, areEqualFn) => {
  for (const i in nodes) {
    const q = nodes[i].pos;
    if (areEqualFn(p, q)) {
      return {
        node: nodes[i].id,
        shift: opsF.minus(p, q).map(x => opsF.round(x))
      };
    }
  }

  return { pos: p };
};


const operatorCosets = (symOps, subgroup) => {
  const seen = {};
  const result = [];

  for (const op of symOps) {
    if (!seen[spacegroups.opModZ(op)]) {
      result.push(op);
      for (const t of subgroup) {
        seen[spacegroups.opModZ(opsQ.times(op, t))] = true;
      }
    }
  }

  return result;
};


const pointStabilizer = (point, symOps, areEqualFn) => {
  const stabilizer = symOps.filter(
    op => areEqualFn(point, applyToPoint(op, point)));

  for (const A of stabilizer) {
    for (const B of stabilizer) {
      const ABi = opsQ.times(A, opsQ.inverse(B));
      if (!areEqualFn(point, applyToPoint(ABi, point)))
        return null;
    }
  }

  return stabilizer.map(spacegroups.opModZ);
};


const edgeStabilizer = (pos, vec, symOps, pointsEqualFn, vectorsEqualFn) => {
  const goodOp = op =>
    pointsEqualFn(pos, applyToPoint(op, pos)) &&
    vectorsEqualFn(vec, applyToVector(op, vec));

  const stabilizer = symOps.filter(goodOp);

  for (const A of stabilizer) {
    for (const B of stabilizer) {
      if (!goodOp(opsQ.times(A, opsQ.inverse(B)))) {
        return null;
      }
    }
  }

  return stabilizer.map(spacegroups.opModZ);
};


const nodeImages = (symOps, equalFn) => (v, index) => {
  const { name, coordination, positionInput, positionPrimitive } = v;
  const stabilizer = pointStabilizer(positionPrimitive, symOps, equalFn);
  const cosetReps = operatorCosets(symOps, stabilizer);

  return cosetReps.map(op => ({
    name,
    pos: opsF.modZ(applyToPoint(op, positionPrimitive)),
    degree: coordination,
    repIndex: index,
    operator: op
  }));
};


const edgeImages = (symOps, nodes, pntsEqualFn, vecsEqualFn) => (e, index) => {
  const { from: { positionPrimitive: src },
          to: { positionPrimitive: dst } } = e;
  const vec = opsF.minus(dst, src);

  const stabilizer = edgeStabilizer(
    src, vec, symOps, pntsEqualFn, vecsEqualFn)

  const cosetReps = operatorCosets(symOps, stabilizer);

  return cosetReps
    .map(operator => {
      const from = opsF.modZ(applyToPoint(operator, src));
      const to = opsF.plus(from, applyToVector(operator, vec));

      return {
        from: lookupPointModZ(from, nodes, pntsEqualFn),
        to: lookupPointModZ(to, nodes, pntsEqualFn),
        repIndex: index,
        operator
      };
    });
};


const applyOpsToNodes = (nodes, symOps, equalFn) =>
      flatMap(nodeImages(symOps, equalFn), nodes)
      .map((obj, id) => Object.assign({ id }, obj));


const applyOpsToEdges = (edges, nodes, symOps, pointsEqFn, vectorsEqFn) =>
      flatMap(edgeImages(symOps, nodes, pointsEqFn, vectorsEqFn), edges)
      .map((obj, id) => Object.assign({ id }, obj));


const applyOpsToCorners = (rawFaces, symOps, pointsEqFn) => {
  _timers && _timers.start("applyOpsToCorners");

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
        const stabilizer = pointStabilizer(p, symOps, pointsEqFn);
        const reps = operatorCosets(symOps, stabilizer);

        for (const r of reps) {
          for (const op of stabilizer)
            images[spacegroups.opModZ(opsQ.times(r, op))] = pos.length;
          pos.push(opsF.modZ(applyToPoint(r, p)));
        }

        for (const r of reps) {
          const m = {};
          for (const op of symOps)
            m[op] = images[spacegroups.opModZ(opsQ.times(op, r))];
          action.push(m);
        }
      }

      const shift = opsF.minus(p, pos[index]).map(x => opsF.round(x));
      face.push({ index, shift });
    }

    faces.push(face);
  }

  _timers && _timers.stop("applyOpsToCorners");
  return { pos, action, faces };
};


const compareFaces = (f1, f2) => {
  for (const i in f1) {
    const d = f1[i].index - f2[i].index;
    if (d != 0)
      return d < 0;

    for (const j in f1[i].shift) {
      const d = f1[i].shift[j] - f2[i].shift[j];
      if (d != 0)
        return d < 0;
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

    if (best == null || compareFaces(fa, best)) {
      best = fa;
      bestShift = s;
    }
    if (compareFaces(fb, best)) {
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


const _cornerAction = (pos, action) => (op, { index, shift }) => {
  const oldPos = opsF.plus(pos[index], shift);
  const newPos = applyToPoint(op, oldPos);
  const newIndex = action[index][op];

  return {
    index: newIndex,
    shift: opsF.minus(newPos, pos[newIndex]).map(x => opsF.round(x))
  }
};


const applyOpsToFaces = (pos, action, faces, symOps) => {
  _timers && _timers.start("applyOpsToFaces");

  const apply = _cornerAction(pos, action);
  const seen = {};
  const result = [];

  for (const f of faces) {
    for (const op of symOps) {
      const fNew = normalizedFace(f.map(e => apply(op, e)));
      const key = JSON.stringify(fNew.face);

      if (!seen[key]) {
        seen[key] = true;
        result.push(fNew);
      }
    }
  }

  _timers && _timers.stop("applyOpsToFaces");

  return result;
};


const applyOpsToTiles = (pos, action, faces, tiles, symOps) => {
  _timers && _timers.start("applyOpsToTiles");

  const apply = _cornerAction(pos, action);
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

  _timers && _timers.stop("applyOpsToTiles");

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

  faces.forEach(({ face, shift }, i) => {
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


const op2PairingsForPlainMode = (corners, faces, offsets) => {
  const explicitFaces = faces.map(f => f.face.map(
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
      const [offset1, size1] = [offsets[face1], faces[face1].face.length];
      const [offset2, size2] = [offsets[face2], faces[face2].face.length];

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


const tilingBase = faces => {
  const pairings = [[], [], [], []];
  const faceOffsets = [];
  let offset = 1;

  for (const { face } of faces) {
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


export function netFromCrystal(spec) {
  _timers && _timers.start('netFromCrystal');

  const { name, group, cellGram: G0, nodes, edges } = spec;
  const warnings = spec.warnings.slice();
  const errors = spec.errors.slice();

  if (group.error) {
    errors.push(group.error);
    return { warnings, errors };
  }

  const { name: groupName, transform, operators } = group;
  const cellGram = unitCells.symmetrizedGramMatrix(G0, operators);
  if (matrixError(cellGram, G0) > 0.01) {
    const parms = unitCells.unitCellParameters(cellGram);
    warnings.push(`Unit cell resymmetrized to ${parms}`);
  }

  const primitive = spacegroups.primitiveSetting(operators);
  const primitiveCell = opsQ.toJS(primitive.cell);
  const toPrimitive = opsQ.toJS(primitive.fromStd.oldToNew);
  const primitiveGram = unitCells.symmetrizedGramMatrix(
    opsF.times(primitiveCell,
               opsF.times(cellGram, opsF.transposed(primitiveCell))),
    primitive.ops.map(op => opsQ.transposed(opsQ.linearPart(op))));

  const nodesMapped = nodes.map(mapNode(toPrimitive));
  const edgesMapped = edges.map(mapEdge(toPrimitive, nodesMapped));

  const pointsEq = pointsAreCloseModZ(primitiveGram, 0.001);
  const vectorsEq = vectorsAreClose(primitiveGram, 0.001);

  const allNodes = applyOpsToNodes(
    nodesMapped, primitive.ops, pointsEq);
  const explicitEdges = applyOpsToEdges(
    edgesMapped, allNodes, primitive.ops, pointsEq, vectorsEq);

  const convertedEdges = explicitEdges.map(convertEdge);
  const allEdges = degreesSatisfied(allNodes, convertedEdges)
    ? convertedEdges
    : withInducedEdges(allNodes, convertedEdges, primitiveGram);
  const graph = pg.make(allEdges);

  _timers && _timers.stop('netFromCrystal');

  return {
    name,
    group: group.name,
    nodes: allNodes,
    graph,
    warnings,
    errors
  };
};


export const tilingFromFacelist = spec => {
  _timers && _timers.start('tilingFromFacelist');

  const { name, group, cellGram: G0, faces, tiles } = spec;
  const warnings = spec.warnings.slice();
  const errors = spec.errors.slice();

  if (group.error) {
    errors.push(group.error);
    return { warnings, errors };
  }

  const { name: groupName, transform, operators } = group;
  const cellGram = unitCells.symmetrizedGramMatrix(G0, operators);
  if (matrixError(cellGram, G0) > 0.01) {
    const parms = unitCells.unitCellParameters(cellGram);
    warnings.push(`Unit cell resymmetrized to ${parms}`);
  }

  const primitive = spacegroups.primitiveSetting(operators);
  const primitiveCell = opsQ.toJS(primitive.cell);
  const toPrimitive = opsQ.toJS(primitive.fromStd.oldToNew);
  const primitiveGram = unitCells.symmetrizedGramMatrix(
    opsF.times(primitiveCell,
               opsF.times(cellGram, opsF.transposed(primitiveCell))),
    primitive.ops.map(op => opsQ.transposed(opsQ.linearPart(op))));

  const facesMapped = faces.map(
    f => f.map(p => opsF.times(toPrimitive, opsF.point(p))));

  const pointsEq = pointsAreCloseModZ(primitiveGram, 0.001);
  const { pos, action, faces: codedFaces } =
    applyOpsToCorners(facesMapped, primitive.ops, pointsEq);

  let ds;

  if (tiles.length == 0) {
    const allFaces = applyOpsToFaces(pos, action, codedFaces, primitive.ops);
    const { pairings, faceOffsets, size } = tilingBase(allFaces);
    pairings[2] = op2PairingsForPlainMode(pos, allFaces, faceOffsets);

    ds = delaney.build(
      3,
      size,
      (ds, i) => pairings[i],
      (ds, i) => ds.elements().map(D => [D, 1])
    );
  }
  else {
    const allTiles = applyOpsToTiles(
      pos, action, codedFaces, tiles, primitive.ops
    );
    errors.push("Explicit tiles are not supported yet.");
  }

  // TODO include original vertex positions in output

  _timers && _timers.stop('tilingFromFacelist');

  return {
    name,
    group: group.name,
    symbol: derived.minimal(ds),
    cover: ds,
    warnings,
    errors
  };
};


if (require.main == module) {
  const cgd = require('./cgd');
  const pgr = require('../pgraphs/periodic');
  const sym = require('../pgraphs/symmetries');
  const inv = require('../pgraphs/invariant');

  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const invariant = G => {
    if (sym.isMinimal(G))
      return inv.invariant(G);
    else
      return inv.invariant(sym.minimalImage(G));
  };

  const input = `
CRYSTAL
  NAME srs
  GROUP I4132
  CELL 2.82843 2.82843 2.82843 90.0000 90.0000 90.0000
  NODE 1 3  0.12500 0.12500 0.12500
  EDGE  0.12500 0.12500 0.12500   0.12500 -0.12500 0.37500
END

CRYSTAL
  NAME dia
  GROUP Fd-3m:2
  CELL 2.30940 2.30940 2.30940 90.0000 90.0000 90.0000
  NODE 1 4  0.12500 0.12500 0.62500
  EDGE  0.12500 0.12500 0.62500   0.37500 0.37500 0.37500
END

CRYSTAL
  NAME pcu
  GROUP Pm-3m
  CELL 1.00000 1.00000 1.00000 90.0000 90.0000 90.0000
  NODE 1 6  0.00000 0.00000 0.00000
  EDGE  0.00000 0.00000 0.00000   0.00000 0.00000 1.00000
END

CRYSTAL
  NAME bcu
  GROUP Im-3m
  CELL 1.15470 1.15470 1.15470 90.0000 90.0000 90.0000
  NODE 1 8  0.00000 0.00000 0.00000
  EDGE  0.00000 0.00000 0.00000   0.50000 0.50000 0.50000
END

CRYSTAL
  NAME nbo
  GROUP Im-3m
  CELL 2.00000 2.00000 2.00000 90.0000 90.0000 90.0000
  NODE V1 4  0.00000 0.00000 0.50000
  EDGE  0.00000 0.00000 0.50000   0.00000 0.50000 0.50000
END
`;

  for (const b of cgd.structures(input)) {
    for (const key in b) {
      console.log(`${key}:`);

      const val = b[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item.constructor == Object) {
            for (const k in item) {
              console.log(`    ${k}: ${JSON.stringify(item[k])}`);
            }
            console.log();
          }
          else {
            console.log(`    ${JSON.stringify(item)}`);
          }
        }
      }
      else {
        console.log(`    ${JSON.stringify(val)}`);
      }
      console.log();
    }

    console.log('invariant:');
    const inv = invariant(b.graph);
    for (const [head, tail, shift] of inv) {
      console.log(`    ${head} ${tail} ${shift.join(' ')}`);
    }

    console.log();
    console.log();
  }
};
