import * as I from 'immutable';

import * as cosets      from '../fpgroups/cosets';
import { word } from '../fpgroups/freeWords';

import { intMatrices } from '../arithmetic/types';
const ops = intMatrices;


const gcdex = (m, n) => {
  let f  = ops.abs(m);
  let fm = ops.lt(m, 0) ? -1 : 1;
  let g  = ops.abs(n);
  let gm = 0;

  while (ops.ne(g, 0)) {
    const q  = ops.idiv(f, g);
    const t  = g;
    const tm = gm;
    g  = ops.minus(f, ops.times(q, g));
    gm = ops.minus(fm, ops.times(q, gm));
    f  = t;
    fm = tm;
  }

  if (ops.eq(n, 0))
    return [ f, fm, 0, gm, 1 ];
  else
    return [
      f,
      fm, ops.idiv(ops.minus(f, ops.times(fm, m)), n),
      gm, ops.idiv(ops.minus(0, ops.times(gm, m)), n) ];
};


const diagonalizeInPlace = mat => {
  const [nrows, ncols] = ops.shape(mat);
  const n = Math.min(nrows, ncols);

  // --- eliminate off-diagonal elements in a diagonal sweep
  for (let i = 0; i < n; ++i) {
    console.log(`i = ${i}, mat = ${mat}`);
    let [pivotVal, pivotRow, pivotCol] = [null, 0, 0];

    // --- find the nonzero submatrix entry with smallest absolute value
    for (let row = i; row < nrows; ++row) {
      for (let col = i; col < ncols; ++col) {
        const val = ops.abs(mat[row][col]);
        if (ops.ne(val, 0) && (pivotVal == null || ops.lt(val, pivotVal)))
          [pivotVal, pivotRow, pivotCol] = [val, row, col];
      }
    }

    if (pivotVal == null)
      return mat;

    // --- move the pivot to the diagonal and make it positive
    if (pivotRow != i) {
      for (let col = i; col < ncols; ++col)
        [mat[i][col], mat[pivotRow][col]] = [mat[pivotRow][col], mat[i][col]];
    }

    if (pivotCol != i) {
      for (let row = i; row < nrows; ++row)
        [mat[row][i], mat[row][pivotCol]] = [mat[row][pivotCol], mat[row][i]];
    }


    if (ops.lt(mat[i][i], 0)) {
      for (let col = i; col < ncols; ++col)
        mat[i][col] = ops.negative(mat[i][col]);
    }

    console.log(`mat <- ${mat}`);

    // --- eliminate off-diagonal entries in i-th row and column
    let dirty = true;

    while (dirty) {
      // --- clear the i-th column by row operations
      for (let row = i + 1; row < nrows; ++row) {
        const [x, a, b, c, d] = gcdex(mat[i][i], mat[row][i]);
        for (let col = i; col < ncols; ++col) {
          const [v, w] = [mat[i][col], mat[row][col]];
          mat[i][col] = ops.plus(ops.times(v, a), ops.times(w, b));
          mat[row][col] = ops.plus(ops.times(v, c), ops.times(w, d));
        }
      }

      // --- now try to clear the i-th row by column operations
      dirty = false;

      for (let col = i + 1; col < ncols; ++col) {
        //TODO add proper condition for repeating the loop
        const [x, a, b, c, d] = gcdex(mat[i][i], mat[i][col]);

        for (let row = i; row < nrows; ++row) {
          const [v, w] = [mat[row][i], mat[row][col]];
          mat[row][i] = ops.plus(ops.times(v, a), ops.times(w, b));
          mat[row][col] = ops.plus(ops.times(v, c), ops.times(w, d));
        }
      }

      console.log(`mat <- ${mat}`);
    }
  }

  return mat;
};


export const abelianInvariants = (nrGens, rels) => {
  console.log(`abelianInvariants(${nrGens}, ${rels})`);
  const mat = cosets.relatorMatrix(nrGens, rels).toJS();
  const [nrows, ncols] = ops.shape(mat);
  const n = Math.min(nrows, ncols);
  console.log(`  mat = ${mat}`);

  diagonalizeInPlace(mat);
  console.log(`  mat <- ${mat}`);

  const factors = [];
  for (let i = 0; i < n; ++i)
    factors.push(mat[i][i]);

  for (let i = 0; i < n; ++i) {
    for (let j = i + 1; j < n; ++j) {
      const [a, b] = [factors[i], factors[j]];
      if (ops.ne(a, 0) && ops.ne(ops.mod(b, a), 0)) {
        const g = ops.gcd(a, b);
        factors[j] = ops.idiv(ops.times(a, b), g);
        factors[i] = g;
      }
    }
  }

  const res = [];
  for (let i = 0; i < n; ++i) {
    if (ops.ne(factors[i], 1))
      res.push(factors[i]);
  }

  for (let i = n; i < nrGens; ++i)
    res.push(0);

  return res.sort();
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const cloneMatrix = A => A.map(row => row.slice());

  const testGcdex = (m, n) => {
    const [x, a, b, c, d] = gcdex(m, n);
    const checkX = ops.plus(ops.times(a, m), ops.times(b, n));
    const check0 = ops.plus(ops.times(c, m), ops.times(d, n));
    console.log(`gcd(${m}, ${n}) = ${x}`);
    console.log(`  ${a} * ${m} + ${b} * ${n} = ${checkX}`);
    console.log(`  ${c} * ${m} + ${d} * ${n} = ${check0}`);
    console.log();
  };

  testGcdex(5, 3);
  testGcdex(85, 51);
  testGcdex(34, 55);
  testGcdex(170, 275);
  testGcdex(550, 275);
  testGcdex(0, 275);
  testGcdex(550, 0);
  testGcdex(5, 5);
  testGcdex(5, -5);
  testGcdex(0, 0);

  const testDiag = mat => {
    console.log(`mat = ${mat}`);
    console.log(`diag(mat) = ${diagonalizeInPlace(cloneMatrix(mat))}`);
    console.log();
  };

  testDiag([ [ 2, 2, 3 ], [ 3, 3, 4 ], [ 2, 1, 3 ] ]);
  testDiag([ [ 1, 2 ], [ 3, 4 ] ]);
  testDiag([ [ 1, 2, 3 ], [ 4, 5, 6 ], [ 7, 8, 9 ] ]);

  const testInvariants = (nrGens, rels) => {
    console.log(abelianInvariants(3, I.List(rels).map(word)));
    console.log();
  };

  testInvariants(3, [[1,2,-1,-2],[1,3,-1,-3],[2,3,-2,-3]]);
  testInvariants(3, [[1,1],[2,2],[3,3],[1,2,1,2],[1,3,1,3],[2,3,2,3]]);
}