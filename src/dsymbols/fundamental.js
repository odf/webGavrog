'use strict';

var I = require('immutable');

var util       = require('../common/util');
var seq        = require('../common/lazyseq');
var freeWords  = require('../fpgroups/freeWords');
var DS         = require('./delaney');
var properties = require('./properties');


var _other = function _other(a, b, c) {
  return a == c ? b : a;
};


var _glue = function _glue(ds, bnd, D, i) {
  var E = ds.s(i, D);

  return bnd.withMutations(function(map) {
    ds.indices()
      .filter(function(j) {
        return j != i && bnd.getIn([D, i, j]);
      })
      .forEach(function(j) {
        var oppD = bnd.getIn([D, i, j]);
        var oppE = bnd.getIn([E, i, j]);
        var count = D == E ? oppD.count : oppD.count + oppE.count;
        map.setIn([oppD.chamber, oppD.index, _other(i, j, oppD.index)],
                  { chamber: oppE.chamber, index: oppE.index, count: count });
        map.setIn([oppE.chamber, oppE.index, _other(i, j, oppE.index)],
                  { chamber: oppD.chamber, index: oppD.index, count: count });
      });
    map.deleteIn([D, i]).deleteIn([E, i]);
  });
};


var _todoAfterGluing = function _todoAfterGluing(ds, bnd, D, i) {
  var onMirror = ds.s(i, D) == D;

  return I.List().withMutations(function(list) {
    ds.indices().forEach(function(j) {
      var opp = bnd.getIn([D, i, j]);

      if (opp) {
        var E = opp.chamber;
        var k = opp.index;
        if (onMirror == (ds.s(k, E) == E))
          list.push(I.List([E, k, _other(i, j, k)]));
      }
    });
  });
};


var _glueRecursively = function _glueRecursively(ds, bnd, facets) {
  var boundary = bnd;
  var todo = I.List(facets).map(I.List);
  var glued = I.List();

  while (!todo.isEmpty()) {
    var next = todo.first();
    todo = todo.shift();

    var D = next.get(0);
    var i = next.get(1);
    var j = next.get(2);
    var m = DS.m(ds, i, j, D) * (ds.s(i, D) == D ? 1 : 2);

    var opp = boundary.getIn(next);

    if (opp && (j == null || opp.count == m)) {
      todo = todo.concat(_todoAfterGluing(ds, boundary, D, i));
      boundary = _glue(ds, boundary, D, i);
      glued = glued.push(next);
    }
  }

  return I.Map({ boundary: boundary, glued: glued });
};


var _spanningTree = function _spanningTree(ds) {
  var seen = I.Set();
  var todo = I.List();
  var root = properties.traversal.root;

  properties.traversal(ds, ds.indices(), ds.elements()).forEach(function(e) {
    var D = e[0];
    var i = e[1];
    var E = e[2];

    if (i != root && !seen.contains(E))
      todo = todo.push(I.List([D, i]));
    seen = seen.add(E);
  });

  return todo;
};


var _initialBoundary = function _initialBoundary(ds) {
  return I.Map().withMutations(function(map) {
    ds.elements().forEach(function(D) {
      ds.indices().forEach(function(i) {
        ds.indices().forEach(function(j) {
          if (i != j)
            map.setIn([D, i, j], { chamber: D, index: j, count: 1 });
        });
      });
    });
  });
};


var innerEdges = function innerEdges(ds) {
  return _glueRecursively(ds, _initialBoundary(ds), _spanningTree(ds))
    .get('glued')
    .map(function(a) { return a.slice(0, 2); });
};


var _traceWord = function _traceWord(ds, edge2word, i, j, D) {
  var E = ds.s(i, D);
  var k = j;
  var factors = [];

  while(true) {
    factors.push(edge2word.getIn([E, k]) || freeWords.empty);
    if (E == D && k ==i)
      break;

    E = ds.s(k, E) || E;
    k = _other(i, j, k);
  }

  return freeWords.product(factors);
};


var _updatedWordMap = function _updatedWordMap(ds, edge2word, D, i, gen, glued) {
  return edge2word.withMutations(function(e2w) {
    e2w.setIn([D, i], freeWords.word([gen]));
    e2w.setIn([ds.s(i, D), i], freeWords.inverse([gen]));
    glued.rest().forEach(function(e) {
      var D = e.get(0);
      var i = e.get(1);
      var j = e.get(2);
      var w = _traceWord(ds, e2w, i, j, D);

      if (!freeWords.empty.equals(w)) {
        e2w.setIn([D, i], freeWords.inverse(w));
        e2w.setIn([ds.s(i, D), i], w);
      }
    });
  });
};


var _findGenerators = function _findGenerators(ds) {
  var boundary = _glueRecursively(ds, _initialBoundary(ds), _spanningTree(ds))
    .get('boundary');
  var edge2word = I.Map();
  var gen2edge = I.Map();

  ds.elements().forEach(function(D) {
    ds.indices().forEach(function(i) {
      if (boundary.getIn([D, i])) {
        var tmp = _glueRecursively(ds, boundary, [[D, i]]);
        var glued = tmp.get('glued');
        var gen = gen2edge.size+1;

        boundary = tmp.get('boundary');
        gen2edge = gen2edge.set(gen, I.Map({ chamber: D, index: i }));
        edge2word = _updatedWordMap(ds, edge2word, D, i, gen, glued);
      }
    })
  });

  return I.Map({ edge2word: edge2word, gen2edge: gen2edge });
};


var _relatorRep = function(w) {
  return I.Range(0, w.size).flatMap(function(i) {
    var wx = freeWords.product([w.slice(i), w.slice(0, i)]);
    return [wx, freeWords.inverse(wx)];
  }).min(util.cmpLex(function(a, b) { return a * b * (a - b); }));
};


var _sgn = function _sgn(x) { return (x > 0) - (x < 0); };
var _sum = function(a) {
  return a.reduce(function(x, y) { return x + y; }, 0);
};

var _relatorMatrix = function _relatorMatrix(nrgens, rels) {
  return rels.map(function(rel) {
    var counts = rel.groupBy(Math.abs).map(function(a) {
      return _sum(a.map(_sgn));
    });
    return I.List(I.Range(0, nrgens+1).map(function(i) {
      return counts.get(i) || 0;
    }));
  });
};


var FundamentalGroup = I.Record({
  nrGenerators : undefined,
  relators     : undefined,
  cones        : undefined,
  gen2edge     : undefined,
  edge2word    : undefined,
  relatorMatrix: undefined
});


var fundamentalGroup = function fundamentalGroup(ds) {
  var tmp = _findGenerators(ds);
  var edge2word = tmp.get('edge2word');
  var gen2edge = tmp.get('gen2edge');

  var orbits = ds.indices().flatMap(function(i) {
    return ds.indices().flatMap(function(j) {
      if (j > i)
        return properties.orbitReps(ds, [i, j]).flatMap(function(D) {
          var w = _traceWord(ds, edge2word, i, j, D);
          var v = ds.v(i, j, D);
          if (v && w.size > 0)
            return [[D, i, j, w, v]];
        });
    });
  });

  var orbitRelators = orbits
    .map(function(orb) { return freeWords.raisedTo(orb[4], orb[3]); });

  var mirrors = gen2edge.entrySeq()
    .filter(function(e) {
      var D = e[1].get('chamber');
      var i = e[1].get('index');
      return ds.s(i, D) == D;
    })
    .map(function(e) {
      return freeWords.word([e[0], e[0]]);
    });

  var cones = orbits
    .filter(function(orb) { return orb[4] > 1; })
    .map(function(orb) { return orb.slice(3); })
    .sort();

  var nrGens = gen2edge.size;
  var rels   = I.Set(orbitRelators.concat(mirrors).map(_relatorRep)).sort();

  return FundamentalGroup({
    nrGenerators : nrGens,
    relators     : rels,
    cones        : cones,
    gen2edge     : gen2edge,
    edge2word    : edge2word,
    relatorMatrix: _relatorMatrix(nrGens, rels)
  });
};


module.exports = {
  fundamentalGroup: fundamentalGroup,
  innerEdges      : innerEdges
};


if (require.main == module) {
  var test = function test(ds) {
    console.log('ds = '+ds);
    console.log();

    console.log('    spanning tree: '+JSON.stringify(_spanningTree(ds)));
    console.log('    inner edges: '+JSON.stringify(innerEdges(ds)));
    console.log();

    var gens = _findGenerators(ds);

    console.log('    generators: '+gens.get('gen2edge'));
    console.log();

    console.log('    edge words: '+gens.get('edge2word'));
    console.log();

    var group = fundamentalGroup(ds);

    console.log('    relators: '+group.relators);
    console.log('    relator matrix: '+group.relatorMatrix);
    console.log();

    console.log('    cones: '+group.cones);
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
