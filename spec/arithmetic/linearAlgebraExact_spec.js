import * as JS from 'jstest';
import * as jsc from 'jsverify';
import * as spec from '../helpers';

import * as types from '../../src/arithmetic/types';


const test = function(ops) {
  this.describe('the linear equation system solver', function() {
    this.it('returns a correct solution', spec.property(
      [spec.generators.linearEquations(jsc.nat)],
      ([A, v]) => {
        const b = ops.times(A, v);
        const x = ops.solve(A, b);
        return ops.eq(ops.times(A, x), b);
      },
      { tests: 1000, size: 100 }));
  });

  this.describe('the nullSpace operator', function() {
    this.it('determines the correct null space rank', spec.property(
      [spec.generators.linearEquations(jsc.nat)],
      ([A, v]) => {
        const [n, m] = ops.shape(A);
        const r = ops.rank(A);
        const N = ops.nullSpace(A);

        if (r == n)
          return N == null;
        else
          return r + ops.rank(ops.transposed(N)) == n;
      },
      { tests: 1000, size: 100 }));
  });
};


JS.Test.describe('in exact linear algebra', function() {
  this.describe('over fields,',
                test.bind(this, types.rationalLinearAlgebra));

  this.describe('over modules,',
                test.bind(this, types.rationalLinearAlgebraModular));
});


if (require.main == module) {
  JS.Test.autorun();
}
