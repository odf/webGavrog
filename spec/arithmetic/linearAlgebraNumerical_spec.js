import * as JS from 'jstest';
import * as jsc from 'jsverify';
import * as spec from '../helpers';

import * as types from '../../src/arithmetic/types';


const matricesAreClose = (A, B, ops) => {
  const good = ops.eq(ops.shape(A), ops.shape(B)) &&
    A.every((row, i) => row.every((x, j) => ops.areClose(x, B[i][j])));
  if (!good)
    console.log(`matricesAreClose(${JSON.stringify(A)}, ${JSON.stringify(B)})`);
  return good;
}


const properties = {
  solverResult: ops => spec.property(
    [spec.generators.linearEquations(jsc.nat)],
    ([A, v]) => {
      const b = ops.times(A, v);
      return matricesAreClose(ops.times(A, ops.solve(A, b)), b, ops);
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
        matricesAreClose(ops.times(A, N),
                         ops.matrix(A.length, N[0].length), ops);
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
        matricesAreClose(ops.times(A, inv), ops.identityMatrix(A.length), ops)
    }
  )
};


JS.Test.describe('numerical linear algebra', function() {
  const ops = types.numericalLinearAlgebra;

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


if (require.main == module) {
  JS.Test.autorun();
}
