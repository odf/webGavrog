import * as JS from 'jstest';
import * as jsc from 'jsverify';
import * as spec from '../helpers';

import { integers } from '../../src/arithmetic/types';

const ops = integers;

const options = { tests: 100, size: 100 };


const pow = (x, n) => {
  if (ops.cmp(n, 0) == 0)
    return 1;

  let y = x;
  let r = 1;
  let m = n;

  if (ops.cmp(m, 0) < 0) {
    m = ops.negative(m);
    y = ops.div(1, y);
  }

  while (ops.cmp(m, 0) > 0) {
    if (!ops.isEven(m))
      r = ops.times(y, r);

    y = ops.times(y, y);
    m = ops.idiv(m, 2);
  }

  return r;
};


const fib = n => {
  if (n <= 0)
    return 0;
  else if (n == 1)
    return 1;
  else {
    let [a, b] = [0, 1];

    for (let i = 1; i < n; ++i)
      [a, b]  = [b, ops.plus(a, b)];

    return b;
  }
};


JS.Test.describe('long integers', function() {
  this.describe('a digit string', function() {
    this.it('stays the same when parsed and then formatted', spec.property(
      [spec.generators.digitStrings()],
      s => s == ops.integer(s).toString()));
  });


  this.describe('a long integer a and a natural number n', function() {
    this.it('satisfy abs(a >> n) = [abs(a) / 2^n]', spec.property(
      [spec.generators.digitStrings(), jsc.nat()],
      (sa, n) => {
        const a = ops.integer(sa);
        return ops.eq(
          ops.abs(ops.shiftRight(a, n)),
          ops.idiv(ops.abs(a), pow(2, n))
        );
      },
      options));

    this.it('satisfy a << n = a * 2^n', spec.property(
      [spec.generators.digitStrings(), jsc.nat()],
      (sa, n) => {
        const a = ops.integer(sa);
        return ops.eq(ops.shiftLeft(a, n), ops.times(a, pow(2, n)));
      },
      options));

    this.it('satisfy gcd(a*fib(n), a*fib(n+1)) == abs(a)', spec.property(
      [spec.generators.digitStrings(), jsc.nat()],
      (sa, n) => {
        const a = ops.integer(sa);
        return ops.eq(
          ops.gcd(ops.times(a, fib(n)), ops.times(a, fib(n+1))),
          ops.abs(a)
        );
      },
      options));
  });


  this.describe('a pair a,b of integers', function() {
    this.it('satisfies (a + b)^2 = a^2 + 2ab + b^2', spec.property(
      [spec.generators.digitStrings(), spec.generators.digitStrings()],
      (sa, sb) => {
        const a = ops.integer(sa);
        const b = ops.integer(sb);
        return ops.eq(ops.times(ops.plus(a, b), ops.plus(a, b)),
                      ops.plus(ops.plus(ops.times(a, a), ops.times(b, b)),
                               ops.times(2, ops.times(a, b))));
      },
      options));

    this.it('satisfies (a - b)^2 = a^2 - 2ab + b^2', spec.property(
      [spec.generators.digitStrings(), spec.generators.digitStrings()],
      (sa, sb) => {
        const a = ops.integer(sa);
        const b = ops.integer(sb);
        return ops.eq(ops.times(ops.minus(a, b), ops.minus(a, b)),
                      ops.minus(ops.plus(ops.times(a, a), ops.times(b, b)),
                                ops.times(2, ops.times(a, b))));
      },
      options));

    this.it('satisfies (a + b) * (a - b) = a^2 - b^2', spec.property(
      [spec.generators.digitStrings(), spec.generators.digitStrings()],
      (sa, sb) => {
        const a = ops.integer(sa);
        const b = ops.integer(sb);
        return ops.eq(ops.times(ops.plus(a, b), ops.minus(a, b)),
                      ops.minus(ops.times(a, a), ops.times(b, b)));
      },
      options));

    this.it('satisfies (a^2 - b^2) / (a - b) = a + b', spec.property(
      [spec.generators.digitStrings(), spec.generators.digitStrings()],
      (sa, sb) => {
        const a = ops.integer(sa);
        const b = ops.integer(sb);
        if (ops.eq(a, b))
          return true;

        return ops.eq(ops.idiv(ops.minus(ops.times(a, a), ops.times(b, b)),
                               ops.minus(a, b)),
                      ops.plus(a, b));
      },
      options));

    this.it('satisfies [a / b] * b = a - a % b unless b = 0', spec.property(
      [spec.generators.digitStrings(), spec.generators.digitStrings()],
      (sa, sb) => {
        const a = ops.integer(sa);
        const b = ops.integer(sb);
        return ops.eq(0, b) || ops.eq(ops.times(ops.idiv(a, b), b),
                                      ops.minus(a, ops.mod(a, b)));
      },
      options));

    this.it('satisfies a % b >= 0', spec.property(
      [spec.generators.digitStrings(), spec.generators.digitStrings()],
      (sa, sb) => {
        const a = ops.integer(sa);
        const b = ops.integer(sb);
        return ops.eq(0, b) || ops.ge(ops.mod(a, b), 0);
      },
      options));
  });
});


if (require.main == module) {
  JS.Test.autorun();
}
