'use strict';

var I = require('immutable');
var Q = require('../arithmetic/number');
var M = require('../arithmetic/matrix')(Q, 0, 1);

var delaney     = require('./delaney');
var properties  = require('./properties');
var delaney2d   = require('./delaney2d');
var fundamental = require('./fundamental');
var covers      = require('./covers');


var _edgeTranslations = function _edgeTranslations(cov) {
  var fg  = fundamental.fundamentalGroup(cov);
  var nul = M.nullSpace(M.make(fg.relatorMatrix));
  var n   = fg.nrGenerators;

  return fg.edge2word.map(function(a) {
    return a.map(function(b) {
      var v = M.make([fundamental.relatorAsVector(b, n)]);
      return M.times(v, nul);
    });
  });
};


var _cornerShifts = function _cornerShifts(cov, e2t) {
  var dim = delaney.dim(cov);
  var zero = M.constant(1, dim);

  return I.Map().withMutations(function(m) {
    cov.indices().forEach(function(i) {
      var idcs = cov.indices().filter(function(j) { return j != i; });

      properties.traversal(cov, idcs, cov.elements()).forEach(function(e) {
        var Dk = e[0];
        var k  = e[1];
        var D  = e[2];

        if (k == properties.traversal.root)
          m.setIn([D, i], zero);
        else
          m.setIn([D, i], M.minus(m.getIn([Dk, i]), e2t.getIn([Dk, k]) || zero));
      });
    });
  });
};


if (require.main == module) {
  var test = function test(ds) {
    console.log('ds = '+ds);
    var dst = delaney2d.toroidalCover(ds);
    console.log('dst = '+dst);
    console.log();
    console.log('edges relators: '+fundamental.fundamentalGroup(dst).edge2word);
    console.log();
    var e2t = _edgeTranslations(dst);
    console.log('edges translations: '+e2t);
    console.log();
    console.log('corner shifts: '+_cornerShifts(dst, e2t));
    console.log();
  }

  test(delaney.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(delaney.parse('<1.1:1:1,1,1:6,3>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));
}
