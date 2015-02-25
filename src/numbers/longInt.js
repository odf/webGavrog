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
    .last() || 0;
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


var cmp = function cmp(a, b) {
  if (isZero(a))
    return -b.sign;
  else if (isZero(b))
    return a.sign;
  else if (a.sign != b.sign)
    return a.sign;
  else
    return a.sign * _cmp(a.digits, b.digits);
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


var _lo = function _lo(d) {
  return d % HALFBASE;
};


var _hi = function _hi(d) {
  return Math.floor(d / HALFBASE);
};


var _digitByDigit = function _digitByDigit(a, b) {
  if (b < BASE / a)
    return [a*b, 0];
  else {
    var alo = _lo(a);
    var ahi = _hi(a);
    var blo = _lo(b);
    var bhi = _hi(b);

    var m = alo * bhi + blo * ahi;
    var lo = alo * blo + _lo(m) * HALFBASE;

    return [lo % BASE, ahi * bhi + _hi(m) + (lo >= BASE)];
  }
};


var _seqByDigit = function _seqByDigit(s, d) {
  return I.List().withMutations(function(result) {
    var carry = 0;
    for (var i = 0; i < s.size; ++i) {
      var t = _digitByDigit(d, s.get(i));
      result.push(t[0] + carry);
      carry = t[1];
    }
    if (carry)
      result.push(carry);
  });
};


var _times = function _times(r, s) {
  return I.List().withMutations(function(result) {
    var tmp = I.List([]);
    for (var i = 0; i < r.size; ++i) {
      tmp = _plus(tmp, _seqByDigit(s, r.get(i)));
      result.push(tmp.first());
      tmp = tmp.rest();
    }
    for (var i = 0; i < tmp.size; ++i)
      result.push(tmp.get(i));
  });
};


var times = function times(a, b) {
  if (isZero(a))
    return a;
  else if (isZero(b))
    return b;
  else
    return make(a.sign * b.sign, _times(a.digits, b.digits));
};


var _idiv = function _idivmod(r, s) {
  var scale = Math.floor(BASE / (s.last() + 1));
  var rs = _seqByDigit(r, scale);
  var ss = _seqByDigit(s, scale);
  var m = ss.size;
  var d = ss.last() + 1;

  var q = I.List();
  var h = I.List();
  var t = rs;

  var f, n;

  while (true) {
    while (q.last() == 0)
      q = q.pop();

    if (_cmp(h, ss) >= 0) {
      n = h.last() * (h.size > m ? BASE : 1);
      f = Math.floor(n / d) || 1;
      q = _plus(q, I.List([f]));
      h = _minus(h, _seqByDigit(ss, f));
    } else if (!t.isEmpty()) {
      q = q.unshift(0);
      h = h.unshift(t.last());
      t = t.pop();
    } else
      return q;
  }
};


var idiv = function idiv(a, b) {
  var d = _cmp(a.digits, b.digits);
  if (d < 0)
    return promote(0);
  else if (d == 0)
    return promote(a.sign * b.sign);
  else
    return make(a.sign * b.sign, _idiv(a.digits, b.digits));
};


var mod = function mod(a, b) {
  return minus(a, times(idiv(a, b), b));
};


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

  console.log();
  show(abs(promote(-12345)));
  console.log(isZero(promote(1)));
  console.log(isZero(promote(123456)));
  console.log(isZero(promote(0)));
  console.log(isNegative(promote(0)));
  console.log(isNegative(promote(-45)));
  console.log(isNegative(promote(-12345)));
  console.log(isOdd(promote(0)));
  console.log(isOdd(promote(-12345)));
  console.log(isOdd(promote(12345678)));

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
