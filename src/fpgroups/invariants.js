import * as cosets      from '../fpgroups/cosets';

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


const diagonalize = mat => {
  const [nrows, ncols] = ops.shape(mat);
  const n = Math.min(nrows, ncols);

  // --- eliminate off-diagonal elements in a diagonal sweep
  for (let i = 0; i < n; ++i) {
    let [pivotVal, pivotRow, pivotCol] = [null, 0, 0];

    // --- find the nonzero submatrix entry with smallest absolute value
    for (let row = i; row < nrows; ++row) {
      for (let col = i; col < ncols; ++col) {
        const val = ops.abs(M[row][col]);
        if (ops.ne(val, 0) && (pivotVal == null || ops.lt(val, pivotVal)))
          [pivotVal, pivotRow, pivotCol] = [val, row, col];
      }
    }

    if (pivotVal == null)
      return;

    // --- move the pivot to the diagonal and make it positive
    if (pivotRow != i) {
      for (let col = i; col < ncols; ++col)
        [M[i][col], M[pivotRow][col]] = [M[pivotRow][col], M[i][col]];
    }

    if (pivotCol != i) {
      for (let row = i; row < nrows; ++row)
        [M[row][i], M[row][pivotCol]] = [M[row][pivotCol], M[row][i]];
    }

    if (ops.lt(M[i][i], 0)) {
      for (let col = i; col < ncols; ++col)
        M[i][col] = ops.negative(M[i][col]);
    }

    // --- eliminate off-diagonal entries in i-th row and column
    let done = false;

    while (!done) {
      // --- clear the i-th column by row operations
      for (let row = i + 1; row < nrows; ++row) {
        const [x, a, b, c, d] = gcdex(M[i][i], M[row][i]);
        for (let col = i; col < ncols; ++col) {
          const [v, w] = [M[i][col], M[row][col]];
          M[i][col] = ops.plus(ops.times(v, a), ops.times(w, b));
          M[row][col] = ops.plus(ops.times(v, c), ops.times(w, d));
        }
      }
                
      // --- now try to clear the i-th row by column operations
      done = true;
      
      // TODO ...
    }
  }
};


if (require.main == module) {
  const test = (m, n) => {
    const [x, a, b, c, d] = gcdex(m, n);
    const checkX = ops.plus(ops.times(a, m), ops.times(b, n));
    const check0 = ops.plus(ops.times(c, m), ops.times(d, n));
    console.log(`gcd(${m}, ${n}) = ${x}`);
    console.log(`  ${a} * ${m} + ${b} * ${n} = ${checkX}`);
    console.log(`  ${c} * ${m} + ${d} * ${n} = ${check0}`);
    console.log();
  };

  test(5, 3);
  test(85, 51);
  test(34, 55);
  test(170, 275);
  test(550, 275);
  test(0, 275);
  test(550, 0);
  test(0, 0);
}
