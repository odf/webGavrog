import * as JS from 'jstest';
import * as jsc from 'jsverify';
import * as spec from '../helpers';

import solve from '../../src/arithmetic/solveRational';
import { matrices } from '../../src/arithmetic/types';


JS.Test.describe('solveRational', spec.property(
  'returnsASolution',
  [spec.generators.linearEquations(jsc.nat)],
  ([A, b]) => {
    const x = solve(A, b);
    return x == null || matrices.eq(matrices.times(A, x), b);
  },
  { tests: 1000, size: 100 }
));


if (require.main == module) {
  JS.Test.autorun();
}
