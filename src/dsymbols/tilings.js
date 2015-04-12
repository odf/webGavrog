'use strict';

var I = require('immutable');
var Q = require('../arithmetic/number');
var M = require('../arithmetic/matrix')(Q, 0, 1);

var cosets      = require('../fpgroups/cosets');
var delaney     = require('./delaney');
var properties  = require('./properties');
var delaney2d   = require('./delaney2d');
var delaney3d   = require('./delaney3d');
var fundamental = require('./fundamental');
var covers      = require('./covers');
var periodic    = require('../pgraphs/periodic');


var _remainingIndices = function _remainingIndices(ds, i) {
  return ds.indices().filter(function(j) { return j != i; });
};


var _edgeTranslations = function _edgeTranslations(cov) {
  var fg  = fundamental.fundamentalGroup(cov);
  var n   = fg.nrGenerators;
  var nul = M.nullSpace(M.make(cosets.relatorMatrix(n, fg.relators)));

  return fg.edge2word.map(function(a) {
    return a.map(function(b) {
      var v = M.make([cosets.relatorAsVector(b, n)]);
      return M.times(v, nul);
    });
  });
};


var _cornerShifts = function _cornerShifts(cov, e2t) {
  var dim = delaney.dim(cov);
  var zero = M.constant(1, dim);

  return I.Map().withMutations(function(m) {
    cov.indices().forEach(function(i) {
      var idcs = _remainingIndices(cov, i);

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


var _skeleton = function _skeleton(cov, e2t, c2s) {
  var dim = delaney.dim(cov);
  var zero = M.constant(1, dim);
  var chambers = cov.elements();
  var idcs0 = _remainingIndices(cov, 0);
  var nodeReps = properties.orbitReps(cov, idcs0, chambers);
  var node2chamber = I.Map(I.Range().zip(nodeReps));
  var chamber2node = I.Map(nodeReps.zip(I.Range()).flatMap(function(p) {
    return properties.orbit(cov, idcs0, p[0]).zip(I.Repeat(p[1]));
  }));

  var edges = properties.orbitReps(cov, _remainingIndices(cov, 1), chambers)
    .map(function(D) {
      var E = cov.s(0, D);
      var v = chamber2node.get(D);
      var w = chamber2node.get(E);
      var t = e2t.getIn([D, 0]) || zero;
      var sD = c2s.getIn([D, 0]);
      var sE = c2s.getIn([E, 0]);
      var s = M.minus(M.plus(t, sE), sD);

      return [v, w, s.data.get(0).map(Q.toJS)];
    });

  return periodic.make(edges);
};


var net = function net(ds) {
  var cov = (delaney.dim(ds) == 3 ?
             delaney3d.pseudoToroidalCover(ds) :
             delaney2d.toroidalCover(ds));
  var e2t = _edgeTranslations(cov);
  var c2s = _cornerShifts(cov, e2t);

  return _skeleton(cov, e2t, c2s);
};


module.exports = {
  net: net
};


if (require.main == module) {
  var test = function test(ds) {
    console.log('ds = '+ds);
    var cov = (delaney.dim(ds) == 3 ?
               delaney3d.pseudoToroidalCover(ds) :
               delaney2d.toroidalCover(ds));
    console.log('cov = '+cov);
    var e2t = _edgeTranslations(cov);
    var c2s = _cornerShifts(cov, e2t);
    var skel = _skeleton(cov, e2t, c2s);
    console.log('skeleton: '+skel);
    console.log('skeleton placement: '+periodic.barycentricPlacement(skel));
    console.log();
  }

  test(delaney.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(delaney.parse('<1.1:1:1,1,1:6,3>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));
  test(delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>'));
  test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'));
}
