import * as jsc from 'jsverify';

import * as seq from '../../src/common/lazyseq';
import solve from '../../src/arithmetic/solveRational';


Array.prototype.toString = function() {
  return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
};


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


if (require.main == module) {
  const fops = require('../../src/arithmetic/types').matrices;
  const util = require('../../src/common/util');
  const timers = util.timers();
  timers.start('total');

  var solveReturnsASolution = jsc.forall(
    linearEquations(jsc.nat),
    ([A, b]) => {
      timers.start('solve total');
      const x = solve(A, b, timers);
      timers.stop('solve total');

      if (x == null)
        return true;

      timers.start('check solutions');
      const good = fops.eq(fops.times(A, x), b);
      timers.stop('check solutions');

      return good;
    });

  jsc.check(solveReturnsASolution, { tests: 1000, size: 100 });

  timers.stop('total');
  console.log(timers.current());
}
