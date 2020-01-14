import * as JS from 'jstest';

import { permutations, combinations } from '../../src/common/combinatorics';


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

  this.describe('the list of sorted triples out of [1,2,3,4,5,6]', function() {
    this.before(function() {
      this.picks = Array.from(combinations(6, 3)).map(as => as.sort());
    });

    this.it('has the correct length', function() {
      this.assertEqual(20, this.picks.length);
    });

    this.it('contains no duplicates', function() {
      for (let i = 0; i < this.picks.length - 1; ++i) {
        for (let j = i + 1; j < this.picks.length; ++j) {
          this.assertNotEqual(this.picks[i], this.picks[j]);
        }
      }
    });

    this.it('contains triples of numbers out of [1,2,3,4,5,6]', function() {
      for (let i = 0; i < this.picks.length; ++i) {
        const as = this.picks[i];
        this.assertEqual(3, as.length);
        this.assert(as.every(a => a >= 1 && a <= 6));
        this.assertNotEqual(as[0], as[1]);
        this.assertNotEqual(as[0], as[2]);
        this.assertNotEqual(as[1], as[2]);
      }
    });
  });
});
