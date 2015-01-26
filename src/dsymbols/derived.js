'use strict';

var I = require('immutable');
var DS = require('./delaney');


var _assert = function(condition, message) {
  if (!condition)
    throw new Error(message || 'assertion error');
};


var dual = function dual(ds) {
  var d = DS.dim(ds);
  var sz = DS.size(ds);
  var ds0 = DS.blank(d, sz);

  var ds1 = ds.indices().reduce(
    function(tmp, i) {
      var pairs = ds.elements().map(function(D) {
        return I.List([D, ds.s(i, D)]);
      });
      return tmp.withPairings(d-i, pairs);
    },
    ds0);

  var ds2 = ds.indices().filter(function(i) { return i < d; }).reduce(
    function(tmp, i) {
      var specs = ds.elements().map(function(D) {
        return I.List([D, ds.v(i, i+1, D)]);
      });
      return tmp.withBranchings(d-i-1, specs);
    },
    ds1);

  return ds2;
};


var cover = function cover(ds, nrSheets, transferFn) {
  var d = DS.dim(ds);
  var n = DS.size(ds);
  var ds0 = DS.blank(d, n * nrSheets);

  var ds1 = ds.indices().reduce(
    function(tmp, i) {
      var pairs = ds.elements().flatMap(function(D) {
        return I.Range(0, nrSheets).map(function(k) {
          return I.List([
            k * n + D,
            transferFn(k, i, D) * n + ds.s(i, D)
          ]);
        });
      });
      return tmp.withPairings(i, pairs);
    },
    ds0);

  var ds2 = ds.indices().filter(function(i) { return i < d; }).reduce(
    function(tmp, i) {
      var j = i+1;
      var specs = DS.orbitReps2(tmp, i, j).map(function(D) {
        var D0 = (D - 1) % n + 1;
        var v = (DS.m(ds, i, j, D0) || 0) / DS.r(tmp, i, j, D);
        return I.List([D, v]);
      });
      return tmp.withBranchings(i, specs);
    },
    ds1);

  return ds2;
};


if (require.main == module) {
  var ds = DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>');

  console.log('' + ds);
  console.log('' + dual(ds));

  console.log('' + cover(ds, 2, function(k, i, D) {
    return ds.s(i, D) == D ? 1 - k : k;
  }));
}
