import * as spacegroups from '../geometry/spacegroups';
import * as sgtable from './sgtable';

import { coordinateChanges } from '../geometry/types';
const V = coordinateChanges;


const gramMatrixError = (ops, G) => {
  const Gs = spacegroups.resymmetrizedGramMatrix(G, ops);
  return V.div(V.norm(V.minus(G, Gs)), V.norm(G));
};


export function netFromCrystal(spec) {
  const { name, group, cell, nodes, edgeCenters, edges } = spec;
  const warnings = spec.warnings.slice();
  const errors = spec.errors.slice();

  if (group.error) {
    errors.push(groupSpec.error);
    return { warnings, errors };
  }

  const { name: groupName, transform, operators } = group;
  if (gramMatrixError(operators, cell) > 0.01)
    warnings.push('Unit cell parameters do not match group symmetries');

  return {
    name,
    group: group.name,
    cell,
    nodes,
    edgeCenters,
    edges,
    warnings,
    errors
  };
};
