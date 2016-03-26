import { typeOf } from '../arithmetic/base';
import { affineTransformations } from './types';


const V = affineTransformations;


const modZ = q => V.minus(q, V.floor(q));


const checkInteger = x => {
  if (!V.isInteger(x))
    throw new Error(`expected an integer, got ${x}`);
};


const checkShiftCoordinate = x => {
  if (!V.isRational(x))
    throw new Error(`expected a rational number, got ${x}`);
  if (!V.eq(x, modZ(x)))
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
  const t = typeOf(op);

  if (t != 'Matrix' && t != 'AffineTransformation')
    throw new Error(`expected a Matrix or AffineTransformation, got ${op}`);
};


const checkOperator = (op, d) => {
  checkOperatorType(op);

  if (typeOf(op) == 'Matrix')
    checkLinearPartOfOperator(op, d);
  else {
    checkLinearPartOfOperator(op.linear, d);
    checkTranslationalPartOfOperator(op.shift, d);
  }
};


const operatorDimension = op =>
  (typeOf(op) == 'Matrix' ? op : op.linear).length;


const checkOperatorList = ops => {
  if (!ops.length)
    return;

  ops.forEach(checkOperatorType);

  const d = operatorDimension(ops[0]);
  ops.forEach(op => checkOperator(op, d));
};


const opModZ = op => {
  if (typeOf(op) == 'Matrix')
    return op;
  else
    return V.affineTransformation(op.linear, op.shift.map(modZ));
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


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const check = (op, d) => {
    try {
      d == null ? checkOperatorList(op) : checkOperator(op, d);
      console.log(`Operator ${op} is okay`);
    } catch(ex) {
      console.log(ex);
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
  console.log();

  const ops = fullOperatorList([
    [[-1,0],[0,1]],
    V.affineTransformation([[1,0],[0,1]], V.div([1,1], 2))
  ]);
  ops.forEach(op => console.log(`${op}`));
}
