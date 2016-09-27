import * as spacegroups from '../geometry/spacegroups';
import * as sgtable from './sgtable';

import { coordinateChanges } from '../geometry/types';
const V = coordinateChanges;


const matrixError = (A, B) => V.div(V.norm(V.minus(A, B)), V.norm(A));
const eps = Math.pow(2, -50);
const trim = x => Math.abs(x) < eps ? 0 : x;
const acosdeg = x => Math.acos(x) / Math.PI * 180.0;


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


export function netFromCrystal(spec) {
  const { name, group, cellGram: G0, nodes, edgeCenters, edges } = spec;
  const warnings = spec.warnings.slice();
  const errors = spec.errors.slice();

  if (group.error) {
    errors.push(groupSpec.error);
    return { warnings, errors };
  }

  const { name: groupName, transform, operators } = group;
  const cellGram = spacegroups.resymmetrizedGramMatrix(G0, operators);
  if (matrixError(cellGram, G0) > 0.01) {
    warnings.push(`Unit cell resymmetrized to ${unitCellParameters(cellGram)}`);
  }

  const primitive = spacegroups.primitiveSetting(operators);
  const toPrimitive = primitive.fromStd.oldToNew;

  return {
    name,
    group: group.name,
    cellGram,
    primitiveCell: primitive.cell,
    toPrimitive,
    nodes,
    edgeCenters,
    edges,
    warnings,
    errors
  };
};
