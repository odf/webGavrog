import * as spacegroups from '../geometry/spacegroups';
import * as lattices from '../geometry/lattices';
import * as sgtable from './sgtable';

import fromPointCloud from '../pgraphs/fromPointCloud';

import { coordinateChanges } from '../geometry/types';
const V = coordinateChanges;


const matrixError = (A, B) => V.div(V.norm(V.minus(A, B)), V.norm(A));
const eps = Math.pow(2, -50);
const trim = x => Math.abs(x) < eps ? 0 : x;
const acosdeg = x => Math.acos(x) / Math.PI * 180.0;
const flatMap   = (fn, xs) => xs.reduce((t, x, i) => t.concat(fn(x, i)), []);


const mapNode = coordinateChange => ({ name, coordination, position }, i) => ({
  name,
  index: i,
  coordination,
  positionInput: position,
  positionPrimitive: V.mod(V.times(coordinateChange, position), 1)
});


const mapEnd = (coordinateChange, nodes) => p => {
  if (V.typeOf(p) == 'Vector') {
    return {
      positionInput: p,
      positionPrimitive: V.times(coordinateChange, p)
    }
  }
  else {
    const { positionInput, positionPrimitive } = nodes[p] || {};
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
  if (V.dimension(G) == 2) {
    const a = Math.sqrt(G[0][0]);
    const b = Math.sqrt(G[1][1]);
    return [a, b, acosdeg(G[0][1] / a / b)];
  }
  else if (V.dimension(G) == 3) {
    const a = Math.sqrt(G[0][0]);
    const b = Math.sqrt(G[1][1]);
    const c = Math.sqrt(G[2][2]);
    const alpha = acosdeg(G[1][2] / b / c);
    const beta  = acosdeg(G[0][2] / a / c);
    const gamma = acosdeg(G[0][1] / a / b);
    return [a, b, c, alpha, beta, gamma].map(trim);
  }
};


const pointsAreCloseModZ = (gram, maxDist) => {
  const n = V.dimension(gram);
  const limit = V.times(maxDist, maxDist);
  const dot = (v, w) => V.times(v, V.times(gram, w));
  const vecs = lattices.dirichletVectors(V.identityMatrix(n), dot);
  const shortest = p =>
    V.plus(p, lattices.shiftIntoDirichletDomain(p, vecs, dot));

  return (p, q) => {
    const d = shortest(V.mod(V.minus(p, q), 1));
    return V.le(dot(d, d), limit);
  };
};


const vectorsAreClose = (gram, maxDist) => {
  const n = V.dimension(gram);
  const limit = V.times(maxDist, maxDist);
  const dot = (v, w) => V.times(v, V.times(gram, w));

  return (v, w) => {
    const d = V.minus(v, w);
    return V.le(dot(d, d), limit);
  };
};


const lookupPointModZ = (p, nodes, areEqualFn) => {
  for (const i in nodes) {
    const q = nodes[i].pos;
    if (areEqualFn(p, q)) {
      return [i, V.minus(p, q).map(x => V.round(x))];
    }
  }
};


const operatorCosets = (ops, subgroup) => {
  const seen = {};
  const result = [];

  for (const op of ops) {
    if (!seen[spacegroups.opModZ(op)]) {
      result.push(op);
      for (const t of subgroup) {
        seen[spacegroups.opModZ(V.times(op, t))] = true;
      }
    }
  }

  return result;
};


const pointStabilizer = (point, ops, areEqualFn) => {
  const stabilizer = ops.filter(op => areEqualFn(point, V.times(op, point)));

  for (const A of stabilizer) {
    for (const B of stabilizer) {
      if (!areEqualFn(point, V.times(V.times(A, V.inverse(B)), point))) {
        return null;
      }
    }
  }

  return stabilizer.map(spacegroups.opModZ);
};


const edgeStabilizer = (pos, vec, ops, pointsEqualFn, vectorsEqualFn) => {
  const goodOp = op => (
    pointsEqualFn(pos, V.times(op, pos))
      && vectorsEqualFn(vec, V.times(V.linearPart(op), vec)));

  const stabilizer = ops.filter(goodOp);

  for (const A of stabilizer) {
    for (const B of stabilizer) {
      if (!goodOp(V.times(A, V.inverse(B)))) {
        return null;
      }
    }
  }

  return stabilizer.map(spacegroups.opModZ);
};


const nodeImages = (ops, equalFn) => (v, index) => {
  const { name, coordination, positionInput, positionPrimitive } = v;
  const stabilizer = pointStabilizer(positionPrimitive, ops, equalFn);
  const cosetReps = operatorCosets(ops, stabilizer);

  return cosetReps.map(op => ({
    pos: V.mod(V.times(op, positionPrimitive), 1),
    degree: coordination,
    operator: op
  })).map(({ operator, pos, degree }, id) => ({
    id, pos, degree, repIndex: index, operator
  }));
};


const edgeImages = (ops, pointsEqualFn, vectorsEqualFn) => (e, index) => {
  const { from: { positionPrimitive: src },
          to: { positionPrimitive: dst } } = e;
  const vec = V.minus(dst, src);

  const stabilizer = edgeStabilizer(
    src, vec, ops, pointsEqualFn, vectorsEqualFn)

  const cosetReps = operatorCosets(ops, stabilizer);

  return cosetReps
    .map(operator => {
      const from = V.mod(V.times(operator, src), 1);
      const to = V.plus(from, V.times(V.linearPart(operator), vec));

      return { from, to, operator };
    })
    .map(({ from, to, operator }, id) => ({
      id, from, to, repIndex: index, operator
    }));
};


const applyOpsToNodes = (nodes, ops, equalFn) =>
  flatMap(nodeImages(ops, equalFn), nodes);


const applyOpsToEdges = (edges, ops, pointsEqFn, vectorsEqFn) =>
  flatMap(edgeImages(ops, pointsEqFn, vectorsEqFn), edges);


const withInducedEdges = (nodes, givenEdges, gram) =>
  fromPointCloud(nodes, givenEdges, gram);


export function netFromCrystal(spec) {
  const { name, group, cellGram: G0, nodes, edges } = spec;
  const warnings = spec.warnings.slice();
  const errors = spec.errors.slice();

  if (group.error) {
    errors.push(group.error);
    return { warnings, errors };
  }

  const { name: groupName, transform, operators } = group;
  const cellGram = spacegroups.resymmetrizedGramMatrix(G0, operators);
  if (matrixError(cellGram, G0) > 0.01) {
    warnings.push(`Unit cell resymmetrized to ${unitCellParameters(cellGram)}`);
  }

  const primitive = spacegroups.primitiveSetting(operators);
  const toPrimitive = primitive.fromStd.oldToNew;
  const primitiveGram = spacegroups.resymmetrizedGramMatrix(
    V.times(primitive.cell, V.times(cellGram, V.transposed(primitive.cell))),
    primitive.ops);

  const nodesMapped = nodes.map(mapNode(toPrimitive));
  const edgesMapped = edges.map(mapEdge(toPrimitive, nodesMapped));

  if (edgesMapped.length)
    warnings.push('explicit edges given, but not yet supported');

  const pointsEq = pointsAreCloseModZ(primitiveGram, 0.001);
  const vectorsEq = vectorsAreClose(primitiveGram, 0.001);

  const allNodes = applyOpsToNodes(
    nodesMapped, primitive.ops, pointsEq);
  const explicitEdges = applyOpsToEdges(
    edgesMapped, primitive.ops, pointsEq, vectorsEq);

  const allEdges = withInducedEdges(allNodes, [], primitiveGram);

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
    edges: allEdges,
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
  NAME sql
  GROUP p4mm
  CELL 1.00000 1.00000 90.0000
  NODE 1 4  0.00000 0.00000
  EDGE  0.00000 0.00000   0.00000 1.00000
# EDGE_CENTER  0.00000 0.50000
END

CRYSTAL
  NAME hxl
  GROUP p6mm
  CELL 1.00000 1.00000 120.0000
  NODE 1 6  0.00000 0.00000
  EDGE  0.00000 0.00000   0.00000 1.00000
# EDGE_CENTER  0.00000 0.50000
END

CRYSTAL
  NAME hcb
  GROUP p6mm
  CELL 1.73205 1.73205 120.0000
  NODE 1 3  0.33333 0.66667
  EDGE  0.33333 0.66667   0.66667 0.33333
# EDGE_CENTER  0.50000 0.50000
END

CRYSTAL
  NAME kgm
  GROUP p6mm
  CELL 2.00000 2.00000 120.0000
  NODE 1 4  0.00000 0.50000
  EDGE  0.00000 0.50000   0.50000 0.50000
# EDGE_CENTER  0.25000 0.50000
END
  `;

  for (const b of cgd.structures(input)) {
    console.log(JSON.stringify(b, null, 4));
    // console.log(b.name);

    // const key = invariant(pgr.make(b.edges));
    // for (const [head, tail, shift] of key) {
    //   console.log(`  ${head} ${tail} ${shift.join(' ')}`);
    // }

    console.log();
  }
};
