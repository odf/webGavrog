'use strict';

var I = require('immutable');
var DS = require('./delaney');


var dual = function dual(ds) {
  var d = DS.dim(ds);

  return DS.build(
    d, DS.size(ds),
    function(_, i) {
      return ds.elements().map(function(D) {
        return I.List([D, ds.s(d - i, D)]);
      });
    },
    function(tmp, i) {
      return ds.elements().map(function(D) {
        return I.List([D, ds.v(d-i-1, d-i, D)]);
      });
    }
  );
};


var cover = function cover(ds, nrSheets, transferFn) {
  var n = DS.size(ds);

  return DS.build(
    DS.dim(ds), n * nrSheets,
    function(_, i) {
      return ds.elements().flatMap(function(D) {
        return I.Range(0, nrSheets).map(function(k) {
          return I.List([
            k * n + D,
            transferFn(k, i, D) * n + ds.s(i, D)
          ]);
        });
      });
    },
    function(tmp, i) {
      var j = i+1;
      return DS.orbitReps2(tmp, i, j).map(function(D) {
        var D0 = (D - 1) % n + 1;
        var v = (DS.m(ds, i, j, D0) || 0) / DS.r(tmp, i, j, D);
        return I.List([D, v]);
      });
    }
  );
};


if (require.main == module) {
  var ds = DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>');

  console.log('' + ds);
  console.log('' + dual(ds));

  console.log('' + cover(ds, 2, function(k, i, D) {
    return ds.s(i, D) == D ? 1 - k : k;
  }));
}
