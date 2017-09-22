import { rationals } from '../arithmetic/types';
import * as mats from '../arithmetic/matrices';

import {
  rationalLinearAlgebra,
  rationalLinearAlgebraModular
} from '../arithmetic/types';


import { coordinateChangesQ } from './types';
import * as parms from './parameterVectors';

const V = coordinateChangesQ;


const isIdentity = M => {
  for (let i = 0; i < M.length; ++i) {
    const row = M[i];
    for (let j = 0; j < row.length; ++j) {
      if (V.ne(row[j], 0 + (i == j)))
        return false;
    }
  }

  return true;
};


const checkInteger = x => {
  if (!V.isInteger(x))
    throw new Error(`expected an integer, got ${x}`);
};


const checkShiftCoordinate = x => {
  if (!V.isRational(x))
    throw new Error(`expected a rational number, got ${x}`);
  if (!V.eq(x, V.mod(x, 1)))
    throw new Error(`expected a number in [0,1), got ${x}`);
};


const checkLinearPartOfOperator = (M, d) => {
  const [n, m] = V.shape(M);

  if (n != d || m != d)
    throw new Error(`expected a ${d}x${d} matrix, got ${M}`);

  M.forEach(row => row.forEach(checkInteger));

  const det = V.determinant(M);

  if (V.abs(det) != 1)
    throw new Error(
      `expected a unimodular matrix, got ${M} with determinant ${det}`
    );
};


const checkTranslationalPartOfOperator = (s, d) => {
  if (s.length != d)
    throw new Error(`expected a ${d}-dimensional vector, got ${s}`);

  s.forEach(checkShiftCoordinate);
};


const checkOperatorType = op => {
  const t = V.typeOf(op);

  if (t != 'Matrix' && t != 'AffineTransformation')
    throw new Error(`expected a Matrix or AffineTransformation, got ${op}`);
};


const checkOperator = (op, d) => {
  checkOperatorType(op);

  if (V.typeOf(op) == 'Matrix')
    checkLinearPartOfOperator(op, d);
  else {
    checkLinearPartOfOperator(op.linear, d);
    checkTranslationalPartOfOperator(op.shift, d);
  }
};


const operatorDimension = op =>
  (V.typeOf(op) == 'Matrix' ? op : op.linear).length;


const checkOperatorList = ops => {
  if (!ops.length)
    return;

  ops.forEach(checkOperatorType);

  const d = operatorDimension(ops[0]);
  ops.forEach(op => checkOperator(op, d));
};


export const opModZ = op => {
  if (V.typeOf(op) == 'Matrix')
    return op;
  else
    return V.affineTransformation(op.linear, V.mod(op.shift, 1));
};


const fullOperatorList = gens => {
  const seen = {};
  gens.forEach(g => seen[g] = true);

  const ops = gens.slice();

  for (let i = 0; i < ops.length; ++i) {
    const A = ops[i];
    gens.forEach(B => {
      const AB = opModZ(V.times(A, V.inverse(B)));
      if (!seen[AB]) {
        ops.push(AB);
        seen[AB] = true;
      }
    });
  }

  return ops;
};


const checkGroup = ops => {
  const seen = {};
  ops.forEach(op => seen[op] = true);

  ops.forEach(A => {
    ops.forEach(B => {
      if (!seen[opModZ(V.times(A, V.inverse(B)))])
        throw new Error('operators do not form a group');
    })
  });
};


const primitiveCell = ops => {
  let basis = V.identityMatrix(operatorDimension(ops[0]));

  for (const op of ops) {
    if (V.typeOf(op) == 'AffineTransformation' && isIdentity(op.linear))
      basis = rationalLinearAlgebraModular.extendBasis(op.shift, basis);
  }

  return basis;
};


const dedupe = as => {
  const seen = {};
  const result = [];
  as.forEach(a => {
    if (!seen[a]) {
      result.push(a);
      seen[a] = true;
    }
  });
  return result;
};


export function primitiveSetting(stdOps) {
  const cell    = primitiveCell(stdOps);
  const fromStd = V.coordinateChange(V.inverse(V.transposed(cell)));
  const ops     = dedupe(stdOps.map(op => opModZ(V.times(fromStd, op))));

  return { cell, fromStd, ops };
};


export const gramMatrixConfigurationSpace = ops => {
  const P = mats.extend(
    parms.extend(rationals, ['Integer', 'LongInt', 'Fraction']),
    ['Integer', 'LongInt', 'Fraction', 'ParameterVector']);

  const d = V.dimension(ops[0]);
  const m = (d * (d+1)) / 2;

  // -- make a parametrized Gram matrix with unknowns encoded by vectors
  const M = V.matrix(d, d);
  let k = 0;
  for (let i = 0; i < d; ++i) {
    for (let j = i; j < d; ++j) {
      M[i][j] = M[j][i] = P.unitParameterVector(m, k++);
    }
  }

  // -- collect equations for the configuration space
  let eqns = null;
  for (const op of ops) {
    const S = V.linearPart(op);
    const A = P.minus(P.times(S, P.times(M, P.transposed(S))), M);

    for (const row of A) {
      for (const x of row)
        eqns = rationalLinearAlgebra.extendBasis(x.coords, eqns);
    }
  }

  // -- return the solution space
  return V.transposed(rationalLinearAlgebraModular.nullSpace(eqns));
};


const shiftSpace = ops => {
  const d = V.dimension(ops[0]);
  const I = V.identityMatrix(d);
  const primitive = primitiveSetting(ops);
  const toStd = V.inverse(primitive.fromStd);
  const pops = primitive.ops.map(op => opModZ(V.times(toStd, op)));

  const M = [].concat(...pops.map(op => V.minus(V.linearPart(op), I)));
  return V.transposed(rationalLinearAlgebraModular.nullSpace(M));
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const check = (op, d) => {
    try {
      if (d == null) {
        checkOperatorList(op);
        checkGroup(op);
        console.log(`Operator list ${op} is okay`);
      }
      else {
        checkOperator(op, d);
        console.log(`Operator ${op} is okay`);
      }
    } catch(ex) {
      console.log(`${ex}`);
    }
  };

  const M = [[1,1,0],[0,1,5],[0,0,-1]];

  check(M, 3);
  check(V.affineTransformation(M, V.div([1,2,3], 3)), 3);

  check([1,1,0], 3);
  check([[1,1,0],[0,1,5]], 3);
  check([[1,1,0],[0,1,5],[0,0.2,1]], 3);
  check([[1,1,0],[0,1,5],[0,0,-2]], 3);
  check(V.affineTransformation(M, [V.div(5,3),0,1]), 3);

  check([ [[1,1],[3,4]], [[1,0],[1,1],[1,3]] ]);
  const ops = [
    [[-1,0],[0,1]],
    V.affineTransformation([[1,0],[0,1]], V.div([1,1], 2))
  ];
  check(ops);
  check(fullOperatorList(ops));

  console.log(isIdentity([[1,0,0],[0,1,0],[0,0,1]]));
  console.log(isIdentity([[1,0,0],[0,1,-1],[0,0,1]]));
  console.log();

  const primitive = primitiveSetting(fullOperatorList(ops));
  console.log('Primitive setting:');
  console.log(`  cell   : ${primitive.cell}`);
  console.log(`  fromStd: ${primitive.fromStd}`);
  console.log(`  ops    : ${primitive.ops}`);
  console.log();

  const confSpace = gramMatrixConfigurationSpace(ops);
  console.log(`Gram config. space: ${confSpace}`);
  const shifts = shiftSpace(ops);
  console.log(`Shift space: ${shifts}`);
}
