'use strict';

var I = require('immutable');


var cmpLex = function cmpLex(cmp) {
  if (typeof cmp != 'function')
    cmp = function(x, y) { return x < y ? -1 : x > y ? 1 : 0; };

  return function(a, b) {
    var n = Math.min(a.size, b.size);
    for (var i = 0; i < n; ++i) {
      var d = cmp(a.get(i), b.get(i));
      if (d)
        return d;
    }
    return a.size - b.size;
  };
};


module.exports = {
  cmpLex: cmpLex
};
