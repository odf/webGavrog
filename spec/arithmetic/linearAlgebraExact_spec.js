import * as JS from 'jstest';
import * as jsc from 'jsverify';
import * as spec from '../helpers';

import * as types from '../../src/arithmetic/types';


const properties = {
  solverCorrect: ops => spec.property(
    [spec.generators.linearEquations(jsc.nat)],
    ([A, v]) => {
      const b = ops.times(A, v);
      return ops.eq(ops.times(A, ops.solve(A, b)), b);
    }
  )
};


JS.Test.describe('exact linear algebra', function() {
  this.describe('over fields:', function() {
    const ops = types.rationalLinearAlgebra;

    this.describe('the linear equation system solver', function() {
      this.it('returns a correct solution', properties.solverCorrect(ops));
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

    this.describe('the inverse operator', function() {
      this.it('finds a result exactly for inputs of full rank', spec.property(
        [spec.generators.linearEquations(jsc.nat)],
        ([A, _]) =>
          (ops.inverse(A) != null) == (ops.rank(A) == ops.dimension(A))
      ));
    });
  });

  this.describe('over modules:', function() {
    const ops = types.rationalLinearAlgebraModular;

    this.describe('the linear equation system solver', function() {
      this.it('returns a correct solution', properties.solverCorrect(ops));
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

    this.describe('the inverse operator', function() {
    });
  });
});


if (require.main == module) {
  JS.Test.autorun();
}
