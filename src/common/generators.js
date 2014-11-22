'use strict';

var I = require('immutable');
var seq = require('./lazyseq');


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
  while (g) {
    if (!pred || pred(g.current())) {
      if (g.result() !== undefined)
        return seq.seq(g.result(),
                       function() { return results(g.step(), pred); });
      else
        g = g.step();
    } else
      g = g.skip();
  }
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
    root    : [[], 0, 1],
    extract : function(node) {
      var xs = node[0];
      var sz = node[1];

      if (sz == n)
        return xs;
    },
    children: function(node) {
      var xs = node[0];
      var sz = node[1];
      var mx = node[2];
      var ch = [];

      for (var i = mx; i < n - sz + 1; ++i)
        ch.push([xs.concat(i), sz + i, Math.max(mx, i)]);

      return ch;
    }
  });

  console.log(JSON.stringify(results(gen)));
}
