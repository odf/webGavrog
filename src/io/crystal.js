import * as spacegroups from '../geometry/spacegroups';
import * as lattices from '../geometry/lattices';
import * as pg from '../pgraphs/periodic';
import * as sgtable from './sgtable';
import * as delaney from '../dsymbols/delaney';
import * as derived from '../dsymbols/derived';

import fromPointCloud from '../pgraphs/fromPointCloud';

import { coordinateChanges } from '../geometry/types';
const ops = coordinateChanges;


let _timers = null;

export function useTimers(timers) {
  _timers = timers;
};


const matrixError = (A, B) => ops.div(ops.norm(ops.minus(A, B)), ops.norm(A));
const eps = Math.pow(2, -50);
const trim = x => Math.abs(x) < eps ? 0 : x;
const acosdeg = x => Math.acos(x) / Math.PI * 180.0;
const flatMap = (fn, xs) => xs.reduce((t, x, i) => t.concat(fn(x, i)), []);


const mapNode = coordinateChange => ({ name, coordination, position }, i) => ({
  name,
  index: i,
  coordination,
  positionInput: position,
  positionPrimitive: ops.modZ(ops.times(coordinateChange, ops.point(position)))
});


const findNode = (nodes, name) => {
  for (const v of nodes)
    if (v.name == name)
      return v;
};


const mapEnd = (coordinateChange, nodes) => p => {
  if (ops.typeOf(p) == 'Vector') {
    return {
      positionInput: p,
      positionPrimitive: ops.times(coordinateChange, ops.point(p))
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


const unitCellParameters = G => {
  if (ops.dimension(G) == 2) {
    const a = Math.sqrt(G[0][0]);
    const b = Math.sqrt(G[1][1]);
    return [a, b, acosdeg(G[0][1] / a / b)];
  }
  else if (ops.dimension(G) == 3) {
    const a = Math.sqrt(G[0][0]);
    const b = Math.sqrt(G[1][1]);
    const c = Math.sqrt(G[2][2]);
    const alpha = acosdeg(G[1][2] / b / c);
    const beta  = acosdeg(G[0][2] / a / c);
    const gamma = acosdeg(G[0][1] / a / b);
    return [a, b, c, alpha, beta, gamma].map(trim);
  }
};


const dotProduct = gram => {
  const G = ops.toJS(gram);

  return (v, w) => {
    let s = 0;
    for (const i in v)
      for (const j in w)
        s += v[i] * G[i][j] * w[j];
    return s;
  };
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
  const n = ops.dimension(gram);
  const limit = ops.times(maxDist, maxDist);
  const dot = dotProduct(gram);
  const vecs = lattices.dirichletVectors(ops.identityMatrix(n), dot);

  return (p, q) => {
    _timers && _timers.start("pointsAreCloseModZ");

    const d0 = p.coords.map((x, i) => (ops.toJS(x) - ops.toJS(q.coords[i])) % 1);
    const d = shiftIntoDirichletDomain(d0, vecs, dot);
    const result = dot(d, d) < limit;

    _timers && _timers.stop("pointsAreCloseModZ");

    return result;
  };
};


const vectorsAreClose = (gram, maxDist) => {
  const n = ops.dimension(gram);
  const limit = ops.times(maxDist, maxDist);
  const dot = dotProduct(gram);

  return (v, w) => {
    const d = ops.toJS(ops.minus(v, w));
    return ops.le(dot(d, d), limit);
  };
};


const lookupPointModZ = (p, nodes, areEqualFn) => {
  for (const i in nodes) {
    const q = nodes[i].pos;
    if (areEqualFn(p, q)) {
      return {
        node: nodes[i].id,
        shift: ops.minus(p, q).map(x => ops.round(x))
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
        seen[spacegroups.opModZ(ops.times(op, t))] = true;
      }
    }
  }

  return result;
};


const pointStabilizer = (point, symOps, areEqualFn) => {
  const stabilizer = symOps.filter(
    op => areEqualFn(point, ops.times(op, point)));

  for (const A of stabilizer) {
    for (const B of stabilizer) {
      if (!areEqualFn(point, ops.times(ops.times(A, ops.inverse(B)), point))) {
        return null;
      }
    }
  }

  return stabilizer.map(spacegroups.opModZ);
};


const edgeStabilizer = (pos, vec, symOps, pointsEqualFn, vectorsEqualFn) => {
  const goodOp = op => (
    pointsEqualFn(pos, ops.times(op, pos))
      && vectorsEqualFn(vec, ops.times(ops.linearPart(op), vec)));

  const stabilizer = symOps.filter(goodOp);

  for (const A of stabilizer) {
    for (const B of stabilizer) {
      if (!goodOp(ops.times(A, ops.inverse(B)))) {
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
    pos: ops.modZ(ops.times(op, positionPrimitive)),
    degree: coordination,
    repIndex: index,
    operator: op
  }));
};


const edgeImages = (symOps, nodes, pntsEqualFn, vecsEqualFn) => (e, index) => {
  const { from: { positionPrimitive: src },
          to: { positionPrimitive: dst } } = e;
  const vec = ops.minus(dst, src);

  const stabilizer = edgeStabilizer(
    src, vec, symOps, pntsEqualFn, vecsEqualFn)

  const cosetReps = operatorCosets(symOps, stabilizer);

  return cosetReps
    .map(operator => {
      const from = ops.modZ(ops.times(operator, src));
      const to = ops.plus(from, ops.times(ops.linearPart(operator), vec));

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
  .map(({ pos, degree, repIndex, operator }, id) => ({
    id, pos, degree, repIndex, operator
  }))


const applyOpsToEdges = (edges, nodes, symOps, pointsEqFn, vectorsEqFn) =>
  flatMap(edgeImages(symOps, nodes, pointsEqFn, vectorsEqFn), edges)
  .map(({ from, to, repIndex, operator }, id) => ({
    id, from, to, repIndex, operator
  }));


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
            images[spacegroups.opModZ(ops.times(r, op))] = pos.length;
          pos.push(ops.modZ(ops.times(r, p)));
        }

        for (const r of reps) {
          const m = {};
          for (const op of symOps)
            m[op] = images[spacegroups.opModZ(ops.times(op, r))];
          action.push(m);
        }
      }

      const shift = ops.minus(p, pos[index]).map(x => ops.round(x));
      face.push({ index, shift });
    }

    faces.push(face);
  }

  _timers && _timers.stop("applyOpsToCorners");
  return { pos, action, faces };
};


const normalizedFace = face => {
  let best = null;
  let bestShift = null;

  const less = (f1, f2) => {
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

  for (const i in face) {
    const s = face[i].shift;
    const fa = face.slice(i).concat(face.slice(0, i))
      .map(({ index, shift }) => ({ index, shift: ops.minus(shift, s) }));
    const fb = [fa[0]].concat(fa.slice(1).reverse());

    if (best == null || less(fa, best)) {
      best = fa;
      bestShift = s;
    }
    if (less(fb, best)) {
      best = fb;
      bestShift = s;
    }
  }

  return { face: best, shift: bestShift };
};


const applyOpsToFaces = (pos, action, faces, symOps) => {
  _timers && _timers.start("applyOpsToFaces");

  const apply = (op, { index, shift }) => {
    const oldPos = ops.plus(pos[index], shift);
    const newPos = ops.times(op, oldPos);
    const newIndex = action[index][op];

    return {
      index: newIndex,
      shift: ops.minus(newPos, pos[newIndex]).map(x => ops.round(x))
    }
  };

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


const normalized = v => ops.div(v, ops.norm(v));


const sectorNormals = vs => {
  const centroid = ops.div(vs.reduce((v, w) => ops.plus(v, w)), vs.length);

  return vs.map((v, i) => {
    const w = vs[(i + 1) % vs.length];
    return normalized(ops.crossProduct(ops.minus(w, v), ops.minus(centroid, w)));
  });
};


const collectEdges = faces => {
  const facesAtEdge = {};

  faces.forEach(({ face, shift }, i) => {
    const n = face.length;
    const edges = face.map((v, i) => [v, face[(i + 1) % n]]);

    edges.forEach(([{index: v1, shift: s1}, {index: v2, shift: s2}], j) => {
      const key = JSON.stringify([v1, v2, ops.minus(s2, s1)]);
      const keyInv = JSON.stringify([v2, v1, ops.minus(s1, s2)]);

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
    item => ops.plus(ops.vector(corners[item.index]), item.shift)));

  const normals = explicitFaces.map(sectorNormals)
  const facesAtEdge = collectEdges(faces);
  const getNormal = ([i, j, rev]) => ops.times(normals[i][j], rev ? -1 : 1);

  const result = [];
  for (const key of Object.keys(facesAtEdge)) {
    const [v, w, s] = JSON.parse(key);
    const d = normalized(ops.minus(ops.plus(corners[w], s), corners[v]));
    const n0 = getNormal(facesAtEdge[key][0]);

    const incidences = facesAtEdge[key].map(([i, j, reverse]) => {
      const n = getNormal([i, j, reverse]);
      const angle = Math.acos(Math.max(-1, Math.min(1, ops.times(n0, n))));

      if (ops.lt(ops.determinant(ops.cleanup([d, n0, n])), 0))
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


const buildTiling = (pos, faces) => {
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

  pairings[2] = op2PairingsForPlainMode(pos, faces, faceOffsets);

  return delaney.build(3, offset - 1,
                       (ds, i) => pairings[i],
                       (ds, i) => ds.elements().map(D => [D, 1]));
};


const convertEdge = ({ from, to }) =>
  [from.node, to.node, ops.minus(to.shift, from.shift)];


const degreesSatisfied = (nodes, edges) => {
  const left = nodes.map(v => v.degree);
  for (const [i, j, _] of edges) {
    --left[i];
    --left[j];
  }

  return left.every(n => n <= 0);
};


const withInducedEdges = (nodes, givenEdges, gram) => {
  const pointAsFloat = pos => ops.point(ops.toJS(ops.vector(pos)));
  const nodesF = nodes.map(({ id, pos, degree }) =>
                           ({ id, pos: pointAsFloat(pos), degree }));
  return fromPointCloud(nodesF, givenEdges, dotProduct(gram));
};


const symmetrizedGramMatrix = (G, symOps) => {
  const M = symOps
    .map(S => ops.linearPart(S))
    .map(S => ops.times(S, ops.times(G, ops.transposed(S))))
    .reduce((A, B) => ops.plus(A, B));

  return ops.div(M, symOps.length);
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
  const cellGram = symmetrizedGramMatrix(G0, operators);
  if (matrixError(cellGram, G0) > 0.01) {
    warnings.push(`Unit cell resymmetrized to ${unitCellParameters(cellGram)}`);
  }

  const primitive = spacegroups.primitiveSetting(operators);
  const toPrimitive = primitive.fromStd.oldToNew;
  const primitiveGram = symmetrizedGramMatrix(
    ops.times(primitive.cell,
              ops.times(cellGram, ops.transposed(primitive.cell))),
    primitive.ops);

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
    cellGram,
    primitiveCell: primitive.cell,
    primitiveGram,
    toPrimitive,
    nodeReps: nodesMapped,
    explicitEdgeReps: edgesMapped,
    nodes: allNodes,
    explicitEdges,
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
  const cellGram = symmetrizedGramMatrix(G0, operators);
  if (matrixError(cellGram, G0) > 0.01) {
    warnings.push(`Unit cell resymmetrized to ${unitCellParameters(cellGram)}`);
  }

  const primitive = spacegroups.primitiveSetting(operators);
  const toPrimitive = primitive.fromStd.oldToNew;
  const primitiveGram = symmetrizedGramMatrix(
    ops.times(primitive.cell,
              ops.times(cellGram, ops.transposed(primitive.cell))),
    primitive.ops);

  const facesMapped = faces.map(
    f => f.map(p => ops.times(toPrimitive, ops.point(p))));

  const pointsEq = pointsAreCloseModZ(primitiveGram, 0.001);
  const { pos, action, faces: codedFaces } =
    applyOpsToCorners(facesMapped, primitive.ops, pointsEq);
  const allFaces = applyOpsToFaces(pos, action, codedFaces, primitive.ops);

  const ds = buildTiling(pos, allFaces);

  // TODO also support the case were tiles are given explicitly

  _timers && _timers.stop('tilingFromFacelist');

  return {
    name,
    group: group.name,
    cellGram,
    primitiveCell: primitive.cell,
    primitiveGram,
    toPrimitive,
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
  NODE 1 4  0.00000 0.00000 0.50000
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
