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

  const jsc = require("jsverify");
  const seq = require("lazy-seq");

  const range = (a, b) =>
    a >= b ? seq.nil : seq.cons(a, () => range(a + 1, b));

  const concat = (s1, s2) =>
    s1.isNil ? s2 : seq.cons(s1.head(), () => concat(s1.tail(), s2));

  const flatten = s =>
    s.isNil ? s : concat(s.head(), flatten(s.tail()));

  const flatMap = (s, f) =>
    flatten(s.map(f));

  const skip = (v, i) => v.slice(0, i).concat(v.slice(i + 1));


  const linearEquations = arb => {
    const generator = jsc.generator.bless(size => {
      const n = jsc.random(1, Math.max(1, Math.floor(Math.sqrt(size))));

      const A = new Array(n + 1);
      for (let i = 0; i < n + 1; ++i) {
        const row = A[i] = new Array(n);
        for (let j = 0; j < n; ++j) {
          row[j] = arb.generator(size);
        }
      }
      return [A.slice(0, n), A[n].map(x => [x])];
    });

    const shrink = jsc.shrink.bless(([A, b]) => {
      const n = A.length;

      if (n <= 1)
        return seq.nil;
      else
        return flatMap(
          range(0, n).map(i => [skip(A, i), skip(b, i)]),
          ([A, b]) => range(0, n).map(j => [A.map(row => skip(row, j)), b]));
    });

    const show = ([A, b]) => `${JSON.stringify(A)} * x = ${JSON.stringify(b)}`;

    return {
      generator: jsc.utils.curried2(generator, arguments),
      shrink: jsc.utils.curried2(shrink, arguments),
      show: jsc.utils.curried2(show, arguments)
    };
  };

  var solveReturnsASolution = jsc.forall(
    linearEquations(jsc.nat),
    ([A, b]) => {
      const x = solve(A, b);
      return x == null || fops.eq(fops.times(A, x), b);
    });

  jsc.check(solveReturnsASolution, { tests: 1000, size: 100 });
}
