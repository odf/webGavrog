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
      var pairs = ds.elements().map(function(D) {
        return I.List([D, ds.v(i, i+1, D)]);
      });
      return tmp.withBranchings(d-i-1, pairs);
    },
    ds1);

  return ds2;
};

if (require.main == module) {
  var ds = DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>');

  console.log('' + ds);
  console.log('' + dual(ds));
}
