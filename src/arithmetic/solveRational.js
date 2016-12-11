import * as mats from './matrices';
import { intMatrices, matrices, residueClassRing } from './types';

const iops = intMatrices;
const fops = matrices;

const p = 9999991;
const pops = mats.extend(residueClassRing(p), ['Integer'], true);


const invModP = M => {
  const ops = pops;
  const n = M.length;
  const A = M.map((row, i) => row.concat(ops.unitVector(n, i)));
  const E = ops.rowEchelonForm(A);

  return E.map(row => row.slice(n));
};


const numberOfPAdicStepsNeeded = (A, b) => {
  const ops = fops;

  const lengths = M => ops.transposed(M).map(r => ops.norm(r));
  const max = v => v.reduce((x, y) => x > y ? x : y);
  const product = v => v.reduce((x, y) => x * y);

  const ls = lengths(A).concat(max(lengths(b)));
  const delta = product(ls.sort().slice(A[0].length));
  const golden = (1 + Math.sqrt(5)) / 2;

  return ops.ceil(2 * Math.log(delta * golden) / Math.log(p));
};


export default function solve(A, b) {
  console.log(`solve(${A}, ${b})`);
  const C = invModP(A);
  console.log(`  C = ${C}`);
  console.log(`  A * C = ${pops.times(A, C)}`);

  const nrSteps = numberOfPAdicStepsNeeded(A, b);
  console.log(`  nrSteps = ${nrSteps}`);

  let bi = b;
  let pi = 1;
  let si = 0;

  for (let i = 0; i < nrSteps; ++i) {
    const xi = pops.times(C, bi);
    bi = iops.idiv(iops.minus(bi, iops.times(A, xi)), p);
    si = iops.plus(si, iops.times(pi, xi));
    pi = iops.times(pi, p);
  }
  const s = si;
  console.log(`  s <- ${s}`);
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  solve(
    [ [  4, -4,  1 ],
      [ -4,  4,  0 ],
      [  1,  0,  0 ] ],
    [ [  1,  1,  1 ],
      [ -1, -1, -1 ],
      [  0,  0,  0 ] ]
  );
}
