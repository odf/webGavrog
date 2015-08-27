var I = require('immutable');


var fraction = function fraction(intType, promoteToInt) {
  'use strict';

  var Fraction = I.Record({
    numer: undefined,
    denom: undefined
  });


  Fraction.prototype.toString = function toString() {
    var n = asInteger(this);
    if (n !== undefined)
      return n.toString();
    else
      return this.numer.toString() + '/' + this.denom.toString();
  };


  var make = function make(num, den) {
    return new Fraction({
      numer: num,
      denom: den
    });
  };


  var promote = function promote(n) {
    return make(n, promoteToInt(1));
  };


  var toJS = function toJS(n) {
    return intType.toJS(n.numer) / intType.toJS(n.denom);
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
    if (intType.sgn(n) == 0)
      return promote(0);

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
    toJS    : toJS,
    asInteger: asInteger,
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
  var longInt = require('./longInt')(4);

  const {
    promote, negative, abs, sgn, isEven, cmp, plus, minus, times, div, mod
  } = fraction(longInt, longInt.promote);

  var q = function(n, d) {
    return div(promote(longInt.promote(n)), promote(longInt.promote(d || 1)));
  };

  console.log(q(-1234));
  console.log(q(2, 3));
  console.log(q(-1234, -26));
  console.log(q(111111, 185));
  console.log(times(q(9, 10), q(5, 21)));
  console.log(minus(q(3, 5), q(7, 11)));
  console.log(div(q(111111111), q(2 * 12345679)));
  console.log(plus(q(1, 2), q(1, 2)));
  console.log(plus(q(2, 3), q(4, 3)));
  console.log(plus(q(2, 3), q(1)));
  console.log(div(q(2, 3), q(2)));
  console.log(plus(q(2, 3), q(-2, 3)));
}
