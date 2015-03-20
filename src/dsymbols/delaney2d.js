'use strict';

var I  = require('immutable');
var DS = require('./delaney');
var p  = require('./properties');
var d  = require('./derived');
var cv = require('./covers');
var Q  = require('../numbers/number');
var sq = require('../common/lazyseq');


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


var _loopless = function(ds, i, j, D) {
  return p.orbit(ds, [i, j], D).every(function(E) {
    return ds.s(i, E) != E && ds.s(j, E) != E;
  });
};


var curvature = function curvature(ds) {
  _assert(DS.dim(ds) == 2, 'must be two-dimensional');
  _assert(p.isConnected(ds), 'must be connected');

  var orbitContribution = function orbitContribution(i, j, D) {
    return Q.div((_loopless(ds, i, j, D) ? 2 : 1), ds.v(i, j, D));
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


var orbifoldSymbol = function orbifoldSymbol(ds) {
  var orbitType = function(i, j, D) {
    return { v: ds.v(i, j, D), c: _loopless(ds, i, j, D) };
  };

  var v        = function(o) { return o.v; };
  var isCone   = function(o) { return o.v > 1 && o.c; };
  var isCorner = function(o) { return o.v > 1 && !o.c; };

  var types   = _map1dOrbits(orbitType, ds);
  var cones   = types.filter(isCone).map(v);
  var corners = types.filter(isCorner).map(v);

  var cost = Q.toJS(Q.minus(2, [
    Q.div(curvature(ds), 2),
    cones.map(function(v) { return Q.div(v - 1, v); }).reduce(Q.plus, 0),
    corners.map(function(v) { return Q.div(v - 1, 2*v); }).reduce(Q.plus, 0),
    (p.isLoopless(ds) ? 0 : 1)
  ].reduce(Q.plus, 0)));

  var sym = I.List().concat(
    cones.sort().reverse(),
    (p.isLoopless(ds) ? [] : ['*']),
    corners.sort().reverse(),
    (p.isWeaklyOriented(ds) ? I.Repeat('o', cost/2) : I.Repeat('x', cost))
  ).join('');

  if (sym == 'x' || sym == '*' || sym == '')
    return '1'+sym;
  else
    return sym;
};


var toroidalCover = function toroidalCover(ds) {
  _assert(isEuclidean(ds), 'must be euclidean');

  var dso = d.orientedCover(ds);
  var degree = _map1dOrbits(dso.v, dso).max();
  var covers = cv.covers(dso, degree);

  return sq.filter(
    function(ds) {
      return _map1dOrbits(ds.v, ds).every(function(v) { return v == 1; });
    },
    covers)
    .first();
};


if (require.main == module) {
  var test = function test(ds) {
    console.log('ds = '+ds);
    console.log('  curvature is '+Q.toString(curvature(ds)));
    console.log('  symbol is '+(isEuclidean(ds) ? '' : 'not ')+'euclidean');
    console.log('  symbol is '+(isHyperbolic(ds) ? '' : 'not ')+'hyperbolic');
    console.log('  symbol is '+(isSpherical(ds) ? '' : 'not ')+'spherical');
    console.log('  orbifold symbol = '+orbifoldSymbol(ds));
    if (isEuclidean(ds)) {
      var dst = toroidalCover(ds);
      var curv = curvature(dst);
      var orbs = orbifoldSymbol(dst);

      console.log('  toroidal cover = '+dst);

      if (Q.cmp(curv, 0) == 0 && orbs == 'o')
        console.log('    (curvature and orbifold symbol okay)');
      else
        console.error('    !!!! curvature '+Q.toString(curvature(dst))+
                      ', orbifold symbol '+orbifoldSymbol(dst));
    }
    console.log();
  };

  test(DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(DS.parse('<1.1:1:1,1,1:5,3>'));
  test(DS.parse('<1.1:1:1,1,1:6,3>'));
  test(DS.parse('<1.1:1:1,1,1:7,3>'));
  test(DS.parse('<1.1:2:2,1 2,1 2:2,4 4>'));
  test(DS.parse('<1.1:2:2,1 2,1 2:2,4 5>'));
  test(DS.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(DS.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));
}
