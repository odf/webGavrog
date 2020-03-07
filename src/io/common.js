import { lattices } from '../spacegroups/lattices';
import { opModZ, primitiveSetting } from '../spacegroups/spacegroups';
import * as unitCells from '../spacegroups/unitCells';

import {
  coordinateChangesQ as opsQ,
  coordinateChangesF as opsF
} from '../geometry/types';


export const fromSpec = spec => {
  const warnings = spec.warnings.slice();
  const errors = spec.errors.slice();

  if (spec.group.error) {
    errors.push(spec.group.error);
    return { warnings, errors };
  }

  const { operators } = spec.group;
  const cellGram = unitCells.symmetrizedGramMatrix(spec.cellGram, operators);

  const matrixError = (A, B) => opsF.norm(opsF.minus(A, B)) / opsF.norm(A);
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


export const subgroup = (symOps, inSubgroup) => {
  const sub = symOps.filter(inSubgroup).map(opModZ);

  for (const a of sub) {
    for (const b of sub) {
      if (!inSubgroup(opsQ.times(a, b)))
        throw new Error('inconsistent subgroup condition');
    }
  }

  return sub;
};


export const cosetReps = (symOps, inSubgroup) => {
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


export const applyToVector = (op, vector) =>
  opsF.times(opsQ.toJS(opsQ.linearPart(op)), vector);


export const applyToPoint = (op, point) => opsF.point(opsF.plus(
  applyToVector(op, opsF.vector(point)),
  opsQ.toJS(opsQ.shiftPart(op))
));


export const dot = (v, w, gram) => {
  let s = 0;
  for (const i in v) {
    for (const j in w)
      s += v[i] * gram[i][j] * w[j];
  }
  return s;
};


export const dotProduct = gram => (v, w) => dot(v, w, gram);


export const pointsAreCloseModZ = (gram, maxDist) => {
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
