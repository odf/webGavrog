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
        return ops.eq(ops.times(A, ops.solve(A, b)), b);
      }
    ));
  });

  this.describe('the nullSpace operator', function() {
    this.it('determines the correct null space rank', spec.property(
      [spec.generators.linearEquations(jsc.nat)],
      ([A, _]) => ops.rank(ops.nullSpace(A)) == ops.shape(A)[0] - ops.rank(A)
    ));
    this.it('returns a correct solution', spec.property(
      [spec.generators.linearEquations(jsc.nat)],
      ([A, _]) => {
        const N = ops.nullSpace(A);
        return N == null ||
          ops.times(A, N).every(v => v.every(x => ops.eq(x, 0)));
      }
    ));
  });
};


JS.Test.describe('exact linear algebra', function() {
  this.describe('over fields:',
                test.bind(this, types.rationalLinearAlgebra));

  this.describe('over modules:',
                test.bind(this, types.rationalLinearAlgebraModular));
});


if (require.main == module) {
  JS.Test.autorun();
}
