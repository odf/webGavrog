import * as JS from 'jstest';
import * as jsc from 'jsverify';
import * as spec from '../helpers';

import * as types from '../../src/arithmetic/types';


JS.Test.describe('in exact linear algebra', function() {
  this.describe('over fields,', function() {
    const ops = types.rationalLinearAlgebra;

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
  });

  this.describe('over modules,', function() {
    const ops = types.rationalLinearAlgebraModular;

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
  });
});


if (require.main == module) {
  JS.Test.autorun();
}
