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
    sign  : digits ? sign : 0,
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

  var s = 1, m = literal;
  if (m[0] == "+")
    m = m.slice(1);
  else if (m[0] == "-") {
    s = -1;
    m = m.slice(1);
  }

  var a = m.length % BASE_LENGTH;
  var b = (m.length - a) / BASE_LENGTH;
  var sections = I.List(I.Range(b, 0).map(function(i) {
    return [a + (i-1) * BASE_LENGTH, a + i * BASE_LENGTH];
  }));
  if (a > 0)
    sections = sections.push([0, a]);

  return make(s, sections.map(function(r) {
    return parseInt(m.slice(r[0], r[1]));
  }));
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
