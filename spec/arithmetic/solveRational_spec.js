import * as JS from 'jstest';
import * as jsc from 'jsverify';
import * as spec from '../helpers';

import solve from '../../src/arithmetic/solveRational';
import { matrices } from '../../src/arithmetic/types';


const solveReturnsASolution = jsc.forall(
  spec.generators.linearEquations(jsc.nat),
  ([A, b]) => {
    const x = solve(A, b);
    return x == null || matrices.eq(matrices.times(A, x), b);
  }
);


JS.Test.describe('solveRational', function() {
  const options = { tests: 1000, size: 100 };
  this.it('returnsASolution', spec.verify(solveReturnsASolution, options));
});


if (require.main == module) {
  JS.Test.autorun();
}
