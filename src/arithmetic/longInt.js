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


  const LongInt = I.Record({
    sign  : undefined,
    digits: undefined
  });


  const _toString = function _toString(r) {
    return r.reverse()
      .map(function(d, i) {
        const s = '' + d;
        return (i == 0 ? '' : ZEROES.slice(s.length)) + s;
      })
      .join('');
  };


  LongInt.prototype.toString = function() {
    if (_isZero(this))
      return '0';
    else
      return (this.sign < 0 ? '-' : '') + _toString(this.digits);
  };

  LongInt.prototype._type = `LongInt(${BASE_LENGTH})`;

  const shouldPromote = n => Math.abs(n) >= BASE;

  const make = function make(sign, digits) {
    return new LongInt({
      sign  : sign,
      digits: digits
    });
  };


  const toJS = function toJS(n) {
    if (n.sign == 0)
      return 0;
    else
      return n.sign * n.digits.first() * Math.pow(BASE, n.digits.size - 1);
  };


  const promote = function promote(n) {
    const sign = (n > 0) - (n < 0);
    n = Math.abs(n);

    const digits = I.List().withMutations(function(list) {
      while (n > 0) {
        list.push(n % BASE);
        n = Math.floor(n / BASE);
      }
    });

    return make(sign, digits);
  };


  const parse = function parse(literal) {
    if (!literal.match(/^[+-]?\d+$/))
      throw new Error("expected an integer literal, got "+literal);

    const start = literal.match(/^[+-]/) ? 1 : 0;

    const digits = I.List().withMutations(function(list) {
      let n = literal.length;
      while (n > start) {
        const m = Math.max(n - BASE_LENGTH, start);
        list.push(parseInt(literal.slice(m, n)));
        n = m;
      }

      while (list.size > 0 && list.last() == 0)
        list.pop();
    });

    const sign = digits.size == 0 ? 0 : literal[0] == '-' ? -1 : 1;
    
    return make(sign, digits);
  };


  const negative = n => make(-n.sign, n.digits);
  const abs      = n => sgn(n) ? make(1, n.digits) : n;
  const sgn      = n => n.sign;
  const _isZero  = n => n.sign == 0;
  const isEven   = n => _isZero(n) || n.digits.first() % 2 == 0;


  const _cmp = function _cmp(r, s) {
    if (r.size != s.size)
      return r.size - s.size;

    return I.Range(0, r.size)
      .map(function(i) { return r.get(i) - s.get(i); })
      .filter(function(x) { return x != 0 })
      .last() || 0;
  };


  const _plus = function _plus(r, s) {
    return I.List().withMutations(function(result) {
      let carry = 0;
      let i = 0;
      while (i < r.size || i < s.size || carry) {
        const digit = (r.get(i) || 0) + (s.get(i) || 0) + carry;
        carry = digit >= BASE;
        result.push(digit % BASE);
        ++i;
      }
    });
  };


  const _minus = function _minus(r, s) {
    return I.List().withMutations(function(result) {
      let borrow = 0;
      let i = 0;
      while (i < r.size || i < s.size) {
        const digit = (r.get(i) || 0) - (s.get(i) || 0) - borrow;
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
        return promote(0);
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
    return I.List().withMutations(function(result) {
      let carry = 0;
      for (let i = 0; i < s.size; ++i) {
        const t = _digitByDigit(d, s.get(i));
        result.push(t[0] + carry);
        carry = t[1];
      }
      if (carry)
        result.push(carry);
    });
  };


  const _times = function _times(r, s) {
    return I.List().withMutations(function(result) {
      let tmp = I.List([]);
      for (let i = 0; i < r.size; ++i) {
        tmp = _plus(tmp, _seqByDigit(s, r.get(i)));
        result.push(tmp.first());
        tmp = tmp.rest();
      }
      for (let i = 0; i < tmp.size; ++i)
        result.push(tmp.get(i));
    });
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
    const scale = Math.floor(BASE / (s.last() + 1));
    const rs = _seqByDigit(r, scale);
    const ss = _seqByDigit(s, scale);
    const m = ss.size;
    const d = ss.last() + 1;

    let q = I.List();
    let h = I.List();
    let t = rs;

    let f, n;

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


  const idiv = function idiv(a, b) {
    const d = _cmp(a.digits, b.digits);
    if (d < 0)
      return promote(0);
    else if (d == 0)
      return promote(a.sign * b.sign);
    else
      return make(a.sign * b.sign, _idiv(a.digits, b.digits));
  };


  const mod = (a, b) => minus(a, times(idiv(a, b), b));


  return {
    shouldPromote: shouldPromote,
    type      : LongInt,
    digitSize : BASE,
    promote   : promote,
    parse     : parse,
    toJS      : toJS,
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


if (require.main == module) {
  const {
    promote, parse,
    negative, abs, sgn, isEven, cmp, plus, minus, times, idiv, mod
  } = longInt(4);

  console.log(promote(-123456789000000));
  console.log(parse('1234'));
  console.log(parse('+1234'));
  console.log(parse('-1234'));
  console.log(parse('-123456789000000'));
  console.log(parse('-123456789000000'));

  console.log();
  console.log(plus(promote(123456789), promote(876543211)));
  console.log(minus(promote(123456789), promote(123450000)));
  console.log(minus(promote(123456789), promote(123456790)));
  console.log(minus(promote(123456789), promote(123456789)));
  console.log(plus(promote(123456789), promote(-123450000)));

  console.log();
  console.log(abs(promote(-12345)));
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
  console.log(times(promote(123), promote(1001)));
  console.log(times(promote(12345), promote(100001)));
  console.log(times(promote(11111), promote(9)));
  console.log(times(promote(12345679), promote(9)));
  console.log(idiv(promote(111111), promote(37)));
  console.log(idiv(promote(111111111), promote(37)));
  console.log(idiv(promote(111111111), promote(12345679)));
  console.log(idiv(promote(99980001), promote(49990001)));
  console.log(idiv(promote(20001), promote(10001)));
  console.log(idiv(promote(99999999), promote(9999)));

  console.log();
  console.log(mod(promote(111), promote(37)));
  console.log(mod(promote(111112), promote(37)));
  console.log(mod(promote(111111111), promote(12345679)));

  {
    const { promote, times } = longInt();
    console.log(times(promote(12345678), promote(100000001)));
  }
}
