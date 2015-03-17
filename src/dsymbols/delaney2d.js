'use strict';

var I  = require('immutable');
var DS = require('./delaney');
var p  = require('./properties');
var Q  = require('../numbers/number');


var _assert = function(condition, message) {
  if (!condition)
    throw new Error(message || 'assertion error');
};


var _indexPairs = function _indexPairs(ds) {
  var idcs = DS.indices(ds).toJS();
  var i = idcs[0], j = idcs[1], k = idcs[2];

  return I.List([[i,j], [i,k], [j,k]]);
};


var curvature = function curvature(ds) {
  _assert(DS.dim(ds) == 2, 'must be two-dimensional');
  _assert(p.isConnected(ds), 'must be connected');

  return ds.indices()
    .flatMap(function(i) {
      return ds.indices().flatMap(function(j) {
        if (j > i)
          return p.orbitReps(ds, [i, j], ds.elements()).map(function(D) {
            var loopless = p.orbit(ds, [i, j], D).every(function(E) {
              return ds.s(i, E) != E && ds.s(j, E) != E;
            });
            return Q.div((loopless ? 2 : 1), ds.v(i, j, D));
          });
      });
    })
    .reduce(function(a, b) { return Q.plus(a, b); }, -DS.size(ds));
};


if (require.main == module) {
  var test = function test(ds) {
    console.log(Q.toString(curvature(ds)));
  };

  test(DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(DS.parse('<1.1:1:1,1,1:5,3>'));
  test(DS.parse('<1.1:1:1,1,1:6,3>'));
  test(DS.parse('<1.1:1:1,1,1:7,3>'));
}
