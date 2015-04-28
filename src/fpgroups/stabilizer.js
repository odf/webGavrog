'use strict';

var I = require('immutable');
var fw = require('./freeWords');


var _relatorsByStartGen = function _relatorsByStartGen(relators) {
  return I.List(relators).map(I.List)
    .flatMap(function(w) {
      return I.Range(0, w.size).flatMap(function(i) {
        var wx = fw.product([w.slice(i), w.slice(0, i)]);
        return [wx, fw.inverse(wx)];
      });
    })
    .groupBy(function(rel) { return rel.get(0); })
    .map(I.Set);
};


var Edge = I.Record({
  point: undefined,
  gen  : undefined
});


var _inverseGen = function _inverseGen(g) {
  return fw.inverse([g]).first();
};


var _reverseEdge = function _reverseEdge(edge, action) {
  return new Edge({
    point: action(edge.point, edge.gen),
    gen  : _inverseGen(edge.gen)
  });
};


var _closeRelations = function _closeRelations(
  startEdge,
  edge2word,
  relsByGen,
  action
) {
  var queue = I.List([startEdge]);

  while (!queue.isEmpty()) {
    var next = queue.first();
    queue = queue.rest();

    var p = next.point;
    var g = next.gen;

    relsByGen.get(g).forEach(function(r) {
      var x = p;
      var cuts = I.List();
      r.forEach(function(h, i) {
        var next = new Edge({ point: x, gen: h });
        if (edge2word.get(next) == null)
          cuts = cuts.push([i, next]);
        x = action(x, h);
      });

      if (cuts.size == 1) {
        var i = cuts.first()[0];
        var cut = cuts.first()[1];
        var x = cut.point;
        var g = cut.gen;
        var wx = fw.inverse(fw.product([r.slice(i+1), r.slice(0, i)]));

        var trace = fw.empty;
        wx.forEach(function(h) {
          var t = edge2word.get(new Edge({ point: x, gen: h }));
          trace = fw.product([trace, t]);
          x = action(x, h);
        });

        edge2word = edge2word
          .set(cut, trace)
          .set(_reverseEdge(cut, action), fw.inverse(trace));

        queue = queue.push(cut);
      }
    });
  }

  return edge2word;
};


var _spanningTree = function _spanningTree(basePoint, nrGens, action) {
  var queue = I.List([basePoint]);
  var seen = I.Set([basePoint]);
  var gens = I.Range(1, nrGens+1).flatMap(function(i) { return [i, -i]; });
  var edges = I.List();

  while (!queue.isEmpty()) {
    var point = queue.first();
    queue = queue.rest();

    gens.forEach(function(g) {
      var p = action(point, g);
      if (!seen.contains(p)) {
        queue = queue.push(p);
        seen = seen.add(p);
        edges = edges.push(new Edge({ point: point, gen: g }));
      }
    });
  }

  return edges;
};


var stabilizer = function stabilizer(
  basePoint, nrGens, relators, domain, action
) {
  var relsByGen = _relatorsByStartGen(relators);
  var tree = _spanningTree(basePoint, nrGens, action);
  var gens = I.Range(1, nrGens+1).flatMap(function(i) { return [i, -i]; });
  var id = fw.empty;

  var point2word = I.Map([[basePoint, id]]);
  var edge2word = I.Map();

  tree.forEach(function(edge) {
    edge2word = edge2word.set(edge, id).set(_reverseEdge(edge, action), id);
    edge2word = _closeRelations(edge, edge2word, relsByGen, action);
    point2word = point2word.set(
      action(edge.point, edge.gen),
      fw.product([point2word.get(edge.point), [edge.gen]]));
  });

  console.log('point2word = '+point2word);
  console.log('edge2word = '+edge2word);

  var lastGen = 0;
  var subgroupGens = I.List();

  domain.forEach(function(px) {
    var wx = point2word.get(px);
    gens.forEach(function(g) {
      var edge = new Edge({ point: px, gen: g });
      if (edge2word.get(edge) == null) {
        var py = action(px, g);
        var wy = point2word.get(py);
        var h = ++lastGen;
        var redge = _reverseEdge(edge, action);
        edge2word = edge2word
          .set(edge, h)
          .set(redge, _inverseGen(h));
        edge2word = _closeRelations(edge, edge2word, relsByGen, action);
        edge2word = _closeRelations(redge, edge2word, relsByGen, action);

        subgroupGens = subgroupGens.push(fw.product(wx, [g], fw.inverse(wy)));
      }
    });
  });

  console.log('edge2word = '+edge2word);
  console.log();
};


if (require.main == module) {
  var mapFn = function(map) {
    return function() {
      return map.getIn([].slice.apply(arguments));
    };
  };

  stabilizer(
    'a',
    2,
    [[1,1],[2,2],[1,2,1,2]],
    ['a', 'b', 'c', 'd'],
    mapFn(I.Map({
      a: I.Map([[1, 'b'], [2, 'c'], [-1, 'b'], [-2, 'c']]),
      b: I.Map([[1, 'a'], [2, 'd'], [-1, 'a'], [-2, 'd']]),
      c: I.Map([[1, 'd'], [2, 'a'], [-1, 'd'], [-2, 'a']]),
      d: I.Map([[1, 'c'], [2, 'b'], [-1, 'c'], [-2, 'b']]),
    }))
  );

  stabilizer(
    'a',
    3,
    [[1,2,-1,-2],[1,3,-1,-3],[2,3,-2,-3]],
    ['a', 'b'],
    mapFn(I.Map({
      a: I.Map([[1, 'b'], [-1, 'b'], [2, 'a'], [-2, 'a'], [3, 'a'], [-3, 'a']]),
      b: I.Map([[1, 'a'], [-1, 'a'], [2, 'b'], [-2, 'b'], [3, 'b'], [-3, 'b']])
    }))
  );
}
