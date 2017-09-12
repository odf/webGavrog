import * as JS from 'jstest';
import * as jsc from 'jsverify';
import * as spec from '../helpers';

import * as types from '../../src/arithmetic/types';


const properties = {
  solverResult: ops => spec.property(
    [spec.generators.linearEquations(jsc.nat)],
    ([A, v]) => {
      const b = ops.times(A, v);
      const w = ops.solve(A, b);
      return w == null || ops.eq(ops.times(A, w), b);
    }
  ),

  nullSpaceRank: ops => spec.property(
    [spec.generators.linearEquations(jsc.nat)],
    ([A, _]) => ops.rank(ops.nullSpace(A)) == ops.shape(A)[0] - ops.rank(A)
  ),

  nullSpaceResult: ops => spec.property(
    [spec.generators.linearEquations(jsc.nat)],
    ([A, _]) => {
      const N = ops.nullSpace(A);
      return N == null ||
        ops.times(A, N).every(v => v.every(x => ops.eq(x, 0)));
    }
  ),

  inverseRank: ops => spec.property(
    [spec.generators.linearEquations(jsc.nat)],
    ([A, _]) =>
      (ops.inverse(A) != null) == (ops.rank(A) == ops.dimension(A))
  ),

  inverseResult: ops => spec.property(
    [spec.generators.linearEquations(jsc.nat)],
    ([A, _]) => {
      const inv = ops.inverse(A);
      return inv == null ||
        ops.eq(ops.times(A, inv), ops.identityMatrix(A.length));
    }
  )
};


JS.Test.describe('exact linear algebra', function() {
  this.describe('over fields:', function() {
    const ops = types.rationalLinearAlgebra;

    this.describe('the linear equation system solver', function() {
      this.it('returns a correct solution if any',
              properties.solverResult(ops));
    });

    this.describe('the nullSpace operator', function() {
      this.it('determines the correct null space rank',
              properties.nullSpaceRank(ops));
      this.it('returns a correct solution if any',
              properties.nullSpaceResult(ops));
    });

    this.describe('the inverse operator', function() {
      this.it('finds a result exactly for inputs of full rank',
              properties.inverseRank(ops));
      this.it('returns a correct solution if any',
              properties.inverseResult(ops));
    });
  });

  this.describe('over modules:', function() {
    const ops = types.rationalLinearAlgebraModular;

    this.describe('the linear equation system solver', function() {
      this.it('returns a correct solution if any',
              properties.solverResult(ops));
    });

    this.describe('the nullSpace operator', function() {
      this.it('determines the correct null space rank',
              properties.nullSpaceRank(ops));
      this.it('returns a correct solution if any',
              properties.nullSpaceResult(ops));
    });

    this.describe('the inverse operator', function() {
      this.it('returns a correct solution if any',
              properties.inverseResult(ops));
    });
  });
});


if (require.main == module) {
  JS.Test.autorun();
}
