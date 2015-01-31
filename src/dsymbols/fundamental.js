'use strict';

var I = require('immutable');

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
  var traversal = I.List(seq.asArray(properties.traversal(ds, [i, j], [D])));

  var factors = traversal.skip(2).map(function(e) {
    return edge2word.getIn(e.slice(0, 2)) || freeWords.empty;
  });

  return freeWords.product(factors);
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

        edge2word = edge2word.withMutations(function(e2w) {
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
      }
    })
  });

  return I.Map({ edge2word: edge2word, gen2edge: gen2edge });
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
