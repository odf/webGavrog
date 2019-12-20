import * as JS from 'jstest';
import * as jsc from 'jsverify';
import * as spec from '../helpers';

import { rationals } from '../../src/arithmetic/types';

const ops = rationals;

const options = { tests: 100, size: 100 };


const digits = spec.generators.digitStrings();
const digitsNonZero =
      jsc.suchthat(digits, s => s.length > 1 || s[0] != '0');


JS.Test.describe('long integers', function() {
  this.describe('a pair a,b of fractions', function() {
    this.it('satisfies (a + b)^2 = a^2 + 2ab + b^2', spec.property(
      [digits, digitsNonZero, digits, digitsNonZero],
      (numA, denA, numB, denB) => {
        const a = ops.div(ops.integer(numA), ops.integer(denA));
        const b = ops.div(ops.integer(numB), ops.integer(denB));
        return ops.eq(ops.times(ops.plus(a, b), ops.plus(a, b)),
                      ops.plus(ops.plus(ops.times(a, a), ops.times(b, b)),
                               ops.times(2, ops.times(a, b))));
      },
      options));

    this.it('satisfies (a - b)^2 = a^2 - 2ab + b^2', spec.property(
      [digits, digitsNonZero, digits, digitsNonZero],
      (numA, denA, numB, denB) => {
        const a = ops.div(ops.integer(numA), ops.integer(denA));
        const b = ops.div(ops.integer(numB), ops.integer(denB));
        return ops.eq(ops.times(ops.minus(a, b), ops.minus(a, b)),
                      ops.minus(ops.plus(ops.times(a, a), ops.times(b, b)),
                                ops.times(2, ops.times(a, b))));
      },
      options));

    this.it('satisfies (a + b) * (a - b) = a^2 - b^2', spec.property(
      [digits, digitsNonZero, digits, digitsNonZero],
      (numA, denA, numB, denB) => {
        const a = ops.div(ops.integer(numA), ops.integer(denA));
        const b = ops.div(ops.integer(numB), ops.integer(denB));
        return ops.eq(ops.times(ops.plus(a, b), ops.minus(a, b)),
                      ops.minus(ops.times(a, a), ops.times(b, b)));
      },
      options));

    this.it('satisfies (a^2 - b^2) / (a - b) = a + b', spec.property(
      [digits, digitsNonZero, digits, digitsNonZero],
      (numA, denA, numB, denB) => {
        const a = ops.div(ops.integer(numA), ops.integer(denA));
        const b = ops.div(ops.integer(numB), ops.integer(denB));
        if (ops.eq(a, b))
          return true;

        return ops.eq(
          ops.div(ops.minus(ops.times(a, a), ops.times(b, b)), ops.minus(a, b)),
          ops.plus(a, b)
        );
      },
      options));

    this.it('satisfies [a / b] * b = a - a % b unless b = 0', spec.property(
      [digits, digitsNonZero, digits, digitsNonZero],
      (numA, denA, numB, denB) => {
        const a = ops.div(ops.integer(numA), ops.integer(denA));
        const b = ops.div(ops.integer(numB), ops.integer(denB));
        return ops.eq(0, b) || ops.eq(ops.times(ops.idiv(a, b), b),
                                      ops.minus(a, ops.mod(a, b)));
      },
      options));

    this.it('satisfies a % b >= 0', spec.property(
      [digits, digitsNonZero, digits, digitsNonZero],
      (numA, denA, numB, denB) => {
        const a = ops.div(ops.integer(numA), ops.integer(denA));
        const b = ops.div(ops.integer(numB), ops.integer(denB));
        return ops.eq(0, b) || ops.ge(ops.mod(a, b), 0);
      },
      options));
  });
});


if (require.main == module) {
  JS.Test.autorun();
}
