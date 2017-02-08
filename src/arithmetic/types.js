const base = require('./base');
const mats = require('./matrices');
const residues = require('./residues');


export const integers = require('./integers')
  .extend(base.arithmetic());

export const rationals = require('./fractions')
  .extend(integers, ['Integer', 'LongInt'], 'Fraction');

export const reals = require('./floats')
  .extend(rationals);

export const intMatrices = mats
  .extend(integers, ['Integer', 'LongInt'], false);

export const rationalMatrices = mats
  .extend(rationals, ['Integer', 'LongInt', 'Fraction'], true);

export const rationalMatricesAsModule = mats
  .extend(rationals, ['Integer', 'LongInt', 'Fraction'], false);

export const matrices = mats
  .extend(reals, ['Integer', 'LongInt', 'Float', 'Fraction'],
          true, Math.pow(2, -50));

export const residueClassRing = m => residues.extend(base.arithmetic(), m);


if (require.main == module) {
  const I = require('immutable');

  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const ops = rationalMatrices;

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

  const A = [[1,2,3],[0,4,5],[6,0,7]];
  const T = ops.triangulation(A);
  console.log(`T.R = ${T.R}`);
  console.log(`T.U = ${T.U}`);
  console.log(`T.sign = ${T.sign}`);
  console.log(ops.rank(A));
  console.log(ops.determinant(A));

  const testSolve = (A, b) => {
    const v = ops.solve(A, b);
    console.log(`${A} *\n${v} =\n${ops.times(A, v)}\n`);
  };

  console.log();
  testSolve(A, [1, 1, 1]);
  testSolve(A, [1, 1, 2]);

  const Ainv = ops.inverse(A);
  console.log(`${A} *\n${Ainv} =\n${ops.times(A, Ainv)}\n`);

  const testNullSpace = B => {
    const N = ops.nullSpace(B);
    console.log(`${B} *\n${N} =\n${N ? ops.times(B, N) : N}\n`);
  }

  testNullSpace([[1,2,3], [2,4,6], [3,6,9]]);
  testNullSpace([[1,2,3,1], [4,5,6,1], [7,8,9,1]]);
  testNullSpace([[0,2,0]]);


  const fops = matrices;

  console.log();
  console.log(fops.sqrt(625));
  console.log(fops.sqrt(626));
  const B = fops.inverse(A);
  console.log(`${A} *`);
  console.log(`${B} =`);
  console.log(`${fops.cleanup(fops.times(A, B))}`);

  console.log();
  const O = fops.orthonormalized(A);
  const P = fops.cleanup(fops.times(O, fops.transposed(O)));
  console.log(`O = ${O}`);
  console.log(`O * O.T = ${P}`);
  console.log();

  const testFloatInverse = A => {
    const B = fops.cleanup(fops.inverse(A));
    console.log(`${A} *\n${B} =\n${B ? fops.cleanup(fops.times(A, B)) : B}\n`);
  };

  testFloatInverse(fops.cleanup(
    [[0.8164965809277261,0,0],
     [0.577350269189626,0.8660254037844387,0],
     [-5.5511151231257815e-17,-0.5,0.9999999999999998]]));

  testFloatInverse([[0.8164965809277261,0,0],
                    [0.577350269189626,0.8660254037844387,0],
                    [0,-0.5,0.9999999999999998]]);

  const iops = intMatrices;

  console.log();
  console.log(JSON.stringify(iops.triangulation(A)));

  const testRepr = x => {
    const xr = fops.repr(x);
    console.log();
    console.log(JSON.stringify(xr));
    console.log(I.fromJS(xr));
    console.log(JSON.stringify(fops.fromRepr(xr)));
  };

  testRepr(ops.div([1, 2, 3], 3));
  testRepr([[1.1, 2.2, ops.integer('-12_345_678_901_234_567_890')]]);

  console.log(ops.cmp([1, 2, 3], [1, 2, 2]));
  console.log(ops.cmp([1, 2, 3], [1, 2, 3]));
  console.log(ops.cmp([1, 2, 3], [1, 2, 4]));
  console.log(ops.cmp([1, 2, 3], [1, 2, 3, 4]));
  console.log(ops.cmp([1, 2, 3], [1, 2, 3, 0]));

  console.log(ops.sgn([1, 2, 3]));
  console.log(ops.sgn([0, 2, 3]));
  console.log(ops.sgn([0, -2, 3]));
  console.log(ops.sgn([0, 0, 0]));

  const testEchelon = (M, ops) => {
    console.log();
    console.log(`M = ${M}`);
    const n = M.length;
    const A = M.map((row, i) => row.concat(ops.unitVector(n, i)));
    console.log(`A = ${A}`);
    const E = ops.rowEchelonForm(A);
    console.log(`E = ${E}`);
    const Mi = E.map(row => row.slice(n));
    console.log(`Mi = ${Mi}`);
    console.log(`M * Mi = ${ops.times(M, Mi)}`);
  };

  testEchelon(A, ops);

  const inverseTest = (a, m) => {
    const ops = residueClassRing(m);
    const ainv = ops.div(1, a);
    console.log(`1 / ${a} = ${ainv} (mod ${m})`);

    if (ainv >= m)
      console.log(`ERROR: ${ainv} is too large`);
    else {
      const t = ops.times(a, ainv);
      if (ops.ne(t, 1)) {
        console.log(`ERROR: ${a} * ${ainv} = ${t} (mod ${m})`);
      }
    }
  }

  for (const p of [3, 5, 7, 11, 13]) {
    console.log();
    for (let a = 2; a < p; ++a) {
      inverseTest(a, p);
    }
  }

  testEchelon(A, mats.extend(residueClassRing(11), ['Integer'], true));
}
