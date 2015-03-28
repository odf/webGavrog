'use strict';

var I = require('immutable');


var _neg = function(x) { return -x; };
var _sgn = function(x) { return (x > 0) - (x < 0); };


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
    shift: this.shift.map(_neg)
  });
};

var _isNegative = function _isNegative(vec) {
  var d = vec.map(_sgn).filter(function(x) { return x != 0; }).first();
  return d < 0;
};

Edge.prototype.canonical = function canonical() {
  if (this.tail < this.head ||
      (this.tail == this.head &&  _isNegative(this.shift)))
    return this.reverse();
  else
    return this;
};

var _makeEdge = function _makeEdge(e) {
  return new Edge({ head: e[0], tail: e[1], shift: I.List(e[2]) })
    .canonical();
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


var adjacencies = function adjacencies(graph) {
  var res = I.Map();

  graph.edges.forEach(function(e) {
    res = res
      .update(e.head, function(a) {
        return (a || I.List()).push(I.Map({
          v: e.tail,
          s: e.shift
        }));
      })
      .update(e.tail, function(a) {
        return (a || I.List()).push(I.Map({
          v: e.head,
          s: e.shift.map(_neg)
        }));
      });
  });

  return res;
};


var coordinationSeq = function coordinationSeq(graph, start, dist) {
  var adj  = adjacencies(graph);
  var zero = I.List(I.Repeat(0, graph.dim));
  var add  = function(s, t) {
    return I.Range(0, graph.dim).map(function(i) {
      return s.get(i) + t.get(i);
    });
  };

  var oldShell = I.Set();
  var thisShell = I.Set([I.Map({ v: start, s: zero })]);
  var res = I.List([1]);

  I.Range(1, dist+1).forEach(function(i) {
    var nextShell = I.Set();
    thisShell.forEach(function(v) {
      adj.get(v.get('v')).forEach(function(t) {
        var w = I.Map({ v: t.get('v'), s: add(v.get('s'), t.get('s')) });
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


module.exports = {
  make           : make,
  adjacencies    : adjacencies,
  coordinationSeq: coordinationSeq
};


if (require.main == module) {
  var g = make([[1,1,[1,0,0]], [1,1,[0,-1,0]], [1,1,[0,0,1]]]);
  console.log(g);
  console.log(adjacencies(g));
  console.log(coordinationSeq(g, 1, 10));
}
