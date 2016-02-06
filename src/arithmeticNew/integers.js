import * as I from 'immutable';


export default function longInt(baseLength = 0) {

  const BASE_LENGTH = (baseLength & ~1) ||
    I.Range(1)
    .filter(function(n) {
      if (n % 2)
        return false;
      const b = Math.pow(10, n);
      return 2 * b - 2 == 2 * b - 1 || -2 * b + 2 == -2 * b + 1;
    })
    .first() - 2;

  const BASE = Math.pow(10, BASE_LENGTH);
  const HALFBASE = Math.sqrt(BASE);

  const ZEROES = ('' + BASE).slice(1);

  const zeroFill = s => ZEROES.slice(s.length) + s;

  const _toString = function _toString(r) {
    return r
      .map(d => zeroFill(''+d))
      .reverse()
      .join('')
      .replace(/^0+/, '');
  };


  class LongInt {
    constructor(sign, digits) {
      this.sign = sign;
      this.digits = digits;
    }

    toString() {
      if (_isZero(this))
        return '0';
      else
        return (this.sign < 0 ? '-' : '') + _toString(this.digits);
    }
  };


  const make = (s, d) => {
    if (d.length > 1)
      return new LongInt(s, d);
    else if (d.length == 1)
      return s * d[0];
    else
      return 0;
  }


  const shouldPromote = n => Math.abs(n) >= BASE;

  const promote = function promote(n) {
    const sign = (n > 0) - (n < 0);
    n = Math.abs(n);

    const digits = [];
    while (n > 0) {
      digits.push(n % BASE);
      n = Math.floor(n / BASE);
    }

    return new LongInt(sign, digits);
  };

  const toJS = n => {
    if (n.sign == 0)
      return 0;
    else
      return (n.sign * n.digits[0] * Math.pow(BASE, n.digits.length - 1));
  };


  const _last = a => a[a.length - 1];


  const parse = function parse(literal) {
    if (!literal.match(/^[+-]?\d+$/))
      throw new Error("expected an integer literal, got "+literal);

    const start = literal.match(/^[+-]/) ? 1 : 0;

    const digits = [];
    let n = literal.length;
    while (n > start) {
      const m = Math.max(n - BASE_LENGTH, start);
      digits.push(parseInt(literal.slice(m, n)));
      n = m;
    }

    while (digits.length > 0 && _last(digits) == 0)
      digits.pop();

    const sign = digits.length == 0 ? 0 : literal[0] == '-' ? -1 : 1;
    
    return make(sign, digits);
  };


  const negative = n => make(-n.sign, n.digits);
  const abs      = n => sgn(n) ? make(1, n.digits) : n;
  const sgn      = n => n.sign;
  const _isZero  = n => n.sign == 0;
  const isEven   = n => _isZero(n) || n.digits[0] % 2 == 0;


  const _cmp = function _cmp(r, s) {
    if (r.length != s.length)
      return r.length - s.length;

    for (let i = r.length - 1; i >= 0; --i)
      if (r[i] != s[i])
        return r[i] - s[i];

    return 0;
  };


  const _plus = function _plus(r, s) {
    const result = [];
    let carry = 0;
    let i = 0;
    while (i < r.length || i < s.length || carry) {
      const digit = (r[i] || 0) + (s[i] || 0) + carry;
      carry = digit >= BASE;
      result.push(digit % BASE);
      ++i;
    }
    return result;
  };


  const _minus = function _minus(r, s) {
    const result = [];
    let borrow = 0;
    let i = 0;
    while (i < r.length || i < s.length) {
      const digit = (r[i] || 0) - (s[i] || 0) - borrow;
      borrow = digit < 0;
      result.push((digit + BASE) % BASE);
      ++i;
    }
    if (borrow)
      throw new Error("panic: internal function called with bad arguments");

    while (_last(result) == 0)
      result.pop();
    return result;
  };


  const cmp = function cmp(a, b) {
    if (_isZero(a))
      return -b.sign;
    else if (_isZero(b))
      return a.sign;
    else if (a.sign != b.sign)
      return a.sign;
    else
      return a.sign * _cmp(a.digits, b.digits);
  };


  const plus = function plus(a, b) {
    if (_isZero(a))
      return b;
    else if (_isZero(b))
      return a;
    else if (a.sign != b.sign)
      return minus(a, negative(b));
    else
      return make(a.sign, _plus(a.digits, b.digits));
  };


  const minus = function minus(a, b) {
    if (_isZero(a))
      return negative(b);
    else if (_isZero(b))
      return a;
    else if (a.sign != b.sign)
      return plus(a, negative(b));
    else {
      const d = _cmp(a.digits, b.digits);
      if (d == 0)
        return 0;
      else if (d < 0)
        return make(-a.sign, _minus(b.digits, a.digits));
      else
        return make(a.sign, _minus(a.digits, b.digits));
    }
  }


  const _lo = d => d % HALFBASE;
  const _hi = d => Math.floor(d / HALFBASE);


  const _digitByDigit = function _digitByDigit(a, b) {
    if (b < BASE / a)
      return [a*b, 0];
    else {
      const alo = _lo(a);
      const ahi = _hi(a);
      const blo = _lo(b);
      const bhi = _hi(b);

      const m = alo * bhi + blo * ahi;
      const lo = alo * blo + _lo(m) * HALFBASE;

      return [lo % BASE, ahi * bhi + _hi(m) + (lo >= BASE)];
    }
  };

  const _seqByDigit = function _seqByDigit(s, d) {
    const result = [];
    let carry = 0;
    for (let i = 0; i < s.length; ++i) {
      const t = _digitByDigit(d, s[i]);
      result.push(t[0] + carry);
      carry = t[1];
    }
    if (carry)
      result.push(carry);
    return result;
  };


  const _times = function _times(r, s) {
    const result = [];
    let tmp = [];
    for (let i = 0; i < r.length; ++i) {
      tmp = _plus(tmp, _seqByDigit(s, r[i]));
      result.push(tmp.shift());
    }
    for (let i = 0; i < tmp.length; ++i)
      result.push(tmp[i]);
    return result;
  };


  const times = function times(a, b) {
    if (_isZero(a))
      return a;
    else if (_isZero(b))
      return b;
    else
      return make(a.sign * b.sign, _times(a.digits, b.digits));
  };


  const _idiv = function _idiv(r, s) {
    const scale = Math.floor(BASE / (_last(s) + 1));
    const rs = _seqByDigit(r, scale);
    const ss = _seqByDigit(s, scale);
    const m = ss.length;
    const d = _last(ss) + 1;

    let q = [];
    let h = [];
    let t = rs;

    let f, n;

    while (true) {
      while (_last(q) == 0)
        q.pop();

      if (_cmp(h, ss) >= 0) {
        n = _last(h) * (h.length > m ? BASE : 1);
        f = Math.floor(n / d) || 1;
        q = _plus(q, [f]);
        h = _minus(h, _seqByDigit(ss, f));
      } else if (t.length) {
        q.unshift(0);
        h.unshift(_last(t))
        t.pop();
      } else
        return q;
    }
  };


  const idiv = function idiv(a, b) {
    const d = _cmp(a.digits, b.digits);
    if (d < 0)
      return 0;
    else if (d == 0)
      return a.sign * b.sign;
    else
      return make(a.sign * b.sign, _idiv(a.digits, b.digits));
  };


  const checkedOperator = (longMethod, nativeMethod) => (x, y) => {
    const t = nativeMethod(x, y);
    if (shouldPromote(x) || shouldPromote(y) || shouldPromote(t))
      return longMethod(promote(x), promote(y));
    else
      return t;
  };


  return {
    parsers: {
      LongInt: parse
    },

    methods: {
      toJS: [
        { argtypes: ['LongInt'], method: toJS },
        { argtypes: ['Integer'], method: x => x }
      ],
      negative: [
        { argtypes: ['LongInt'], method: negative },
        { argtypes: ['Integer'], method: x => -x }
      ],
      abs: [
        { argtypes: ['LongInt'], method: abs },
        { argtypes: ['Integer'], method: x => Math.abs(x) }
      ],
      sgn: [
        { argtypes: ['LongInt'], method: sgn },
        { argtypes: ['Integer'], method: x => (x > 0) - (x < 0) }
      ],
      isEven: [
        { argtypes: ['LongInt'], method: isEven },
        { argtypes: ['Integer'], method: x => x % 2 == 0 }
      ],
      cmp: [
        { argtypes: ['LongInt', 'LongInt'], method: cmp },
        { argtypes: ['LongInt', 'Integer'],
          method  : (x, y) => cmp(x, promote(y)) },
        { argtypes: ['Integer', 'LongInt'],
          method  : (x, y) => cmp(promote(x), y) },
        { argtypes: ['Integer', 'Integer'],
          method  : (x, y) => (x > y) - (x < y) }
      ],
      plus: [
        { argtypes: ['LongInt', 'LongInt'], method: plus },
        { argtypes: ['LongInt', 'Integer'],
          method  : (x, y) => plus(x, promote(y)) },
        { argtypes: ['Integer', 'LongInt'],
          method  : (x, y) => plus(promote(x), y) },
        { argtypes: ['Integer', 'Integer'],
          method  : checkedOperator(plus, (x, y) => x + y) }
      ],
      minus: [
        { argtypes: ['LongInt', 'LongInt'], method: minus },
        { argtypes: ['LongInt', 'Integer'],
          method  : (x, y) => minus(x, promote(y)) },
        { argtypes: ['Integer', 'LongInt'],
          method  : (x, y) => minus(promote(x), y) },
        { argtypes: ['Integer', 'Integer'],
          method  : checkedOperator(minus, (x, y) => x - y) }
      ],
      times: [
        { argtypes: ['LongInt', 'LongInt'], method: times },
        { argtypes: ['LongInt', 'Integer'],
          method  : (x, y) => times(x, promote(y)) },
        { argtypes: ['Integer', 'LongInt'],
          method  : (x, y) => times(promote(x), y) },
        { argtypes: ['Integer', 'Integer'],
          method  : checkedOperator(times, (x, y) => x * y) }
      ],
      idiv: [
        { argtypes: ['LongInt', 'LongInt'], method: idiv },
        { argtypes: ['LongInt', 'Integer'],
          method  : (x, y) => idiv(x, promote(y)) },
        { argtypes: ['Integer', 'LongInt'],
          method  : (x, y) => idiv(promote(x), y) },
        { argtypes: ['Integer', 'Integer'],
          method  : (x, y) => Math.floor(x / y) }
      ]
    }
  };
};


if (require.main == module) {
  const { parsers, methods } = longInt();

  const ops = require('./base').default().register(methods).ops();
  const timer = require('../common/util').timer();

  const N = 59;
  let t = 1;

  for (let i = 1; i < N; ++i) {
    t = ops.times(t, i);
    console.log(`${t}`);
  }

  for (let i = 1; i < N; ++i) {
    t = ops.idiv(t, i);
    console.log(`${t}`);
  }

  console.log();
  console.log(`Computation time: ${timer()} msec`);
}
