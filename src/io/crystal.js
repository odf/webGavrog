import * as spacegroups from '../geometry/spacegroups';
import * as lattices from '../geometry/lattices';
import * as pg from '../pgraphs/periodic';
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


const findNode = (nodes, name) => {
  for (const v of nodes)
    if (v.name == name)
      return v;
};


const mapEnd = (coordinateChange, nodes) => p => {
  if (V.typeOf(p) == 'Vector') {
    return {
      positionInput: p,
      positionPrimitive: V.times(coordinateChange, p)
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
      return {
        node: nodes[i].id,
        shift: V.minus(p, q).map(x => V.round(x))
      };
    }
  }

  return { pos: p };
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
    repIndex: index,
    operator: op
  }));
};


const edgeImages = (ops, nodes, pntsEqualFn, vecsEqualFn) => (e, index) => {
  const { from: { positionPrimitive: src },
          to: { positionPrimitive: dst } } = e;
  const vec = V.minus(dst, src);

  const stabilizer = edgeStabilizer(
    src, vec, ops, pntsEqualFn, vecsEqualFn)

  const cosetReps = operatorCosets(ops, stabilizer);

  return cosetReps
    .map(operator => {
      const from = V.mod(V.times(operator, src), 1);
      const to = V.plus(from, V.times(V.linearPart(operator), vec));

      return {
        from: lookupPointModZ(from, nodes, pntsEqualFn),
        to: lookupPointModZ(to, nodes, pntsEqualFn),
        repIndex: index,
        operator
      };
    });
};


const applyOpsToNodes = (nodes, ops, equalFn) =>
  flatMap(nodeImages(ops, equalFn), nodes)
  .map(({ pos, degree, repIndex, operator }, id) => ({
    id, pos, degree, repIndex, operator
  }))


const applyOpsToEdges = (edges, nodes, ops, pointsEqFn, vectorsEqFn) =>
  flatMap(edgeImages(ops, nodes, pointsEqFn, vectorsEqFn), edges)
  .map(({ from, to, repIndex, operator }, id) => ({
    id, from, to, repIndex, operator
  }));


const convertEdge = ({ from, to }) =>
  [from.node, to.node, V.minus(to.shift, from.shift)];


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

  const pointsEq = pointsAreCloseModZ(primitiveGram, 0.001);
  const vectorsEq = vectorsAreClose(primitiveGram, 0.001);

  const allNodes = applyOpsToNodes(
    nodesMapped, primitive.ops, pointsEq);
  const explicitEdges = applyOpsToEdges(
    edgesMapped, allNodes, primitive.ops, pointsEq, vectorsEq);

  const allEdges = withInducedEdges(
    allNodes, explicitEdges.map(convertEdge), primitiveGram);

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
    graph: pg.make(allEdges),
    warnings,
    errors
  };
};


if (require.main == module) {
  const fs = require('fs');
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

  const input = (process.argv.length > 2
                 ? fs.readFileSync(process.argv[2], { encoding: 'utf8' })
                 : `
CRYSTAL
  NAME cem
  GROUP c2mm
  CELL 1.00000 3.73205 90.0000
  NODE 1 5  0.00000 0.13397
  EDGE  0.00000 0.13397   0.00000 -0.13397
  EDGE  0.00000 0.13397   1.00000 0.13397
  EDGE  0.00000 0.13397   0.50000 0.36603
END
`);

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