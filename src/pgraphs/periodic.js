'use strict';

var I = require('immutable');
var Q = require('../arithmetic/number');
var M = require('../arithmetic/matrix')(Q, 0, 1);


var Edge = I.Record({
  head : undefined,
  tail : undefined,
  shift: undefined
});

Edge.prototype.toString = function toString() {
  return 'Edge('+this.head+', '+this.tail+', '+this.shift+')';
};

Edge.prototype.reverse = function reverse() {
  return new Edge({
    head : this.tail,
    tail : this.head,
    shift: this.shift.map(function(x) { return -x; })
  });
};

var _isNegative = function _isNegative(vec) {
  var d = vec
    .map(function(x) { return (x > 0) - (x < 0); })
    .filter(function(x) { return x != 0; })
    .first();
  return d < 0;
};

Edge.prototype.canonical = function canonical() {
  if (this.tail < this.head || (this.tail == this.head
                                && _isNegative(this.shift)))
    return this.reverse();
  else
    return this;
};

var _makeEdge = function _makeEdge(e) {
  return new Edge({ head: e[0], tail: e[1], shift: I.List(e[2]) }).canonical();
};


var Graph = I.Record({
  dim  : undefined,
  edges: undefined
});

Graph.prototype.toString = function toString() {
  return 'PGraph('+this.edges+')';
};


var make = function make(data) {
  var edges = I.Set(data).map(_makeEdge);
  if (edges.size == 0)
    throw new Error('cannot be empty');

  var dim = edges.first().shift.size;
  if (edges.some(function(e) { return e.shift.size != dim; }))
    throw new Error('must have consistent shift dimensions');

  return new Graph({ dim: dim, edges: edges });
};


var CoverVertex = I.Record({
  v: undefined,
  s: undefined
});


var _target = function _target(e) {
  return CoverVertex({ v: e.tail, s: e.shift });
};


var adjacencies = function adjacencies(graph) {
  var res = I.Map();

  graph.edges.forEach(function(e) {
    res = res
      .update(e.head, function(a) {
        return (a || I.List()).push(_target(e));
      })
      .update(e.tail, function(a) {
        return (a || I.List()).push(_target(e.reverse()));
      });
  });

  return res;
};


var coordinationSeq = function coordinationSeq(graph, start, dist) {
  var adj  = adjacencies(graph);
  var zero = I.List(I.Repeat(0, graph.dim));
  var plus = function(s, t) {
    return I.Range(0, graph.dim).map(function(i) {
      return s.get(i) + t.get(i);
    });
  };

  var oldShell = I.Set();
  var thisShell = I.Set([CoverVertex({ v: start, s: zero })]);
  var res = I.List([1]);

  I.Range(1, dist+1).forEach(function(i) {
    var nextShell = I.Set();
    thisShell.forEach(function(v) {
      adj.get(v.v).forEach(function(t) {
        var w = CoverVertex({ v: t.v, s: plus(v.s, t.s) });
        if (!oldShell.contains(w) && !thisShell.contains(w))
          nextShell = nextShell.add(w);
      });
    });

    res = res.push(nextShell.size);
    oldShell = thisShell;
    thisShell = nextShell;
  });

  return res;
};


var _isConnectedOrbitGraph = function _isConnectedOrbitGraph(graph) {
  var adj   = adjacencies(graph);
  var verts = I.List(adj.keySeq());
  var start = verts.first();
  var seen  = I.Set([start]);
  var queue = I.List([start]);

  while (!queue.isEmpty()) {
    var v = queue.first();
    queue = queue.shift();
    adj.get(v).forEach(function(t) {
      var w = t.v;
      if (!seen.contains(w)) {
        seen = seen.add(w);
        queue = queue.push(w);
      }
    });
  }

  return verts.every(function(v) { return seen.contains(v); });
};


var _inc = function _inc(x) { return x + 1; };
var _dec = function _dec(x) { return x - 1; };

var _addToRow = function _addToRow(A, i, vec) {
  vec.forEach(function(x, j) {
    A = M.update(A, i, j, function(y) { return x + y; });
  });
  return A;
};

var _getRow = function _getRow(A, i) {
  return I.List(I.Range(0, A.ncols).map(function(j) { return M.get(A, i, j); }));
};


var barycentricPlacement = function barycentricPlacement(graph) {
  if (!_isConnectedOrbitGraph(graph))
    throw new Error('must have a connected orbit graph');

  var adj   = adjacencies(graph);
  var verts = I.List(adj.keySeq());
  var vIdcs = I.Map(I.Range(0, verts.size).map(function(i) {
    return [verts.get(i), i];
  }));

  var n = verts.size;
  var d = graph.dim;
  var A = M.constant(n+1, n);
  var t = M.constant(n+1, d);

  verts.forEach(function(v, i) {
    adj.get(v).forEach(function(c) {
      if (c.v != v) {
        var j = vIdcs.get(c.v);
        A = M.update(A, i, j, _inc);
        A = M.update(A, i, i, _dec);
        t = _addToRow(t, i, c.s);
      }
    });
  });
  A = M.set(A, n, 0, 1);

  var p = M.solve(A, t);

  return I.Map(I.Range(0, n).map(function(i) {
    return [verts.get(i), _getRow(p, i)];
  }));
};


var barycentricPlacementAsFloat = function barycentricPlacementAsFloat(graph) {
  return barycentricPlacement(graph).map(function(p) {
    return p.map(Q.toJS);
  });
};


module.exports = {
  make                : make,
  adjacencies         : adjacencies,
  coordinationSeq     : coordinationSeq,
  barycentricPlacement: barycentricPlacement,
  barycentricPlacementAsFloat: barycentricPlacementAsFloat
};


if (require.main == module) {
  var test = function test(g) {
    console.log('g = '+g);
    console.log('  cs  = '+coordinationSeq(g, 1, 10));
    console.log('  pos = '+barycentricPlacement(g));
    console.log('      = '+barycentricPlacementAsFloat(g));
    console.log();
  };

  test(make([ [ 1, 1, [ -1,  0,  0 ] ],
              [ 1, 1, [  0, -1,  0 ] ],
              [ 1, 1, [  0,  0, -1 ] ] ]));

  test(make([ [ 1, 2, [ 0, 0, 0 ] ],
              [ 1, 2, [ 1, 0, 0 ] ],
              [ 1, 2, [ 0, 1, 0 ] ],
              [ 1, 2, [ 0, 0, 1 ] ] ]));
}
