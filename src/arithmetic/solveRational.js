import * as mats from './matrices';
import { intMatrices, residueClassRing } from './types';

const iops = intMatrices;

const p = 9999991;
const pops = mats.extend(residueClassRing(p), ['Integer'], true);


const invModP = M => {
  console.log(`invModP(${M})`);
  const n = M.length;
  const A = M.map((row, i) => row.concat(pops.unitVector(n, i)));
  console.log(`  A = ${A}`);
  const E = pops.rowEchelonForm(A);
  console.log(`  E = ${E}`);

  return E.map(row => row.slice(n));
};


export default function solve(A, b) {
  console.log(`solve(${A}, ${b})`);
  const C = invModP(A);
  console.log(`  C = ${C}`);

  const nrSteps = 10; // TODO compute a proper step number

  let bi = b;
  let xi;

  for (let i = 0; i < nrSteps; ++i) {
    xi = pops.times(C, bi);
    bi = iops.idiv(iops.minus(bi, iops.times(A, xi)), p);
  }
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
