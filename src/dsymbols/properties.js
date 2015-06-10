'use strict';

var I = require('immutable');
var DS = require('./delaney');
var Partition = require('../common/partition');


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


var Traversal = function Traversal(ds, indices, seeds) {
  var seedsLeft = I.List(seeds);
  var todo = {};
  var seen = {};
  indices = I.List(indices);
  indices.forEach(function(i) { seen[i] = {}; todo[i] = [] });
  seen[root] = {};

  return {
    next: function() {
      while (true) {
        var i = null, D = null;
        for (var k = 0; k < indices.size; ++k)
          if (todo[indices.get(k)].length > 0) {
            i = indices.get(k);
            D = todo[i].shift();
            break;
          }

        if (D == null && seedsLeft.size > 0) {
          D = seedsLeft.first();
          seedsLeft = seedsLeft.rest();
        }

        if (D == null)
          return { done: true };

        if (!seen[i][D]) {
          var Di = (i == root) ? D : ds.s(i, D);

          indices.forEach(function(i) {
            if (!seen[i][Di]) {
              if (i < 2)
                todo[i].unshift(Di);
              else
                todo[i].push(Di);
            }
          });

          seen[root][Di] = true;
          seen[i][D]     = true;
          seen[i][Di]    = true;

          return { done: false, value: [D, i, Di] };
        }
      }
    }
  };
};

var traversal = function traversal(ds, indices, seeds) {
  return I.Seq(Traversal(ds, indices, seeds));
};

var root = traversal.root = null;


var orbitReps = function orbitReps(ds, indices, seeds) {
  return traversal(ds, indices, seeds || ds.elements())
    .filter(function(e) { return e[1] == root; })
    .map(function(e) { return e[2]; });
};


var isConnected = function isConnected(ds) {
  return orbitReps(ds, ds.indices()).count() < 2;
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


var _branchings = function _branchings(ds, D) {
  var idcs = DS.indices(ds);
  return idcs.zip(idcs.rest()).map(function(p) { return ds.v(p[0], p[1], D); });
};


var invariant = function invariant(ds) {
  var idcs = DS.indices(ds);
  var imap = I.Map(idcs.zip(I.Range())).toJS();
  var best = null;

  var branchings = {};
  ds.elements().forEach(function(D) {
    return branchings[D] = _branchings(ds, D).toJS();
  });

  ds.elements().forEach(function(D0) {
    var trav    = Traversal(ds, idcs, [D0]);
    var emap    = {};
    var n       = 1;
    var current = [];
    var keep    = true;

    while (keep) {
      var next = trav.next();
      if (next.done)
        break;
      next = next.value;
      if (next[2] == null)
        continue;

      var Di = next[0];
      var i  = next[1];
      var D  = next[2];

      var E  = emap[D] || n;
      var chunk = (i == root) ? [-1, E] : [imap[i], emap[Di], E];

      if (E == n) {
        emap[D] = n;
        chunk = chunk.concat(branchings[D]);
        ++n;
      }

      for (var k = 0; best && keep && k < chunk.length; ++k) {
        var d = chunk[k] - best[current.length + k];
        if (d > 0)
          keep = false;
        else if (d < 0)
          best = null;
      }

      current = current.concat(chunk);
    }

    if (best == null)
      best = current;
  });

  return I.List(best);
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
  isWeaklyOriented  : isWeaklyOriented,
  invariant         : invariant
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
    var trav = traversal(ds, ds.indices(), ds.elements());
    console.log('    traversal: ' + trav);
    console.log('    invariant: ' + invariant(ds));
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
  test(DS.parse('<1.1:6:4 6 5,5 4 6,4 6 5:3,6>'));
}
