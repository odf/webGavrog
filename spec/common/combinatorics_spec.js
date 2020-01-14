import * as JS from 'jstest';

import { permutations } from '../../src/common/combinatorics';


JS.Test.describe('combinatorics', function() {
  this.describe('the list of permutations of [1,2,3,4]', function() {
    this.before(function() {
      this.perms = Array.from(permutations(4));
    });

    this.it('has the correct length', function() {
      this.assertEqual(24, this.perms.length);
    });

    this.it('contains no duplicates', function() {
      for (let i = 0; i < this.perms.length - 1; ++i) {
        for (let j = i + 1; j < this.perms.length; ++j) {
          this.assertNotEqual(this.perms[i], this.perms[j]);
        }
      }
    });

    this.it('contains only permutations of [1,2,3,4]', function() {
      for (let i = 0; i < this.perms.length; ++i)
        this.assertEqual(this.perms[i].sort(), [1,2,3,4]);
    });
  });
});
