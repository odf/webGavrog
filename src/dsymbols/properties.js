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
  var todo = I.List(indices)
    .map(function(i) { return [i, I.List()]; })
    .push([root, I.List(seeds)]);
  var seen = I.Set();

  var trim = function trim(a, i, seen) {
    return a.skipWhile(function(x) { return seen.contains(I.List([x, i])); });
  };

  var push = function push(a, i, D) {
    return i == root ? a : i < 2 ? a.unshift(D) : a.push(D);
  };

  var step = function step(todo, seen) {
    var rest = todo.map(function(e) { return [e[0], trim(e[1], e[0], seen)]; });
    var next = rest
      .filter(function(entry) { return !entry[1].isEmpty(); })
      .first();

    if (next) {
      var i = next[0];
      var D = next[1].first();
      var Di = (i == root) ? D : ds.s(i, D);

      var t = rest.map(function(e) { return [e[0], push(e[1], e[0], Di)]; });
      var s = seen.concat([I.List([Di,root]), I.List([D,i]), I.List([Di,i])]);

      return seq.seq([D, i, Di], function() { return step(t, s); });
    } 
  };

  return step(todo, seen);
};


var root = traversal.root = null;


var orbitReps = function orbitReps(ds, indices, seeds) {
  var reps = seq.map(
    function(e) { return e[2]; },
    seq.filter(
      function(e) { return e[1] == root; },
      traversal(ds, indices, seeds || ds.elements())));

  return I.List(seq.asArray(reps));
};


var isConnected = function isConnected(ds) {
  return seq.size(traversal(ds, ds.indices())) < 2;
};


var orbit = function orbit(ds, indices, seed) {
  var seen = I.Set().asMutable();
  var result = I.List().asMutable();

  traversal(ds, indices, [seed]).forEach(function(e) {
    var D = e[2];
    if (D && !seen.contains(D)) {
      seen.add(D);
      result.push(D);
    }
  });

  return result.asImmutable();
};


var partialOrientation = function partialOrientation(ds) {
  var ori = I.Map().asMutable();

  traversal(ds, ds.indices(), ds.elements()).forEach(function(e) {
    var Di = e[0];
    var i = e[1];
    var D = e[2];

    if (D && !ori.get(D))
      ori.set(D, i == root ? 1 : -ori.get(Di));
  });

  return ori.asImmutable();
};


var isLoopless = function isLoopless(ds) {
  return ds.elements().every(function(D) {
    return ds.indices().every(function(i) {
      return D != ds.s(i, D);
    });
  });
};


var isOriented = function isOriented(ds) {
  var ori = partialOrientation(ds);

  return ds.elements().every(function(D) {
    return ds.indices().every(function(i) {
      return ori.get(D) != ori.get(ds.s(i, D));
    });
  });
};


var isWeaklyOriented = function isWeaklyOriented(ds) {
  var ori = partialOrientation(ds);

  return ds.elements().every(function(D) {
    return ds.indices().every(function(i) {
      var Di = ds.s(i, D);
      return D == Di || ori.get(D) != ori.get(Di);
    });
  });
};


module.exports = {
  isMinimal         : isMinimal,
  typePartition     : typePartition,
  traversal         : traversal,
  orbitReps         : orbitReps,
  isConnected       : isConnected,
  orbit             : orbit,
  partialOrientation: partialOrientation,
  isLoopless        : isLoopless,
  isOriented        : isOriented,
  isWeaklyOriented  : isWeaklyOriented
};


if (require.main == module) {
  var test = function test(ds) {
    console.log('ds = '+ds);
    console.log();

    console.log('    symbol is '+(isConnected(ds) ? '' : 'not ')+'connected.');
    console.log('    symbol is '+(isMinimal(ds) ? '' : 'not ')+'minimal.');
    console.log('    symbol is '+(isLoopless(ds) ? '' : 'not ')+'loopless.');
    console.log('    symbol is '+(isOriented(ds) ? '' : 'not ')+'oriented.');
    console.log('    symbol is '+(isWeaklyOriented(ds) ? '' : 'not ')
                +'weakly oriented.');
    console.log('    type partition: '+typePartition(ds));
    console.log('    traversal: ' + traversal(ds, ds.indices(), ds.elements()));
    console.log();

    console.log('    0,1 orbit reps: '+orbitReps(ds, [0, 1]));
    console.log('    1,2 orbit reps: '+orbitReps(ds, [1, 2]));
    console.log('    0,2 orbit reps: '+orbitReps(ds, [0, 2]));
    console.log();

    console.log('    0,1 orbit of 1: '+orbit(ds, [0, 1], 1));
    console.log('    1,2 orbit of 1: '+orbit(ds, [1, 2], 1));
    console.log('    0,2 orbit of 1: '+orbit(ds, [0, 2], 1));
    console.log();

    console.log('    partial orientation: '+partialOrientation(ds));
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
