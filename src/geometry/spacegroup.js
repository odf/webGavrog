import { typeOf } from '../arithmetic/base';
import { affineTransformations } from './types';


const V = affineTransformations;


const checkInteger = x => {
  const t = typeOf(x);
  if (t != 'Integer' && t != 'LongInt')
    throw new Error(`expected an integer, got ${x}`);
};


const checkRational = x => {
  const t = typeOf(x);
  if (t != 'Integer' && t != 'LongInt' && t != 'Fraction')
    throw new Error(`expected a rational number, got ${x}`);
};


const checkLinearPartOfOperator = (M, d) => {
  const [n, m] = V.shape(M);

  if (d != null && n != d || m != d)
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


const checkOperator = (op, d) => {
  const t = typeOf(op);

  if (t != 'Matrix' && t != 'AffineTransformation')
    throw new Error(`expected a Matrix or AffineTransformation, got ${op}`);

  if (t == 'Matrix') 
    checkLinearPartOfOperator(op, d);
  else {
    checkLinearPartOfOperator(op.linear, d);
    checkTranslationalPartOfOperator(op.shift, d);
  }
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const check = (op, d) => {
    try {
      checkOperator(op, d);
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
}
