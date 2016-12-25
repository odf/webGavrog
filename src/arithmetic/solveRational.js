import * as mats from './matrices';
import { intMatrices, matrices } from './types';
import * as util from '../common/util';

const iops = intMatrices;
const fops = matrices;

const p = 9999991;


const modularInverse = (a, m) => {
  let [t, t1] = [0, 1];
  let [r, r1] = [m, a];

  while (r1 != 0) {
    const q = Math.floor(r / r1);
    [t, t1] = [t1, t - q * t1];
    [r, r1] = [r1, r - q * r1];
  }

  if (r == 1)
    return t < 0 ? t + m : t;
};


const modularRowEchelonForm = (M, m) => {
  const A = M.map(row => row.map(a => a < 0 ? (a % m) + m : a % m));
  const [nrows, ncols] = [A.length, A[0].length];

  let row = 0;

  for (let col = 0; col < ncols; ++col) {
    let r = row;
    while (r < nrows && A[r][col] == 0)
      ++r;

    if (r >= nrows)
      continue;

    if (r != row)
      [A[row], A[r]] = [A[r], A[row]];

    const f = modularInverse(A[row][col], m);
    for (let j = col; j < ncols; ++j)
      A[row][j] = (A[row][j] * f) % m;

    for (let i = 0; i < nrows; ++i) {
      if (i == row)
        continue;

      const f = A[i][col];
      for (let j = col; j < ncols; ++j)
        A[i][j] = (m - (A[row][j] * f) % m + A[i][j]) % m;
    }

    ++row;
  }

  return A;
};


const modularMatrixInverse = (M, m) => {
  const n = M.length;
  const A = M.map((row, i) => row.concat(iops.unitVector(n, i)));
  const E = modularRowEchelonForm(A, m);

  if (iops.eq(E.map(row => row.slice(0, n)), iops.identityMatrix(n)))
    return E.map(row => row.slice(n));
};


const modularMatrixProduct = (A, B, m) => {
  const [nrowsA, ncolsA] = [A.length, A[0].length];
  const [nrowsB, ncolsB] = [B.length, B[0].length];

  if (ncolsA != nrowsB)
    throw new Error('shapes do not match');

  return (
    Array(nrowsA).fill(0).map((_, i) => (
      Array(ncolsB).fill(0).map((_, j) => (
        Array(ncolsA).fill(0)
          .map((_, k) => (A[i][k] * B[k][j]) % m)
          .reduce((a, x) => (a + x) % m))))));
};


const integerMatrixProduct = (A, B) => {
  const [nrowsA, ncolsA] = [A.length, A[0].length];
  const [nrowsB, ncolsB] = [B.length, B[0].length];

  if (ncolsA != nrowsB)
    throw new Error('shapes do not match');

  const result = Array(nrowsA);

  for (let i = 0; i < nrowsA; ++i) {
    const row = Array(ncolsB).fill(0);

    for (let j = 0; j < ncolsB; ++j) {
      let t = 0;

      for (let k = 0; k < ncolsA; ++k) {
        if (A[i][k] != 0 && B[k][j] != 0)
          t = iops.plus(t, iops.times(A[i][k], B[k][j]));
      }

      row[j] = t;
    }

    result[i] = row;
  }

  return result;
};


const numberOfPAdicStepsNeeded = (A, b) => {
  const logLengths = M => fops.transposed(M).map(r => Math.log(fops.norm(r)));
  const max = v => v.reduce((x, y) => x > y ? x : y);
  const sum = v => v.reduce((x, y) => x + y);

  const ls = logLengths(A).concat(max(logLengths(b)));
  const lsSorted = ls.sort((a, b) => - fops.cmp(a, b));
  const logDelta = sum(lsSorted.slice(0, A[0].length));
  const golden = (1 + Math.sqrt(5)) / 2;

  return Math.ceil(2 * (logDelta + Math.log(golden)) / Math.log(p));
};


const rationalReconstruction = (s, h) => {
  let u = [h, s];
  let v = [0, 1];
  let sign = 1;

  while (iops.gt(iops.times(u[1], u[1]), h)) {
    const q = iops.idiv(u[0], u[1]);

    u = [u[1], iops.minus(u[0], iops.times(q, u[1]))];
    v = [v[1], iops.plus(v[0], iops.times(q, v[1]))];
    sign *= -1;
  }

  return fops.div(iops.times(sign, u[1]), v[1]);
};


export default function solve(A, b, timers=null) {
  timers && timers.start('modularMatrixInverse');
  const C = modularMatrixInverse(A, p);
  timers && timers.stop('modularMatrixInverse');

  if (C == null)
    return null;

  const nrSteps = numberOfPAdicStepsNeeded(A, b);

  let bi = b;
  let pi = 1;
  let si = 0;

  for (let i = 0; i < nrSteps; ++i) {
    timers && timers.start('bootstrap: compute xi = C * bi (mod p)');
    const xi = modularMatrixProduct(C, bi, p);
    timers && timers.stop('bootstrap: compute xi = C * bi (mod p)');

    timers && timers.start('bootstrap: update si and pi');
    si = iops.plus(si, iops.times(pi, xi));
    pi = iops.times(pi, p);
    timers && timers.stop('bootstrap: update si and pi');

    if (i + 1 < nrSteps) {
      timers && timers.start('bootstrap: update bi');
      const Axi = integerMatrixProduct(A, xi);
      bi = iops.idiv(iops.minus(bi, Axi), p);
      timers && timers.stop('bootstrap: update bi');
    }
  }

  timers && timers.start('rationalReconstruction');
  const result = si.map(row => row.map(x => rationalReconstruction(x, pi)));
  timers && timers.stop('rationalReconstruction');

  return result;
};
