import * as mats from './matrices';
import { intMatrices, matrices, residueClassRing } from './types';

const iops = intMatrices;
const fops = matrices;

const p = 9999991;
const pops = mats.extend(residueClassRing(p), ['Integer'], true);


const invModP = M => {
  const n = M.length;
  const A = M.map((row, i) => row.concat(pops.unitVector(n, i)));
  const E = pops.rowEchelonForm(A);

  if (fops.eq(E.map(row => row.slice(0, n)), fops.identityMatrix(n)))
    return E.map(row => row.slice(n));
};


const numberOfPAdicStepsNeeded = (A, b) => {
  const lengths = M => fops.transposed(M).map(r => fops.norm(r));
  const max = v => v.reduce((x, y) => x > y ? x : y);
  const product = v => v.reduce((x, y) => x * y);

  const ls = lengths(A).concat(max(lengths(b)));
  const lsSorted = ls.sort((a, b) => - fops.cmp(a, b));
  const delta = product(lsSorted.slice(0, A[0].length));
  const golden = (1 + Math.sqrt(5)) / 2;

  return Math.ceil(2 * Math.log(delta * golden) / Math.log(p));
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


export default function solve(A, b) {
  const C = invModP(A);
  if (C == null)
    return null;

  const nrSteps = numberOfPAdicStepsNeeded(A, b);

  let bi = b;
  let pi = 1;
  let si = 0;

  for (let i = 0; i < nrSteps; ++i) {
    const xi = pops.times(C, bi);
    bi = iops.idiv(iops.minus(bi, iops.times(A, xi)), p);
    si = iops.plus(si, iops.times(pi, xi));
    pi = iops.times(pi, p);
  }

  return si.map(row => row.map(x => rationalReconstruction(x, pi)));
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  solve(
    [ [  4, -4 ],
      [  1,  0 ] ],
    [ [  1,  1,  1 ],
      [  0,  0,  0 ] ]
  );

  console.log();

  const toRows = (m, A) => {
    const r = [];
    for (let k = 0; k < A.length; k += m)
      r.push(A.slice(k, k + m));
    return r;
  };

  const splitArray = M => {
    const m = Math.floor(Math.sqrt(M.length));

    const A = M.slice(0, m * m);

    const b = M.slice(m * m);
    while (b.length == 0 || b.length % m)
      b.push(0);

    return [toRows(m, A), toRows(b.length / m, b)];
  };

  var jsc = require("jsverify");
  var solveReturnsASolution = jsc.forall(
    "nearray nat",
    M => {
      const [A, b] = splitArray(M);

      let ok = false;

      try {
        const x = solve(A, b);

        if (x == null)
          ok = true;
        else {
          const Ax = fops.times(A, x);
          ok = fops.eq(Ax, b);
        }
      } catch(e) {
        console.log(e);
      }

      return ok;
    })

  jsc.check(solveReturnsASolution, { tests: 1000, size: 100 });
}
