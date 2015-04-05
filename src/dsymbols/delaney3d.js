'use strict';

var I = require('immutable');
var Q = require('../arithmetic/number');
var M = require('../arithmetic/matrix')(Q, 0, 1);

var generators  = require('../common/generators');
var seq         = require('../common/lazyseq');
var cosets      = require('../fpgroups/cosets');
var fundamental = require('./fundamental');
var derived     = require('./derived');
var covers      = require('./covers');


var _coreType = {
   1: 'z1',
   2: 'z2',
   3: 'z3',
   6: 's3',
   8: 'd4',
  12: 'a4',
  24: 's4'
};

var _fullyInvolutive = function _fullyInvolutive(ct) {
  return ct.every(function(row) {
    return row.keySeq().every(function(g) {
      return row.get(g) == row.get(-g);
    });
  });
};

var _traceWord = function _traceWord(ct, k, word) {
  return word.reduce(function(k, g) { return ct.getIn([k, g]); }, k);
};

var _degree = function _degree(ct, word) {
  var k = 0;
  for (var i = 1; ; ++i) {
    k = _traceWord(ct, k, word);
    if (k == 0)
      return i;
  }
};

var _flattensAll = function _flattensAll(ct, cones) {
  return cones.every(function(cone) {
    return _degree(ct, cone[0]) == cone[1];
  });
};

var _isDiagonal = function _isDiagonal(mat) {
  return I.Range(0, mat.nrows).every(function(i) {
    return I.Range(0, mat.ncols).every(function(j) {
      return i == j || Q.sgn(M.get(mat, i, j)) == 0;
    });
  });
};

var _gcd = function _gcd(a, b) {
  a = Q.abs(a);
  b = Q.abs(b);

  while (Q.sgn(b) > 0) {
    var t = b;
    b = Q.mod(a, b);
    a = t;
  }

  return a;
};

var _factors = function _factors(xs) {
  return I.List(xs).withMutations(function(xs) {
    I.Range(0, xs.size).forEach(function(i) {
      var a = xs.get(i);
      I.Range(i+1, xs.size).forEach(function(j) {
        var b = xs.get(j);
        var g = _gcd(a, b);
        xs.set(j, Q.sgn(g) == 0 ? 0 : Q.times(Q.idiv(a, g), b));
        a = g;
      });
      xs.set(i, a);
    });
  });
};

var _invariants = function _invariants(ds) {
  var fg = fundamental.fundamentalGroup(ds);
  var mat = M.make(cosets.relatorMatrix(fg.nrGenerators, fg.relators));

  while (!_isDiagonal(mat)) {
    mat = M.transposed(M.triangulation(mat).R);
    mat = M.transposed(M.triangulation(mat).R);
  }

  var d = Math.min(mat.nrows, mat.ncols);
  var diag = I.Range(0, d).map(function(i) { return M.get(mat, i, i); });
  var factors = _factors(diag)
    .filter(function(x) { return Q.cmp(x, 1) != 0; })
    .sort(Q.cmp);

  return I.Repeat(0, fg.nrGenerators - d).concat(factors);
};

var pseudoToroidalCover = function pseudoToroidalCover(ds) {
  ds = derived.orientedCover(ds);

  var fg = fundamental.fundamentalGroup(ds);
  var cones = fg.cones;

  if (cones.some(function(c) { return c[1] == 5 || c[1] > 6; }))
    throw new Error('violates the crystallographic restriction');

  var cones2 = cones.filter(function(c) { return c[1] == 2; });
  var cones3 = cones.filter(function(c) { return c[1] == 3; });

  var sub4 = generators.results(cosets.tables(fg.nrGenerators, fg.relators, 4));
  var base = I.List(seq.asArray(sub4)).map(cosets.coreTable);

  var cores = base.filter(function(ct) { return _flattensAll(ct, cones); })
    .map(function(ct) {
      if (ct.size == 4)
        return _fullyInvolutive(ct) ? ['v4', ct] : ['z4', ct];
      else
        return [_coreType[ct.size], ct];
    });

  var z2a = base.filter(function(ct) {
    return ct.size == 2 && _flattensAll(ct, cones2);
  });

  var z2b = base.filter(function(ct) {
    return ct.size == 2 && !_flattensAll(ct, cones2);
  });

  var z3a = base.filter(function(ct) {
    return ct.size == 3 && _flattensAll(ct, cones3);
  });

  var s3a = base.filter(function(ct) {
    return ct.size == 6 && _flattensAll(ct, cones3);
  });

  var z6 = z3a.flatMap(function(a) {
    return z2a
      .map(function(b) { return cosets.intersectionTable(a, b); })
      .filter(function(ct) {
        return ct.size == 6 && _flattensAll(ct, cones);
      })
      .map(function(ct) { return ['z6', ct]; });
  });

  var d6 = s3a.flatMap(function(a) {
    return z2b
      .map(function(b) { return cosets.intersectionTable(a, b); })
      .filter(function(ct) {
        return ct.size == 12 && _flattensAll(ct, cones);
      })
      .map(function(ct) { return ['d6', ct]; });
  });

  var categorized = I.List().concat(cores, z6, d6).groupBy(function(a) {
    return a[0];
  });
  var candidates = I.List('z1 z2 z3 z4 v4 s3 z6 d4 d6 a4 s4'.split(' '))
    .flatMap(function(type) {
      return (categorized.get(type) || I.List()).map(function(entry) {
        return covers.coverForTable(ds, entry[1], fg.edge2word);
      });
    });

  return candidates.filter(function(cov) {
    return _invariants(cov).map(Q.sgn).equals(I.List([0,0,0]));
  }).first();
};


if (require.main == module) {
  var delaney = require('./delaney');

  var test = function test(ds) {
    console.log('ds = '+ds);
    var cov = pseudoToroidalCover(ds);
    console.log('cov = '+cov);
    console.log();
  }

  test(delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>'));
  test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'));
}
