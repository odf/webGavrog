import { serialize as encode } from '../common/pickler';
import * as mats from '../arithmetic/matrices';

import {
  rationals,
  rationalLinearAlgebra,
  rationalLinearAlgebraModular
} from '../arithmetic/types';


import { coordinateChangesQ as opsQ } from '../geometry/types';
import * as parms from '../geometry/parameterVectors';

const opsP = mats.extend(
  parms.extend(rationals, ['Integer', 'LongInt', 'Fraction']),
  ['Integer', 'LongInt', 'Fraction', 'ParameterVector']);


export const opModZ = op => {
  if (opsQ.typeOf(op) == 'Matrix')
    return op;
  else
    return opsQ.affineTransformation(op.linear, opsQ.mod(op.shift, 1));
};


export const fullOperatorList = gens => {
  const I = opsQ.identityMatrix(opsQ.dimension(gens[0]));
  const seen = { [encode(I)]: true };
  const result = [I];

  for (let i = 0; i < result.length; ++i) {
    const A = result[i];

    for (const B of gens) {
      const AB = opModZ(opsQ.times(A, B));
      const key = encode(AB);
      if (!seen[key]) {
        seen[key] = true;
        result.push(AB);
      }
    }
  }

  return result;
};


export const primitiveSetting = stdOps => {
  const dim = opsQ.dimension(stdOps[0]);
  const I = opsQ.identityMatrix(dim);
  let cell = I;

  for (const op of stdOps) {
    const shift = opsQ.shiftPart(op);
    if (opsQ.sgn(shift) != 0 && opsQ.eq(I, opsQ.linearPart(op)))
      cell = rationalLinearAlgebraModular.extendBasis(shift, cell);
  }

  const fromStd = opsQ.coordinateChange(opsQ.inverse(opsQ.transposed(cell)));

  const seen = {};
  const ops = [];

  for (const op of stdOps) {
    const A = opModZ(opsQ.times(fromStd, op));
    const key = encode(A);

    if (!seen[key]) {
      seen[key] = true;
      ops.push(A);
    }
  }

  return { cell, fromStd, ops };
};


export const gramMatrixConfigurationSpace = ops => {
  const d = opsQ.dimension(ops[0]);
  const m = (d * (d+1)) / 2;

  // -- make a parametrized Gram matrix with unknowns encoded by vectors
  const M = opsQ.matrix(d, d);
  let k = 0;
  for (let i = 0; i < d; ++i) {
    for (let j = i; j < d; ++j) {
      M[i][j] = M[j][i] = opsP.unitParameterVector(m, k++);
    }
  }

  // -- collect equations for the configuration space
  let eqns = null;
  for (const op of ops) {
    const S = opsQ.linearPart(op);
    const A = opsP.minus(opsP.times(S, opsP.times(M, opsP.transposed(S))), M);

    for (const row of A) {
      for (const x of row)
        eqns = rationalLinearAlgebra.extendBasis(x.coords, eqns);
    }
  }

  // -- return the solution space
  if (eqns == null)
    return opsQ.identityMatrix(m);
  else
    return opsQ.transposed(rationalLinearAlgebraModular.nullSpace(eqns));
};


export const shiftSpace = ops => {
  const d = opsQ.dimension(ops[0]);
  const I = opsQ.identityMatrix(d);
  const primitive = primitiveSetting(ops);
  const toStd = opsQ.inverse(primitive.fromStd);

  let eqns = null;
  for (const op of primitive.ops) {
    const A = opsQ.minus(opsQ.linearPart(opsQ.times(toStd, op)), I);
    for (const row of A)
      eqns = rationalLinearAlgebra.extendBasis(row, eqns);
  }

  return opsQ.transposed(rationalLinearAlgebraModular.nullSpace(eqns));
};


export const sublatticePoints = lattice => {
  const origin = opsQ.vector(opsQ.dimension(lattice));
  const latticePoints = [origin];
  const seen = { [encode(origin)]: true };

  for (let i = 0; i < latticePoints.length; ++i) {
    const v = latticePoints[i];
    for (const w of lattice) {
      const s = opsQ.mod(opsQ.plus(v, w), 1);
      if (!seen[encode(s)]) {
        seen[encode(s)] = true;
        latticePoints.push(s);
      }
    }
  }

  return latticePoints;
};


export const centeringLattice = toStd =>
  opsQ.transposed(opsQ.linearPart(toStd.oldToNew));


export const centeringLatticePoints = toStd =>
  sublatticePoints(centeringLattice(toStd));


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const ops = [
    [[-1,0],[0,1]],
    opsQ.affineTransformation([[1,0],[0,1]], opsQ.div([1,1], 2))
  ];

  const primitive = primitiveSetting(fullOperatorList(ops));
  console.log('Primitive setting:');
  console.log(`  cell   : ${primitive.cell}`);
  console.log(`  fromStd: ${primitive.fromStd}`);
  console.log(`  ops    : ${primitive.ops}`);
  console.log();

  const clps = centeringLatticePoints(opsQ.inverse(primitive.fromStd));
  console.log(`Centering lattice points: ${clps}`);
  const confSpace = gramMatrixConfigurationSpace(ops);
  console.log(`Gram config. space: ${confSpace}`);
  const shifts = shiftSpace(ops);
  console.log(`Shift space: ${shifts}`);
}
