'use strict';

var I = require('immutable');
var DS = require('./delaney');
var Partition = require('../common/partition');
var seq = require('../common/lazyseq');


var _fold = function _fold(partition, a, b, matchP, spreadFn) {
  var p = partition;
  var q = I.List().push(I.List([a, b]));

  while (!q.isEmpty()) {
    var _tmp = q.first();
    var x = _tmp.get(0);
    var y = _tmp.get(1);

    q = q.rest();

    if (!matchP(x, y))
      return;
    else if (p.get(x) == p.get(y))
      continue;
    else {
      p = p.union(x, y);
      q = q.concat(I.List(spreadFn(x, y)).map(I.List));
    }
  }

  return p;
};


var _typeMap = function _typeMap(ds) {
  var base = I.Map(ds.elements().map(function(D) {
    return [D, I.List()];
  }));
  var idcs = DS.indices(ds);

  return base.withMutations(function(map) {
    idcs.zip(idcs.rest()).forEach(function(p) {
      var i = p[0];
      var j = p[1];

      DS.orbitReps2(ds, i, j).forEach(function(D) {
        var m = DS.m(ds, i, j, D);
        DS.orbit2(ds, i, j, D).forEach(function(E) {
          map.set(E, map.get(E).push(m));
        });
      });
    });
  });
};


var isMinimal = function isMinimal(ds) {
  var D0 = ds.elements().first();
  var tm = _typeMap(ds);

  var match = function(D, E) { return tm.get(D).equals(tm.get(E)); };
  var spread = function(D, E) {
    return ds.indices().map(function(i) {
      return [ds.s(i, D), ds.s(i, E)];
    });
  };

  return ds.elements().rest().every(function(D) {
    return _fold(Partition(), D0, D, match, spread) === undefined;
  });
};


var typePartition = function typePartition(ds) {
  var D0 = ds.elements().first();
  var tm = _typeMap(ds);

  var match = function(D, E) { return tm.get(D).equals(tm.get(E)); };
  var spread = function(D, E) {
    return ds.indices().map(function(i) {
      return [ds.s(i, D), ds.s(i, E)];
    });
  };

  return ds.elements().rest().reduce(
    function(p, D) {
      return _fold(p, D0, D, match, spread) || p;
    },
    Partition()
  );
};


var traversal = function traversal(ds, indices, seeds) {
  var root;
  var todo = I.List(indices)
    .map(function(i) { return [i, I.List()]; })
    .push([root, I.List(seeds)]);
  var seen = I.Set();

  var trim = function trim(entry, seen) {
    return [
      entry[0],
      entry[1].skipWhile(function(x) {
        return seen.contains(I.List([x, entry[0]]));
      })
    ];
  };

  var extend = function extend(entry, D) {
    return [
      entry[0],
      (entry[0] == root) ? entry[1] : entry[1].push(D)
    ];
  };

  var step = function step(todo, seen) {
    var remaining = todo.map(function(entry) { return trim(entry, seen); });
    var next = remaining.filter(function(entry) {
      return !entry[1].isEmpty();
    }).first();

    if (next) {
      var i = next[0];
      var D = next[1].first();
      var Di = (i == root) ? D : ds.s(i, D);

      var t = (D
               ? remaining.map(function(entry) { return extend(entry, Di); })
               : remaining);
      var s = seen.concat([I.List([Di,root]), I.List([D,i]), I.List([Di,i])]);

      return seq.seq([D, i, Di], function() { return step(t, s); });
    } 
  };

  return step(todo, seen);
};


module.exports = {
  isMinimal    : isMinimal,
  typePartition: typePartition,
  traversal    : traversal
};


if (require.main == module) {
  var ds = DS.parse('<1.1:3:1 2 3,1 3,2 3:4 4,3>');
  var tm = _typeMap(ds);

  console.log(tm);
  console.log('' +
              _fold(Partition(), 1, 2,
                    function(D, E) {
                      return tm.get(D).equals(tm.get(E));
                    },
                    function(D, E) {
                      return ds.indices().map(function(i) {
                        return [ds.s(i, D), ds.s(i, E)];
                      });
                    }));

  var test = function(ds) {
    console.log(ds+' is '+(isMinimal(ds) ? '' : 'not ')+'minimal.');
    console.log('    '+typePartition(ds));
  };

  test(ds);
  test(DS.withBranchings(ds, 0, [[2, 4]]));
  test(DS.parse(
    '<1.1:24:' +
      '2 4 6 8 10 12 14 16 18 20 22 24,' +
      '16 3 5 7 9 11 13 15 24 19 21 23,' +
      '10 9 20 19 14 13 22 21 24 23 18 17:' +
      '8 4,3 3 3 3>'));

  console.log('' + traversal(ds, ds.indices(), ds.elements()));
}
