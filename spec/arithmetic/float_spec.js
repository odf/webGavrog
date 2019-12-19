import * as JS from 'jstest';
import * as jsc from 'jsverify';
import * as spec from '../helpers';

import { floats } from '../../src/arithmetic/types';

const ops = floats;

const options = { tests: 100, size: 100 };


const areClose = (x, y, eps=Math.pow(2, -30)) =>
      (x == 0 && Math.abs(y) < eps) ||
      (y == 0 && Math.abs(x) < eps) ||
      Math.abs(x - y) <= eps * Math.max(Math.abs(x), Math.abs(y));


JS.Test.describe('floats', function() {
  this.describe('a pair a,b of numbers', function() {
    this.it('satisfies (a + b)^2 = a^2 + 2ab + b^2', spec.property(
      [jsc.number(), jsc.number()],
      (a, b) => areClose(
        ops.times(ops.plus(a, b), ops.plus(a, b)),
        ops.plus(
          ops.plus(ops.times(a, a), ops.times(b, b)),
          ops.times(2, ops.times(a, b))
        )
      ),
      options));

    this.it('satisfies (a - b)^2 = a^2 - 2ab + b^2', spec.property(
      [jsc.number(), jsc.number()],
      (a, b) => areClose(
        ops.times(ops.minus(a, b), ops.minus(a, b)),
        ops.minus(
          ops.plus(ops.times(a, a), ops.times(b, b)),
          ops.times(2, ops.times(a, b))
        )
      ),
      options));

    this.it('satisfies (a + b) * (a - b) = a^2 - b^2', spec.property(
      [jsc.number(), jsc.number()],
      (a, b) => areClose(
        ops.times(ops.plus(a, b), ops.minus(a, b)),
        ops.minus(ops.times(a, a), ops.times(b, b))
      ),
      options));

    this.it('satisfies (a^2 - b^2) / (a - b) = a + b', spec.property(
      [jsc.number(), jsc.number()],
      (a, b) =>
        areClose(a, b) ||
        areClose(
          ops.div(
            ops.minus(ops.times(a, a), ops.times(b, b)),
            ops.minus(a, b)
          ),
          ops.plus(a, b)
        ),
      options));

    this.it('satisfies [a / b] * b = a - a % b unless b = 0', spec.property(
      [jsc.number(), jsc.number()],
      (a, b) =>
        areClose(0, b) ||
        areClose(
          ops.times(ops.idiv(a, b), b),
          ops.minus(a, ops.mod(a, b))
        ),
      options));

    this.it('satisfies a % b >= 0', spec.property(
      [jsc.number(), jsc.number()],
      (a, b) => areClose(0, b) || ops.ge(ops.mod(a, b), 0),
      options));
  });
});


if (require.main == module) {
  JS.Test.autorun();
}
