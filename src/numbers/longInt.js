'use strict';

var I = require('immutable');


var BASE_LENGTH = I.Range(1)
  .filter(function(n) {
    if (n % 2)
      return false;
    var b = Math.pow(10, n);
    return 2 * b - 2 == 2 * b - 1 || -2 * b + 2 == -2 * b + 1;
  }).first() - 1;

var BASE = Math.pow(10, BASE_LENGTH);
var HALFBASE = Math.sqrt(BASE);


var LongInt = function LongInt() {};


var make = function make(sign, digits) {
  return {
    type  : LongInt,
    sign  : sign,
    digits: digits
  };
};


var promote = function promote(n) {
  var sign = (n > 0) - (n < 0);
  n = Math.abs(n);

  var digits = I.List().withMutations(function(list) {
    while (n > 0) {
      list.push(n % BASE);
      n = Math.floor(n / BASE);
    }
  });

  return make(sign, digits);
};


var parse = function parse(literal) {
  if (!literal.match(/^[+-]?\d+$/))
    throw new Error("expected an integer literal, got "+literal);

  var sign = literal[0] == '-' ? -1 : 1;

  var digits = I.List().withMutations(function(list) {
    var n = literal.length;
    while (n > 0) {
      var m = Math.max(n - BASE_LENGTH, 0);
      var start = (m == 0 && literal.match(/^[+-]/)) ? 1 : m;
      list.push(parseInt(literal.slice(start, n)));
      n = m;
    }

    while (list.size > 0 && list.last() == 0)
      list.pop();
  });

  if (digits.size == 0)
    sign = 0;

  return make(sign, digits);
};


var negative = function negative(n) {
  return make(-n.sign, n.digits);
};


var abs = function abs(n) {
  return make(1, n.digits);
};


var sgn = function sgn(n) {
};


module.exports = {
  type    : LongInt,
  promote : promote,
  parse   : parse,
  negative: negative,
  abs     : abs,
  sgn     : sgn
};
