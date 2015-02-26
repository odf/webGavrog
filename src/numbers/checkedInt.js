'use strict';

var longInt = require('./longInt');


var CheckedInt = function CheckedInt() {};


var make = function make(n) {
  return {
    type : CheckedInt,
    value: n
  };
};


var promote = function promote(n) {
  if (longInt.shouldPromote(n))
    return longInt.promote(n);
  else
    return make(n);
};


var toString = function toString(n) {
  return n.value.toString();
};


var negative = function negative(n) {
  return make(-n.value);
};


var abs = function abs(n) {
  return make(Math.abs(n.value));
};


var sgn = function sgn(n) {
  return (n.value > 0) - (n.value < 0);
};


var isEven = function isEven(n) {
  return n.value % 2 == 0;
};


var cmp = function cmp(a, b) {
  return a.value - b.value;
};


var plus = function plus(a, b) {
  return promote(a.value + b.value);
};


var minus = function minus(a, b) {
  return promote(a.value - b.value);
};


var times = function times(a, b) {
  var product = a.value * b.value;
  if (longInt.shouldPromote(product))
    return longInt.times(longInt.promote(a.value), longInt.promote(b.value));
  else
    return make(product);
};


var idiv = function idiv(a, b) {
  return make(Math.floor(a.value / b.value));
};


var mod = function mod(a, b) {
  return make(a.value % b.value);
};


module.exports = {
  type      : CheckedInt,
  promote   : promote,
  toString  : toString,
  negative  : negative,
  abs       : abs,
  sgn       : sgn,
  isEven    : isEven,
  cmp       : cmp,
  plus      : plus,
  minus     : minus,
  times     : times,
  idiv      : idiv,
  mod       : mod
};
