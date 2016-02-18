const base = require('./base');
const ints = require('./integers');
const frac = require('./fractions');
const fpts = require('./floats');
const mats = require('./matrices');


const a = base.arithmetic();

a.register(ints.methods());
export const integers = a.ops();

a.register(frac.methods(integers, ['Integer', 'LongInt'], 'Fraction'));
export const rationals = a.ops();

a.register(mats.methods(rationals, ['Integer', 'LongInt', 'Fraction'], true));
export const matrices = a.ops();


const b = base.arithmetic();

b.register(fpts.methods());
export const floats = b.ops();

b.register(mats.methods(floats, ['Integer', 'Float'], true, Math.pow(2, -50)));
export const floatMatrices = b.ops();


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const ops = matrices;

  const V = [1, 2, 3];
  const M = [[1, 2, 3], [4, 5, 6]];

  console.log(ops.shape(V));
  console.log(ops.negative(V));
  console.log(ops.transposed(V));
  console.log(ops.squareNorm(V));
  console.log(ops.plus(V, [3, 2, 1]));
  console.log(ops.plus(V, 2));
  console.log(ops.minus(V, [0, 1, 2]));
  console.log(ops.minus(V, 1));
  console.log(ops.minus(1, V));
  console.log(ops.idiv(V, 2));
  console.log(ops.crossProduct([1, 0, 0], [1, 2, 0]));

  console.log();
  console.log(ops.negative(M));
  console.log(ops.shape(M));
  console.log(ops.transposed(M));
  console.log(ops.squareNorm(M));
  console.log(ops.plus(M, [[9, 8, 7], [6, 5, 4]]));
  console.log(ops.plus(M, 2));
  console.log(ops.minus(M, [[0, 1, 2], [3, 4, 5]]));
  console.log(ops.minus(M, 1));
  console.log(ops.minus(1, M));

  console.log();
  console.log(ops.times(V, V));
  console.log(ops.times(M, V));
  console.log(ops.times(V, ops.transposed(M)));
  console.log(ops.times(M, ops.transposed(M)));

  const A = [[1,2,3],[0,4,5],[0,0,6]];
  console.log(ops.triangulation(A));
  console.log(ops.rank(A));
  console.log(ops.determinant(A));

  console.log();
  const b = [1, 1, 1];
  const v = ops.solve(A, b);
  console.log(`${A} *\n${v} =\n${ops.times(A, v)}\n`);

  const Ainv = ops.inverse(A);
  console.log(`${A} *\n${Ainv} =\n${ops.times(A, Ainv)}\n`);

  const testNullSpace = B => {
    const N = ops.nullSpace(B);
    console.log(`${B} *\n${N} =\n${N ? ops.times(B, N) : N}\n`);
  }

  testNullSpace([[1,2,3], [2,4,6], [3,6,9]]);
  testNullSpace([[1,2,3,1], [4,5,6,1], [7,8,9,1]]);


  const fops = floatMatrices;

  console.log();
  const B = fops.inverse(A);
  console.log(`${A} *`);
  console.log(`${B} =`);
  console.log(`${fops.times(A, B)}`);

  console.log();
  const O = fops.orthonormalized(A);
  const P = fops.cleanup(fops.times(O, fops.transposed(O)));
  console.log(`O = ${O}`);
  console.log(`O * O.T = ${P}`);
}
