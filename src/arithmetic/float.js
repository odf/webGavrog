'use strict';

module.exports = {
  epsilon : 1e-14,
  toJS    : function(x) { return x; },
  sgn     : function(x) { return (x > 0) - (x < 0); },
  negative: function(x) { return -x; },
  abs     : function(x) { return Math.abs(x); },
  inverse : function(x) { return 1 / x; },
  cmp     : function(x, y) { return x - y; },
  plus    : function(x, y) { return x + y; },
  minus   : function(x, y) { return x - y; },
  times   : function(x, y) { return x * y; },
  div     : function(x, y) { return x / y; }
};
