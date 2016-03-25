import { typeOf } from '../arithmetic/base';
import { affineTransformations } from './types';


const V = affineTransformations;


const checkInteger = x => {
  if (!V.isInteger(x))
    throw new Error(`expected an integer, got ${x}`);
};


const checkRational = x => {
  if (!V.isRational(x))
    throw new Error(`expected a rational number, got ${x}`);
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

  s.forEach(checkRational);
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
  check(V.affineTransformation(M, [0.3,0,1]), 3);

  check([ [[1,1],[3,4]], [[1,0],[1,1],[1,3]] ]);
}
