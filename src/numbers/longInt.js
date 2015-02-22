'use strict';

var I = require('immutable');

var BASE_LENGTH = I.Range(1)
  .filter(function(n) {
    if (n % 2)
      return false;
    var b = Math.pow(10, n);
    return 2 * b - 2 == 2 * b - 1 || -2 * b + 2 == -2 * b + 1;
  }).first() - 1;

if (require.main == module)
  BASE_LENGTH = 4;

var BASE = Math.pow(10, BASE_LENGTH);
var HALFBASE = Math.sqrt(BASE);

var ZEROES = ('' + BASE).slice(1);


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
  var start = literal.match(/^[+-]/) ? 1 : 0;

  var digits = I.List().withMutations(function(list) {
    var n = literal.length;
    while (n > start) {
      var m = Math.max(n - BASE_LENGTH, start);
      list.push(parseInt(literal.slice(m, n)));
      n = m;
    }

    while (list.size > 0 && list.last() == 0)
      list.pop();
  });

  if (digits.size == 0)
    sign = 0;

  return make(sign, digits);
};


var _toString = function _toString(r) {
  return r.reverse()
    .map(function(d, i) {
      var s = '' + d;
      return (i == 0 ? '' : ZEROES.slice(s.length)) + s;
    })
    .join('');
};


var toString = function toString(n) {
  if (isZero(n))
    return '0';
  else
    return (isNegative(n) ? '-' : '') + _toString(n.digits);
};


var negative = function negative(n) {
  return make(-n.sign, n.digits);
};


var abs = function abs(n) {
  return make(1, n.digits);
};


var sgn = function sgn(n) {
  return n.sign;
};


var isPositive = function isPositive(n) {
  return n.sign > 0;
};


var isNegative = function isNegative(n) {
  return n.sign < 0;
};


var isZero = function isZero(n) {
  return n.sign == 0;
};


var isEven = function isEven(n) {
  return isZero(n) || n.digits.first() % 2 == 0;
};


var isOdd = function isOdd(n) {
  return !isEven(n);
};


var _cmp = function _cmp(r, s) {
  if (r.size != s.size)
    return r.size - s.size;

  return I.Range(0, r.size)
    .map(function(i) { return r.get(i) - s.get(i); })
    .filter(function(x) { return x != 0 })
    .first() || 0;
};


var _plus = function _plus(r, s) {
  return I.List().withMutations(function(result) {
    var carry = 0;
    var i = 0;
    while (i < r.size || i < s.size || carry) {
      var digit = (r.get(i) || 0) + (s.get(i) || 0) + carry;
      carry = digit >= BASE;
      result.push(digit % BASE);
      ++i;
    }
  });
};


var _minus = function _minus(r, s) {
  return I.List().withMutations(function(result) {
    var borrow = 0;
    var i = 0;
    while (i < r.size || i < s.size) {
      var digit = (r.get(i) || 0) - (s.get(i) || 0) - borrow;
      borrow = digit < 0;
      result.push((digit + BASE) % BASE);
      ++i;
    }
    if (borrow)
      throw new Error("panic: internal function called with bad arguments");

    while (result.last() == 0)
      result.pop();
  });
};


var plus = function plus(a, b) {
  if (isZero(a))
    return b;
  else if (isZero(b))
    return a;
  else if (a.sign != b.sign)
    return minus(a, negative(b));
  else
    return make(a.sign, _plus(a.digits, b.digits));
};


var minus = function minus(a, b) {
  if (isZero(a))
    return negative(b);
  else if (isZero(b))
    return a;
  else if (a.sign != b.sign)
    return plus(a, negative(b));
  else {
    var d = _cmp(a.digits, b.digits);
    if (d == 0)
      return promote(0);
    else if (d < 0)
      return make(-a.sign, _minus(b.digits, a.digits));
    else
      return make(a.sign, _minus(a.digits, b.digits));
  }
}


module.exports = {
  type      : LongInt,
  promote   : promote,
  parse     : parse,
  toString  : toString,
  negative  : negative,
  abs       : abs,
  sgn       : sgn,
  isPositive: isPositive,
  isNegative: isNegative,
  isZero    : isZero,
  isEven    : isEven,
  isOdd     : isOdd,
  plus      : plus,
  minus     : minus
};


if (require.main == module) {
  var show = function(n) {
    console.log(toString(n));
  };

  show(promote(-123456789000000));
  show(parse('1234'));
  show(parse('+1234'));
  show(parse('-1234'));
  show(parse('-123456789000000'));
  console.log();

  show(plus(promote(123456789), promote(876543211)));
  show(minus(promote(123456789), promote(123450000)));
  show(minus(promote(123456789), promote(123456790)));
  show(minus(promote(123456789), promote(123456789)));
  show(plus(promote(123456789), promote(-123450000)));
}
