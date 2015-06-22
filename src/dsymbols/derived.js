'use strict';

var I = require('immutable');
var DS = require('./delaney');
var properties = require('./properties');
var permutations = require('../common/permutations');


var dual = function dual(ds) {
  var d = DS.dim(ds);

  return DS.build(
    d, DS.size(ds),
    function(_, i) {
      return ds.elements().map(function(D) {
        return [D, ds.s(d - i, D)];
      });
    },
    function(tmp, i) {
      return ds.elements().map(function(D) {
        return [D, ds.v(d-i-1, d-i, D)];
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
          return [k * n + D, transferFn(k, i, D) * n + ds.s(i, D)];
        });
      });
    },
    function(tmp, i) {
      var j = i+1;
      return DS.orbitReps2(tmp, i, j).map(function(D) {
        var D0 = (D - 1) % n + 1;
        var v = (DS.m(ds, i, j, D0) || 0) / DS.r(tmp, i, j, D);
        return [D, v];
      });
    }
  );
};


var orientedCover = function orientedCover(ds) {
  if (properties.isOriented(ds))
    return ds;
  else {
    var ori = properties.partialOrientation(ds);

    return cover(ds, 2, function(k, i, D) {
      return ori.get(D) == ori.get(ds.s(i, D)) ? 1 - k : k;
    });
  }
};


var minimal = function minimal(ds) {
  if (properties.isMinimal(ds))
    return ds;
  else {
    var p = properties.typePartition(ds);
    var reps = ds.elements().filter(function(D) { return p.get(D) == D; });
    var emap = I.Map(reps.zip(I.Range(1)));
    var imap = I.Map(I.Range().zip(ds.indices()));

    return DS.build(
      DS.dim(ds), reps.count(),
      function(_, i) {
        return reps.map(function(D) {
          return [emap.get(D), emap.get(p.get(ds.s(imap.get(i), D)))];
        });
      },
      function(tmp, i) {
        return reps.map(function(D) {
          var v = 
            (DS.m(ds, imap.get(i), imap.get(i+1), D) || 0)
            /
            DS.r(tmp, i, i+1, emap.get(D));
          return [emap.get(D), v];
        });
      }
    );
  }
};


var _apply = function _apply(p, i) {
  if (i < 0 || i >= p.size)
    return i;
  else
    return p.get(i) - 1;
};


var barycentricSubdivision = function barycentricSubdivision(ds, splitDim) {
  if (splitDim == 0)
    return ds;
  else {
    var dim = DS.dim(ds);
    var perms = I.List(permutations(splitDim + 1)).map(I.List);
    var pidx = I.Map(I.List(perms).zip(I.Range()));
    var n = DS.size(ds);
    var m = perms.size;

    return DS.build(
      DS.dim(ds), n * m,
      function(_, i) {
        return ds.elements().flatMap(function(D) {
          return I.Range(0, m).map(function(j) {
            var p = perms.get(j);
            if (i < splitDim) {
              var pi = p.set(i, p.get(i+1)).set(i+1, p.get(i));
              var k = pidx.get(pi);
              return [n * j + D, n * k + D];
            } else {
              var E = ds.s(_apply(p, i), D);
              return [n * j + D, n * j + E];
            }
          });
        });
      },
      function(tmp, i) {
        return ds.elements().flatMap(function(D) {
          return I.Range(0, m).map(function(j) {
            var p = perms.get(j);
            var v;
            if (i < splitDim - 1)
              v = 1;
            else
              v = ds.v(_apply(p, i), _apply(p, i+1), D);
            return [n * j + D, v];
          });
        });
      }
    );
  }
};


var canonical = function canonical(ds) {
  var inv = properties.invariant(ds);
  var dim = DS.dim(ds);
  var size = DS.size(ds);

  var ops = I.Map(I.Range(0, dim+1).zip(I.Repeat(I.List())));
  var brs = I.Map(I.Range(0, dim).zip(I.Repeat(I.List())));

  var n = 0;
  var k = -1;

  while (k+1 < inv.size) {
    var i = inv.get(++k);
    var D = inv.get(++k);
    var E = (i >= 0) ? inv.get(++k) : D;
    if (E > n) {
      for (var j = 0; j < dim; ++j)
        brs = brs.set(j, brs.get(j).push([E, inv.get(++k)]));
      n = E;
    }
    if (i >= 0)
      ops = ops.set(i, ops.get(i).push([D, E]));
  }

  return DS.build(dim, size,
                  function(_, i) { return ops.get(i); },
                  function(_, i) { return brs.get(i); });
};


module.exports = {
  dual                  : dual,
  cover                 : cover,
  orientedCover         : orientedCover,
  minimal               : minimal,
  barycentricSubdivision: barycentricSubdivision,
  canonical             : canonical
};


if (require.main == module) {
  var test = function(ds) {
    console.log('ds = '+ds);
    console.log();

    console.log('    dual          : '+dual(ds));
    console.log('    minimal image : ' + minimal(ds));
    console.log('    oriented cover: ' + orientedCover(ds));
    console.log('    canonical     : ' + canonical(ds));
    console.log();

    ds.indices().forEach(function(i) {
      console.log('    '+i+'-subdivision : '+barycentricSubdivision(ds, i));
    });
    console.log();
    console.log();
  };

  test(DS.parse(
    '<1.1:24:' +
      '2 4 6 8 10 12 14 16 18 20 22 24,' +
      '16 3 5 7 9 11 13 15 24 19 21 23,' +
      '10 9 20 19 14 13 22 21 24 23 18 17:' +
      '8 4,3 3 3 3>'));

  test(DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(DS.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
}
