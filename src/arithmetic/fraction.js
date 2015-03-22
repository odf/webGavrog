var fraction = function fraction(intType, promoteToInt) {
  'use strict';

  var Fraction = "__Fraction__";


  var make = function make(num, den) {
    return {
      type: Fraction,
      numer: num,
      denom: den
    };
  };


  var promote = function promote(n) {
    return make(n, promoteToInt(1));
  };


  var gcd = function gcd(a, b) {
    a = intType.abs(a);
    b = intType.abs(b);

    while (intType.sgn(b) > 0) {
      var t = b;
      b = intType.mod(a, b);
      a = t;
    }

    return a;
  };


  var normalized = function normalized(n, d) {
    var s = intType.sgn(d);

    if (s == 0)
      throw new Error('fraction has zero denominator');
    else if (s < 0)
      return normalized(intType.negative(n), intType.negative(d));
    else {
      var a = gcd(n, d);
      return make(intType.idiv(n, a), intType.idiv(d, a));
    }
  };


  var asInteger = function asInteger(q) {
    if (intType.cmp(q.denom, promoteToInt(1)) == 0)
      return q.numer;
  };


  var toString = function toString(q) {
    var n = asInteger(q);
    if (n !== undefined)
      return intType.toString(n);
    else
      return intType.toString(q.numer) + '/' + intType.toString(q.denom);
  };


  var negative = function negative(q) {
    return make(intType.negative(q.numer), q.denom);
  };


  var abs = function abs(q) {
    return make(intType.abs(q.numer), q.denom);
  };


  var sgn = function sgn(q) {
    return intType.sgn(q.numer);
  };


  var isEven = function isEven(q) {
    var n = asInteger(q);
    return n !== undefined && intType.isEven(n);
  };


  var cmp = function cmp(q, r) {
    return sgn(minus(q, r));
  };


  var plus = function plus(q, r) {
    var a = gcd(q.denom, r.denom);
    var s = intType.idiv(r.denom, a);
    var t = intType.idiv(q.denom, a);

    return normalized(intType.plus(intType.times(s, q.numer),
                                   intType.times(t, r.numer)),
                      intType.times(s, q.denom));
  };


  var minus = function minus(q, r) {
    return plus(q, negative(r));
  };


  var times = function times(q, r) {
    var a = gcd(q.numer, r.denom);
    var b = gcd(q.denom, r.numer);

    return normalized(intType.times(intType.idiv(q.numer, a),
                                    intType.idiv(r.numer, b)),
                      intType.times(intType.idiv(q.denom, b),
                                    intType.idiv(r.denom, a)));
  };


  var inverse = function inverse(q) {
    return normalized(q.denom, q.numer);
  };


  var div = function div(q, r) {
    return times(q, inverse(r));
  };


  var idiv = function idiv(q, r) {
    var t = div(q, r);
    return intType.idiv(q.numer, q.denom);
  };


  var mod = function mod(a, b) {
    return minus(a, times(idiv(a, b), b));
  };


  return {
    type    : Fraction,
    promote : promote,
    asInteger: asInteger,
    toString: toString,
    negative: negative,
    abs     : abs,
    sgn     : sgn,
    isEven  : isEven,
    cmp     : cmp,
    plus    : plus,
    minus   : minus,
    times   : times,
    inverse : inverse,
    div     : div,
    idiv    : idiv,
    mod     : mod
  };
};


module.exports = fraction;


if (require.main == module) {
  var longInt = require('./longInt').custom(4);

  with(module.exports(longInt)) {
    'use strict';

    var show = function(q) {
      console.log(toString(q));
    }

    var q = function(n, d) {
      return div(promote(longInt.promote(n)), promote(longInt.promote(d || 1)));
    };

    show(q(-1234));
    show(q(2, 3));
    show(q(-1234, -26));
    show(q(111111, 185));
    show(times(q(9, 10), q(5, 21)));
    show(minus(q(3, 5), q(7, 11)));
    show(div(q(111111111), q(2 * 12345679)));
    show(plus(q(1, 2), q(1, 2)));
    show(plus(q(2, 3), q(4, 3)));
    show(plus(q(2, 3), q(1)));
    show(div(q(2, 3), q(2)));
  }
}
