import * as fw from '../fpgroups/freeWords';

import { integers } from '../arithmetic/types';
const ops = integers;


const shapeOfMatrix = m => [m.length, m[0].length];


const findPivot = (mat, i) => {
  const [nrows, ncols] = shapeOfMatrix(mat);

  let [pivotVal, pivotRow, pivotCol] = [null, 0, 0];

  for (let row = i; row < nrows; ++row) {
    for (let col = i; col < ncols; ++col) {
      const val = ops.abs(mat[row][col]);
      if (ops.ne(val, 0) && (pivotVal == null || ops.lt(val, pivotVal)))
        [pivotVal, pivotRow, pivotCol] = [val, row, col];
    }
  }

  return { pivotVal, pivotRow, pivotCol };
};


const movePivotInPlace = (mat, i, pivotRow, pivotCol) => {
  const [nrows, ncols] = shapeOfMatrix(mat);

  if (pivotRow != i) {
    for (let col = i; col < ncols; ++col)
      [mat[i][col], mat[pivotRow][col]] = [mat[pivotRow][col], mat[i][col]];
  }

  if (pivotCol != i) {
    for (let row = i; row < nrows; ++row)
      [mat[row][i], mat[row][pivotCol]] = [mat[row][pivotCol], mat[row][i]];
  }
};


const clearLaterRowsInPlace = (mat, i) => {
  const [nrows, ncols] = shapeOfMatrix(mat);
  let count = 0;

  for (let row = i + 1; row < nrows; ++row) {
    const [e, f] = [mat[i][i], mat[row][i]];

    if (ops.ne(0, e) && ops.eq(0, ops.mod(f, e))) {
      const x = ops.idiv(f, e);
      for (let col = i; col < ncols; ++col)
        mat[row][col] = ops.minus(mat[row][col], ops.times(x, mat[i][col]));
    }
    else if (ops.ne(0, f)) {
      const [x, a, b, c, d] = ops.gcdex(e, f);
      for (let col = i; col < ncols; ++col) {
        const [v, w] = [mat[i][col], mat[row][col]];
        mat[i][col] = ops.plus(ops.times(v, a), ops.times(w, b));
        mat[row][col] = ops.plus(ops.times(v, c), ops.times(w, d));
      }
      ++count;
    }
  }

  return count;
};


const clearLaterColsInPlace = (mat, i) => {
  const [nrows, ncols] = shapeOfMatrix(mat);
  let count = 0;

  for (let col = i + 1; col < ncols; ++col) {
    const [e, f] = [mat[i][i], mat[i][col]];

    if (ops.ne(0, e) && ops.eq(0, ops.mod(f, e))) {
      const x = ops.idiv(f, e);
      for (let row = i; row < nrows; ++row)
        mat[row][col] = ops.minus(mat[row][col], ops.times(x, mat[row][i]));
    }
    else if (ops.ne(0, f)) {
      const [x, a, b, c, d] = ops.gcdex(e, f);
      for (let row = i; row < nrows; ++row) {
        const [v, w] = [mat[row][i], mat[row][col]];
        mat[row][i] = ops.plus(ops.times(v, a), ops.times(w, b));
        mat[row][col] = ops.plus(ops.times(v, c), ops.times(w, d));
      }
      ++count;
    }
  }

  return count;
};


const diagonalizeInPlace = mat => {
  const n = Math.min(...shapeOfMatrix(mat));

  for (let i = 0; i < n; ++i) {
    const { pivotVal, pivotRow, pivotCol } = findPivot(mat, i);

    if (pivotVal == null)
      return mat;

    movePivotInPlace(mat, i, pivotRow, pivotCol);

    while (true) {
      clearLaterRowsInPlace(mat, i);
      const count = clearLaterColsInPlace(mat, i);
      if (count == 0)
        break;
    }

    mat[i][i] = ops.abs(mat[i][i]);
  }

  return mat;
};


export const abelianInvariants = (nrGens, rels) => {
  const mat = fw.relatorMatrix(nrGens, rels);
  const n = Math.min(...shapeOfMatrix(mat));

  diagonalizeInPlace(mat);

  const factors = mat.slice(0, n).map((row, i) => row[i]);

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

  return factors
    .filter(a => ops.ne(a, 1))
    .concat(new Array(nrGens - n).fill(0))
    .sort();
};


if (require.main == module) {
  const fw = require('../fpgroups/freeWords');

  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const cloneMatrix = A => A.map(row => row.slice());

  const testDiag = mat => {
    console.log(`mat = ${mat}`);
    console.log(`diag(mat) = ${diagonalizeInPlace(cloneMatrix(mat))}`);
    console.log();
  };

  testDiag([ [ 2, 2, 3 ], [ 3, 3, 4 ], [ 2, 1, 3 ] ]);
  testDiag([ [ 1, 2 ], [ 3, 4 ] ]);
  testDiag([ [ 1, 2, 3 ], [ 4, 5, 6 ], [ 7, 8, 9 ] ]);
  testDiag([ [ 2, 0, 0 ], [ 0, 2, 0 ], [ 0, 0, 2 ],
             [ 2, 2, 0 ], [ 2, 0, 2 ], [ 0, 2, 2 ] ]);

  const testInvariants = (nrGens, rels) => {
    console.log(`abelianInvariants(${nrGens}, ${rels}) =`);
    console.log(`  ${abelianInvariants(3, rels.map(fw.word))}`);
    console.log();
  };

  testInvariants(3, [[1,2,-1,-2],[1,3,-1,-3],[2,3,-2,-3]]);
  testInvariants(3, [[1,1],[2,2],[3,3],[1,2,1,2],[1,3,1,3],[2,3,2,3]]);
}
