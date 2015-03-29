'use strict';

var I = require('immutable');
var Q = require('../arithmetic/number');
var M = require('../arithmetic/matrix')(Q, 0, 1);

var delaney     = require('./delaney');
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


if (require.main == module) {
  var test = function test(ds) {
    console.log('ds = '+ds);
    var dst = delaney2d.toroidalCover(ds);
    console.log('dst = '+dst);
    console.log();
    console.log('edges relators: '+fundamental.fundamentalGroup(dst).edge2word);
    console.log();
    console.log('edges translations: '+_edgeTranslations(dst));
    console.log();
  }

  test(delaney.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(delaney.parse('<1.1:1:1,1,1:6,3>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));
}
