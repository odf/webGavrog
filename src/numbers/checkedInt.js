var checkedInt = function checkedInt(longInt) {
  'use strict';

  var CheckedInt = "__CheckedInt__";


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
    return '' + n.value;
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
};


module.exports = checkedInt(require('./longInt'));

module.exports.custom = checkedInt;


if (require.main == module) {
  with(module.exports.custom(require('./longInt').custom(4))) {
    'use strict';

    var show = function(n) {
      console.log(toString(n));
    };

    show(promote(-1234));
    console.log(promote(-1234));
    console.log(promote(-12345));
    console.log(promote(-1234567890));

    console.log();
    show(plus(promote(1234), promote(8765)));
    console.log(plus(promote(1234), promote(8766)));
    show(minus(promote(1234), promote(1234)));
    show(minus(promote(1234), promote(1230)));
    show(plus(promote(1234), promote(-1234)));

    console.log();
    show(abs(promote(-1234)));
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
    show(times(promote(1111), promote(9)));
    console.log(times(promote(1235), promote(9)));
    show(idiv(promote(111), promote(37)));
    show(idiv(promote(111), promote(3)));
    show(idiv(promote(9998), promote(4999)));
    show(idiv(promote(2001), promote(1001)));
    show(idiv(promote(9999), promote(99)));

    console.log();
    show(mod(promote(111), promote(37)));
    show(mod(promote(112), promote(37)));
  }
}
