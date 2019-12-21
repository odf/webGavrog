import * as jsc from 'jsverify';

import * as seq from '../src/common/lazyseq';


const skip = (v, i) => v.slice(0, i).concat(v.slice(i + 1));
const skip2 = (A, i, j) => skip(A, i).map(row => skip(row, j));


export const generators = {
  linearEquations(arb) {
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
  },

  digitStrings() {
    const digits = jsc.nat(9);

    const generator = jsc.generator.bless(size => {
      const n = jsc.random(1, Math.max(1, size));
      const v = new Array(n);

      for (let i = 0; i < n; ++i)
        v[i] = digits.generator();

      while (v.length > 1 && v[0] == 0)
        v.shift()

      if ((v.length > 1 || v[0] != 0) && jsc.random(0, 1))
        v.unshift('-');

      return v.join('');
    });

    const normalize = s => {
      const start = s[0] == '-' ? 1 : 0;
      let i = start;
      while (i < s.length - 1 && s[i] == '0')
        ++i;
      return s.slice(0, start).concat(s.slice(i));
    };

    const shrink = jsc.shrink.bless(s => {
      if (s.length <= 1)
        return [];
      else if (s.length == 2 && s[0] == '-')
        return [s.slice(1)];
      else
        return seq.range(0, s.length).map(i => normalize(skip(s, i))).toArray();
    });

    const show = s => s;

    return {
      generator: jsc.utils.curried2(generator, arguments),
      shrink: jsc.utils.curried2(shrink, arguments),
      show: jsc.utils.curried2(show, arguments)
    };
  }
};


const _formatResult = result => {
  const s = `counterexample ${result.counterexamplestr}` +
    ` found after ${result.tests} tests and ${result.shrinks} shrinks`;

  if (result.exc)
    return s + '\n' + result.exc.stack;
  else
    return s;
};


export const verify = (property, options) => function() {
  let result = jsc.check(property, Object.assign({ quiet: true }, options));

  if (result === true)
    this.assert(true);
  else
    this.flunk(_formatResult(result));
};


export const property = (gens, cond, options) =>
  verify(jsc.forall(...gens, cond), options);
