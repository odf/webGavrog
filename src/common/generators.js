'use strict';

var I = require('immutable');


var current = function current(spec, stack) {
  return stack.last().first();
};

var result = function result(spec, stack) {
  return spec.extract(current(spec, stack));
};

var step = function step(spec, stack) {
  var children = I.List(spec.children(current(spec, stack)));

  if (children.size > 0)
    return backtracker(spec, stack.push(I.List([
      children.first(), children.rest(), 0
    ])));
  else
    return skip(spec, stack);
};

var skip = function skip(spec, stack) {
  var s = stack;
  while(s.last() && s.last().get(1).size == 0)
    s = s.pop();

  if (s.size > 0) {
    var siblingsLeft = s.last().get(1);
    var branchNr     = s.last().get(2);

    return backtracker(spec, s.pop().push(I.List([
      siblingsLeft.first(), siblingsLeft.rest(), branchNr + 1
    ])));
  }
};


var backtracker = function backtracker(spec, stack) {
  if (stack === undefined)
    return backtracker(spec, I.List([I.List([spec.root, I.List([]), 0])]));
  else {
    return {
      current: function() { return current(spec, stack); },
      result : function() { return result(spec, stack); },
      step   : function() { return step(spec, stack); },
      skip   : function() { return skip(spec, stack); }
    };
  }
};


var results = function results(gen, pred) {
  var g = gen;

  return I.Seq({
    next: function() {
      while (g) {
        if (!pred || pred(g.current())) {
          var val = g.result();
          g = g.step();
          if (val !== undefined)
            return { done: false, value: val };
        } else
          g = g.skip();
      }
      return { done: true };
    }
  });
};


var empty = function empty() {
  return backtracker({
    root    : null,
    extract : function() {},
    children: function() {}
  });
};


var singleton = function singleton(x) {
  return backtracker({
    root    : x,
    extract : function(x) { return x; },
    children: function() {}
  });
};


module.exports = {
  backtracker: backtracker,
  results    : results,
  empty      : empty,
  singleton  : singleton
};


if (require.main == module) {
  var n = parseInt(process.argv[2]);

  var gen = backtracker({
    root    : {
      xs: [],
      sz: 0,
      mx: 1
    },
    extract : function(node) {
      if (node.sz == n)
        return node.xs;
    },
    children: function(node) {
      var ch = [];

      for (var i = node.mx; i < n - node.sz + 1; ++i)
        ch.push({
          xs: node.xs.concat(i),
          sz: node.sz + i,
          mx: Math.max(node.mx, i)
        });

      return ch;
    }
  });

  console.log(JSON.stringify(results(gen)));
}
