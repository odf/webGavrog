'use strict';

var longInt = require('./longInt');


var CheckedInt = function CheckedInt() {};


var make = function make(n) {
  return {
    type : CheckedInt,
    value: n
  };
};


var asJSNumber = function asJSNumber(n) {
  return n.value;
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
  asJSNumber: asJSNumber,
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


if (require.main == module) {
  var show = function(n) {
    console.log(toString(n));
  };

  show(promote(-1234));
  console.log(promote(-1234));
  show(promote(-12345));
  console.log(promote(-12345));
  console.log(promote(-1234567890));
  console.log(promote(10000000001));
  console.log(times(promote(-1234567890), promote(10000000001)));

  console.log();
  show(plus(promote(123456789), promote(876543211)));
  show(minus(promote(123456789), promote(123450000)));
  show(minus(promote(123456789), promote(123456790)));
  show(minus(promote(123456789), promote(123456789)));
  show(plus(promote(123456789), promote(-123450000)));

  console.log();
  show(abs(promote(-12345)));
  console.log(sgn(promote(1)));
  console.log(sgn(promote(123456)));
  console.log(sgn(promote(0)));
  console.log(sgn(promote(0)));
  console.log(sgn(promote(-45)));
  console.log(sgn(promote(-12345)));
  console.log(isEven(promote(0)));
  console.log(isEven(promote(-12345)));
  console.log(isEven(promote(12345678)));

  console.log();
  show(times(promote(12345), promote(100001)));
  show(times(promote(11111), promote(9)));
  show(times(promote(12345679), promote(9)));
  show(idiv(promote(111111), promote(37)));
  show(idiv(promote(111111111), promote(37)));
  show(idiv(promote(111111111), promote(12345679)));
  show(idiv(promote(99980001), promote(49990001)));
  show(idiv(promote(20001), promote(10001)));
  show(idiv(promote(99999999), promote(9999)));

  console.log();
  show(mod(promote(111), promote(37)));
  show(mod(promote(111112), promote(37)));
  show(mod(promote(111111111), promote(12345679)));
}
