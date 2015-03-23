var I = require('immutable');

var checkedInt = function checkedInt(longInt) {
  'use strict';

  var CheckedInt = I.Record({
    type : undefined,
    value: undefined
  });

  CheckedInt.prototype.toString = function() {
    return ''+this.value;
  };


  var make = function make(n) {
    return new CheckedInt({ type: CheckedInt, value: n });
  };


  var toJS = function toJS(n) {
    return n.value;
  };


  var promote = function promote(n) {
    if (longInt.shouldPromote(n))
      return longInt.promote(n);
    else
      return make(n);
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


  return {
    type    : CheckedInt,
    promote : promote,
    toJS    : toJS,
    negative: negative,
    abs     : abs,
    sgn     : sgn,
    isEven  : isEven,
    cmp     : cmp,
    plus    : plus,
    minus   : minus,
    times   : times,
    idiv    : idiv,
    mod     : mod
  };
};


module.exports = checkedInt(require('./longInt'));

module.exports.custom = checkedInt;


if (require.main == module) {
  with(module.exports.custom(require('./longInt').custom(4))) {
    'use strict';

    console.log(promote(-1234));
    console.log(promote(-1234));
    console.log(promote(-12345));
    console.log(promote(-1234567890));

    console.log();
    console.log(plus(promote(1234), promote(8765)));
    console.log(plus(promote(1234), promote(8766)));
    console.log(minus(promote(1234), promote(1234)));
    console.log(minus(promote(1234), promote(1230)));
    console.log(plus(promote(1234), promote(-1234)));

    console.log();
    console.log(abs(promote(-1234)));
    console.log(sgn(promote(1)));
    console.log(sgn(promote(1234)));
    console.log(sgn(promote(0)));
    console.log(sgn(promote(-0)));
    console.log(sgn(promote(-45)));
    console.log(sgn(promote(-1234)));
    console.log(isEven(promote(0)));
    console.log(isEven(promote(-123)));
    console.log(isEven(promote(1234)));

    console.log();
    console.log(times(promote(123), promote(1001)));
    console.log(times(promote(1111), promote(9)));
    console.log(times(promote(1235), promote(9)));
    console.log(idiv(promote(111), promote(37)));
    console.log(idiv(promote(111), promote(3)));
    console.log(idiv(promote(9998), promote(4999)));
    console.log(idiv(promote(2001), promote(1001)));
    console.log(idiv(promote(9999), promote(99)));

    console.log();
    console.log(mod(promote(111), promote(37)));
    console.log(mod(promote(112), promote(37)));
  }
}
