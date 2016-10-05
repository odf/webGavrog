import * as spacegroups from '../geometry/spacegroups';
import * as lattices from '../geometry/lattices';
import * as sgtable from './sgtable';

import { coordinateChanges } from '../geometry/types';
const V = coordinateChanges;


const matrixError = (A, B) => V.div(V.norm(V.minus(A, B)), V.norm(A));
const eps = Math.pow(2, -50);
const trim = x => Math.abs(x) < eps ? 0 : x;
const acosdeg = x => Math.acos(x) / Math.PI * 180.0;


const mapValues = (obj, fn) => {
  const result = {};
  for (const key in obj) {
    result[key] = fn(obj[key]);
  }
  return result;
};


const mapNode = coordinateChange => ({ coordination, position }) => ({
  coordination,
  originalPosition: position,
  position: V.mod(V.times(coordinateChange, position), 1)
});


const mapEdge = (coordinateChange, nodes) => ends => ends.map(p => {
  if (V.typeOf(p) == 'Vector') {
    return {
      originalPosition: p,
      position: V.times(coordinateChange, p)
    }
  }
  else {
    const { originalPosition, position } = nodes[p] || {};
    return { nodeGiven: p, originalPosition, position };
  };
});


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


const pointStabilizer = (point, ops, areEqualFn) => {
  const stabilizer = ops.filter(op => areEqualFn(point, V.times(op, point)));

  for (const A of stabilizer) {
    for (const B of stabilizer) {
      if (!areEqualFn(point, V.times(V.times(A, V.inverse(B)), point))) {
        return null;
      }
    }
  }

  return stabilizer;
};


export function netFromCrystal(spec) {
  const { name, group, cellGram: G0, nodes, edgeCenters, edges } = spec;
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

  const nodesMapped = mapValues(nodes, mapNode(toPrimitive));
  const edgeCentersMapped = mapValues(edgeCenters, mapNode(toPrimitive));
  const edgesMapped = edges.map(mapEdge(toPrimitive, nodesMapped));

  return {
    name,
    group: group.name,
    cellGram,
    primitiveCell: primitive.cell,
    primitiveGram,
    toPrimitive,
    nodes: nodesMapped,
    edgeCenters: edgeCentersMapped,
    edges: edgesMapped,
    warnings,
    errors
  };
};


if (require.main == module) {
  const cgd = require('./cgd');

  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const input = `
CRYSTAL
  NAME cem
  GROUP c2mm
  CELL 1.00000 3.73205 90.0000
  NODE 1 5  0.00000 0.13397
  EDGE  0.00000 0.13397   0.00000 -0.13397
  EDGE  0.00000 0.13397   1.00000 0.13397
  EDGE  0.00000 0.13397   0.50000 0.36603
# EDGE_CENTER  0.00000 -0.00000
# EDGE_CENTER  0.50000 0.13397
# EDGE_CENTER  0.25000 0.25000
END
  `;

  for (const b of cgd.structures(input))
    console.log(JSON.stringify(b, null, 2));
};
