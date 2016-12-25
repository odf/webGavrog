import * as JS from 'jstest';
import * as jsc from 'jsverify';
import * as spec from '../helpers';

import { integers } from '../../src/arithmetic/types';

const ops = integers;


JS.Test.describe('a pair a,b of integers', function() {
  this.describe('', spec.property(
    'satisfies (a + b)^2 = a^2 + 2ab + b^2',
    [spec.generators.digitStrings(), spec.generators.digitStrings()],
    (sa, sb) => {
      const a = ops.integer(sa);
      const b = ops.integer(sb);
      return ops.eq(ops.times(ops.plus(a, b), ops.plus(a, b)),
                    ops.plus(ops.plus(ops.times(a, a), ops.times(b, b)),
                             ops.times(2, ops.times(a, b))));
    }));

  this.describe('', spec.property(
    'satisfies (a - b)^2 = a^2 - 2ab + b^2',
    [spec.generators.digitStrings(), spec.generators.digitStrings()],
    (sa, sb) => {
      const a = ops.integer(sa);
      const b = ops.integer(sb);
      return ops.eq(ops.times(ops.minus(a, b), ops.minus(a, b)),
                    ops.minus(ops.plus(ops.times(a, a), ops.times(b, b)),
                              ops.times(2, ops.times(a, b))));
    }));

  this.describe('', spec.property(
    'satisfies (a + b) * (a - b) = a^2 - b^2',
    [spec.generators.digitStrings(), spec.generators.digitStrings()],
    (sa, sb) => {
      const a = ops.integer(sa);
      const b = ops.integer(sb);
      return ops.eq(ops.times(ops.plus(a, b), ops.minus(a, b)),
                    ops.minus(ops.times(a, a), ops.times(b, b)));
    }));

  this.describe('', spec.property(
    'satisfies [a / b] * b = a - a % b unless b = 0',
    [spec.generators.digitStrings(), spec.generators.digitStrings()],
    (sa, sb) => {
      const a = ops.integer(sa);
      const b = ops.integer(sb);
      return ops.eq(0, b) || ops.eq(ops.times(ops.idiv(a, b), b),
                                    ops.minus(a, ops.mod(a, b)));
    }));
});


if (require.main == module) {
  JS.Test.autorun();
}
