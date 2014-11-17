'use strict';

var I = require('immutable');
var seq = require('./lazyseq');


var backtracker = function backtracker(spec, stack) {
  var _spec     = I.Map(spec);
  var _root     = _spec.get('root');
  var _extract  = _spec.get('extract');
  var _children = _spec.get('children');

  if (stack === undefined)
    return backtracker(spec, I.List([I.List([_root, I.List([]), 0])]));
  else
    return {
      current: function current() {
        return stack.last().first();
      },

      result: function result() {
        return _extract(this.current());
      },

      step: function step() {
        var children = I.List(_children(this.current()));

        if (children.size > 0)
          return backtracker(spec, stack.push(I.List([
            children.first(), children.rest(), 0
          ])));
        else
          return this.skip();
      },

      skip: function skip() {
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
      }
    };
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
