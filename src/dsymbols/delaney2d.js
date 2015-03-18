'use strict';

var I  = require('immutable');
var DS = require('./delaney');
var p  = require('./properties');
var d  = require('./derived');
var Q  = require('../numbers/number');


var _assert = function(condition, message) {
  if (!condition)
    throw new Error(message || 'assertion error');
};


var _map1dOrbits = function _map1dOrbits(fn, ds) {
  return ds.indices().flatMap(function(i) {
    return ds.indices().flatMap(function(j) {
      if (j > i)
        return p.orbitReps(ds, [i, j], ds.elements()).map(function(D) {
          return fn(i, j, D);
        });
    });
  });
};


var curvature = function curvature(ds) {
  _assert(DS.dim(ds) == 2, 'must be two-dimensional');
  _assert(p.isConnected(ds), 'must be connected');

  var orbitContribution = function orbitContribution(i, j, D) {
    var loopless = p.orbit(ds, [i, j], D).every(function(E) {
      return ds.s(i, E) != E && ds.s(j, E) != E;
    });
    return Q.div((loopless ? 2 : 1), ds.v(i, j, D));
  };

  return _map1dOrbits(orbitContribution, ds)
    .reduce(function(a, b) { return Q.plus(a, b); }, -DS.size(ds));
};


var isEuclidean = function isEuclidean(ds) {
  return Q.cmp(curvature(ds), 0) == 0;
};


var isHyperbolic = function isHyperbolic(ds) {
  return Q.cmp(curvature(ds), 0) < 0;
};


var isSpherical = function isSpherical(ds) {
  if (Q.cmp(curvature(ds), 0) <= 0)
    return false;

  var dso = d.orientedCover(ds);
  var cones = _map1dOrbits(dso.v, dso)
    .filter(function(v) { return v > 1; })
    .toJS();
  var n = cones.length;

  return n > 2 || (n == 2 && cones[0] == cones[1]);
};


if (require.main == module) {
  var test = function test(ds) {
    console.log('ds = '+ds);
    console.log('  curvature is '+Q.toString(curvature(ds)));
    console.log('  symbol is '+(isEuclidean(ds) ? '' : 'not ')+'euclidean');
    console.log('  symbol is '+(isHyperbolic(ds) ? '' : 'not ')+'hyperbolic');
    console.log('  symbol is '+(isSpherical(ds) ? '' : 'not ')+'spherical');
    console.log();
  };

  test(DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(DS.parse('<1.1:1:1,1,1:5,3>'));
  test(DS.parse('<1.1:1:1,1,1:6,3>'));
  test(DS.parse('<1.1:1:1,1,1:7,3>'));
  test(DS.parse('<1.1:2:2,1 2,1 2:2,4 4>'));
  test(DS.parse('<1.1:2:2,1 2,1 2:2,4 5>'));
}
