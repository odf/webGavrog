const findBaseLength = () => {
  for (let n = 2; ; n += 2) {
    const b = Math.pow(2, n);
    if (2 * b - 2 == 2 * b - 1 || -2 * b + 2 == -2 * b + 1)
      return n - 2;
  }
};


export function extend(baseOps, baseLength = 0) {
  const BASE = Math.pow(2, (baseLength & ~1) || findBaseLength());
  const HALFBASE = Math.sqrt(BASE);


  class LongInt {
    constructor(sign, digits) {
      if (digits.some(d => d < 0 || d >= BASE))
        throw new Error(`illegal long integer digits ${digits}`);
      this.sign = sign;
      this.digits = digits;
    }

    toString() {
      if (_isZero(this))
        return '0';
      else if (this.sign < 0)
        return '-' + negative(this).toString();
      else {
        const s = [];
        let t = this.digits;
        while (t.length > 0) {
          const q = _idiv(t, [10]);
          const r = _minus(t, _times(q, [10]));
          s.push(r[0] || 0);
          t = q;
        }
        return s.reverse().join('');
      }
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
    if (!literal.match(/^[+-]?\d{1,3}(_?\d{3})*$/))
      throw new Error("expected an integer literal, got "+literal);

    const s = literal.replace(/^[+-]/, '').replace(/_/g, '');

    let digits = [];
    for (let i = 0; i < s.length; ++i)
      digits = _plus(_times(digits, [10]), [parseInt(s[i])]);

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
    if (s.length > r.length)
      return _plus(s, r);

    const result = r.slice();
    let carry = 0;

    for (let i = 0; i < s.length; ++i) {
      const sum = r[i] + s[i] + carry;
      carry = sum >= BASE;
      result[i] = sum % BASE;
    }

    for (let i = s.length; carry && i < r.length; ++i) {
      const sum = r[i] + carry;
      carry = sum >= BASE;
      result[i] = sum % BASE;
    }

    if (carry)
      result.push(1);

    return result;
  };


  const _minus = function _minus(r, s) {
    const result = r.slice();
    let borrow = 0;

    for (let i = 0; i < s.length; ++i) {
      const dif = r[i] - s[i] - borrow;
      borrow = dif < 0;
      result[i] = (dif + BASE) % BASE;
    }

    for (let i = s.length; borrow && i < r.length; ++i) {
      const dif = r[i] - borrow;
      borrow = dif < 0;
      result[i] = (dif + BASE) % BASE;
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


  const _negative = n => new LongInt(-n.sign, n.digits);

  const plus = function plus(a, b) {
    if (_isZero(a))
      return b;
    else if (_isZero(b))
      return a;
    else if (a.sign != b.sign)
      return minus(a, _negative(b));
    else
      return make(a.sign, _plus(a.digits, b.digits));
  };


  const minus = function minus(a, b) {
    if (_isZero(a))
      return negative(b);
    else if (_isZero(b))
      return a;
    else if (a.sign != b.sign)
      return plus(a, _negative(b));
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
      result.push((t[0] + carry) % BASE);
      carry = t[1] + (t[0] + carry >= BASE);
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
    const scale = Math.floor((BASE - 1) / _last(s));
    const rs = _seqByDigit(r, scale);
    const ss = _seqByDigit(s, scale);
    const m = ss.length;
    const d = _last(ss) + 1;

    let q = [];
    let h = [];
    let t = rs;

    let f, n, ssf;

    while (true) {
      while (_last(q) == 0)
        q.pop();

      if (_cmp(h, ss) >= 0) {
        n = _last(h) * (h.length > m ? BASE : 1);
        f = Math.floor(n / d) || 1;
        ssf = _seqByDigit(ss, f);
        if (_cmp(h, ssf) < 0) {
          --f;
          ssf = _minus(ssf, ss);
        }
        q = _plus(q, [f]);
        h = _minus(h, ssf);
      } else if (t.length) {
        q.unshift(0);
        h.unshift(_last(t))
        t.pop();
      } else
        return q;
    }
  };


  const idiv = function idiv(a, b) {
    if (b.sign == 0)
      throw new Error('division by zero');

    const d = _cmp(a.digits, b.digits);

    if (d < 0)
      return 0;
    else if (d == 0)
      return a.sign * b.sign;
    else {
      const s = a.sign * b.sign;
      if (s > 0)
        return make(s, _idiv(a.digits, b.digits));
      else
        return make(s, _idiv(_plus(a.digits, _minus(b.digits, [1])), b.digits));
    }
  };


  const gcd = (a, b) => {
    a = Math.abs(a);
    b = Math.abs(b);

    while (b > 0)
      [a, b] = [b, a % b];

    return a;
  };


  const checkedOperator = (longMethod, nativeMethod) => (x, y) => {
    const t = nativeMethod(x, y);
    if (shouldPromote(x) || shouldPromote(y) || shouldPromote(t))
      return longMethod(promote(x), promote(y));
    else
      return t;
  };


  return baseOps.register({
    isInteger: {
      LongInt: x => true,
      Integer: x => true
    },
    isRational: {
      LongInt: x => true,
      Integer: x => true
    },
    isReal: {
      LongInt: x => true,
      Integer: x => true
    },
    integer: {
      String : parse,
      LongInt: x => x,
      Integer: x => x
    },
    toJS: {
      LongInt: toJS,
      Integer: x => x
    },
    negative: {
      LongInt: negative,
      Integer: x => -x
    },
    abs: {
      LongInt: abs,
      Integer: x => Math.abs(x)
    },
    sgn: {
      LongInt: sgn,
      Integer: x => (x > 0) - (x < 0)
    },
    isEven: {
      LongInt: isEven,
      Integer: x => x % 2 == 0
    },
    floor: {
      LongInt: x => x,
      Integer: x => x
    },
    ceil: {
      LongInt: x => x,
      Integer: x => x
    },
    round: {
      LongInt: x => x,
      Integer: x => x
    },
    cmp: {
      LongInt: {
        LongInt: cmp,
        Integer: (x, y) => cmp(x, promote(y))
      },
      Integer: {
        LongInt: (x, y) => cmp(promote(x), y),
        Integer: (x, y) => (x > y) - (x < y)
      }
    },
    plus: {
      LongInt: {
        LongInt: plus,
        Integer: (x, y) => plus(x, promote(y))
      },
      Integer: {
        LongInt: (x, y) => plus(promote(x), y),
        Integer: checkedOperator(plus, (x, y) => x + y)
      }
    },
    minus: {
      LongInt: {
        LongInt: minus,
        Integer: (x, y) => minus(x, promote(y))
      },
      Integer: {
        LongInt: (x, y) => minus(promote(x), y),
        Integer: checkedOperator(minus, (x, y) => x - y)
      }
    },
    times: {
      LongInt: {
        LongInt: times,
        Integer: (x, y) => times(x, promote(y))
      },
      Integer: {
        LongInt: (x, y) => times(promote(x), y),
        Integer: checkedOperator(times, (x, y) => x * y)
      }
    },
    idiv: {
      LongInt: {
        LongInt: idiv,
        Integer: (x, y) => idiv(x, promote(y))
      },
      Integer: {
        LongInt: (x, y) => idiv(promote(x), y),
        Integer: (x, y) => Math.floor(x / y)
      }
    },
    mod: {
      Integer: {
        Integer: (x, y) => x % y + (x % y < 0 ? y : 0)
      }
    },
    gcd: {
      Integer: {
        Integer: gcd
      }
    },
    __repr__: { LongInt: x => ({ sign: x.sign, digits: x.digits }) },
    __Integer__: { Object: ({ Integer: n }) => n },
    __LongInt__: { Object: ({ LongInt: obj }) => make(obj.sign, obj.digits) }
  });
};


if (require.main == module) {
  const ops = extend(require('./base').arithmetic());
  const timer = require('../common/util').timer();

  const N = 59;
  let t = 1;

  for (let i = 1; i < N; ++i) {
    t = ops.times(t, i);
    console.log(`${t}`);
  }

  console.log(`${ops.idiv(ops.plus(t, 1), t)}`);
  console.log(`${ops.idiv(ops.negative(ops.plus(t, 1)), t)}`);
  console.log(`${ops.integer(t.toString())}`);
  console.log(`${ops.idiv(ops.plus(t, 1), ops.negative(t))}`);
  console.log(`${ops.idiv(ops.negative(ops.plus(t, 1)), ops.negative(t))}`);

  for (let i = 1; i < N; ++i) {
    t = ops.idiv(t, i);
    console.log(`${t}`);
  }

  console.log(`${ops.integer('-12_345_678_901_234_567_890')}`);

  console.log();
  console.log(`Computation time: ${timer()} msec`);
}
