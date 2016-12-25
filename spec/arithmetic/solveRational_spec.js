import * as JS from 'jstest';
import * as jsc from 'jsverify';

import * as seq from '../../src/common/lazyseq';
import solve from '../../src/arithmetic/solveRational';
import { matrices } from '../../src/arithmetic/types';


const skip = (v, i) => v.slice(0, i).concat(v.slice(i + 1));
const skip2 = (A, i, j) => skip(A, i).map(row => skip(row, j));
const set = (v, i, x) => v.slice(0, i).concat([x], v.slice(i + 1));
const set2 = (A, i, j, x) => set(A, i, set(A[i], j, x));


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
    else {
      const idcs = seq.range(0, n);
      const idxPairs = idcs.flatMap(i => idcs.map(j => [i, j]));
      const skips = idxPairs.map(([i, j]) => [skip2(A, i, j), skip(b, i)]);
      return skips;
    }
  });

  const show = ([A, b]) => `${JSON.stringify(A)} * x = ${JSON.stringify(b)}`;

  return {
    generator: jsc.utils.curried2(generator, arguments),
    shrink: jsc.utils.curried2(shrink, arguments),
    show: jsc.utils.curried2(show, arguments)
  };
};


const solveReturnsASolutionOrNull = jsc.forall(
  linearEquations(jsc.nat),
  ([A, b]) => {
    const x = solve(A, b);
    return x == null || matrices.eq(matrices.times(A, x), b);
  }
);


JS.Test.describe('solveRational', function() {
  this.it('returnASolutionOrNull', function() {
    const options = { tests: 1000, size: 100, quiet: true };
    const result  = jsc.check(solveReturnsASolutionOrNull, options);

    if (result === true)
      this.assert(true);
    else
      this.assert(false, `counterexample: ${result.counterexamplestr}`);
  });
});


if (require.main == module) {
  JS.Test.autorun();
}
