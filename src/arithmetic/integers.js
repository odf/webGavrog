const findBaseLength = () => {
  for (let n = 2; ; n += 2) {
    const b = Math.pow(2, n);
    if (2 * b - 2 == 2 * b - 1 || -2 * b + 2 == -2 * b + 1)
      return n - 2;
  }
};


export const extend = (baseOps, baseLength = 0) => {
  const defaultBaseLength = findBaseLength();
  const b = baseLength & ~1;

  const BASELENGTH = (b > 0 && b <= defaultBaseLength) ? b : defaultBaseLength;
  const BASE = Math.pow(2, BASELENGTH);
  const HALFBASE = Math.sqrt(BASE);

  const decimalBaseLength = Math.floor(Math.log10(BASE));
  const decimalBase = Math.pow(10, decimalBaseLength);

  const powersOfTwo =
    new Array(BASELENGTH).fill(0).map((_, i) => Math.pow(2, i));


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
        let r;
        while (t.length > 0) {
          [t, r] = _divmod(t, [decimalBase]);
          if (t.length > 0)
            s.push((r[0] + decimalBase).toString().slice(1));
          else
            s.push(r[0].toString());
        }
        return s.reverse().join('');
      }
    }

    get __typeName() { return 'LongInt'; }
  };


  const negative = n => make(-n.sign, n.digits);
  const abs      = n => sgn(n) ? make(1, n.digits) : n;
  const sgn      = n => n.sign;
  const _isZero  = n => n.sign == 0;
  const isEven   = n => _isZero(n) || n.digits[0] % 2 == 0;

  const _last = a => a[a.length - 1];


  const make = (s, d) => {
    while (_last(d) == 0)
      d.pop();

    if (d.length > 1)
      return new LongInt(s, d);
    else if (d.length == 1)
      return s * d[0];
    else
      return 0;
  };


  const shouldPromote = n => Math.abs(n) >= BASE;

  const promote = n => {
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


  const parse = literal => {
    if (!literal.match(/^[+-]?\d{1,3}(_?\d{3})*$/))
      throw new Error("expected an integer literal, got "+literal);

    const s = literal.replace(/^[+-]/, '').replace(/_/g, '');
    const offset = s.length % decimalBaseLength;

    let digits = [parseInt(s.slice(0, offset))];

    for (let i = offset; i < s.length; i += decimalBaseLength) {
      const chunk = s.slice(i, i + decimalBaseLength);
      digits = _plus(_times(digits, [decimalBase]), [parseInt(chunk)]);
    }

    while (digits.length > 0 && _last(digits) == 0)
      digits.pop();

    const sign = digits.length == 0 ? 0 : literal[0] == '-' ? -1 : 1;
    
    return make(sign, digits);
  };


  const _cmp = (r, s, k=0) => {
    if (r.length != s.length + k)
      return r.length - s.length + k;

    for (let i = s.length - 1; i >= 0; --i)
      if (r[i + k] != s[i])
        return r[i + k] - s[i];

    return 0;
  };


  const _plus = (r, s) => {
    if (s.length > r.length)
      return _plus(s, r);

    const result = r.slice();
    let carry = 0;

    for (let i = 0; i < s.length; ++i) {
      const sum = r[i] + s[i] + carry;
      carry = sum >= BASE;
      result[i] = carry ? sum - BASE : sum;
    }

    for (let i = s.length; carry && i < r.length; ++i) {
      const sum = r[i] + carry;
      carry = sum >= BASE;
      result[i] = carry ? sum - BASE : sum;
    }

    if (carry)
      result.push(1);

    return result;
  };


  const _minus = (r, s, inplace=false) => {
    const result = inplace ? r : r.slice();
    let borrow = 0;

    for (let i = 0; i < s.length; ++i) {
      const dif = r[i] - s[i] - borrow;
      borrow = dif < 0;
      result[i] = borrow ? dif + BASE : dif;
    }

    for (let i = s.length; borrow && i < r.length; ++i) {
      const dif = r[i] - borrow;
      borrow = dif < 0;
      result[i] = borrow ? dif + BASE : dif;
    }

    if (borrow)
      throw new Error("panic: internal function called with bad arguments");

    while (_last(result) == 0)
      result.pop();

    return result;
  };


  const cmp = (a, b) => {
    if (_isZero(a))
      return -b.sign;
    else if (_isZero(b))
      return a.sign;
    else if (a.sign != b.sign)
      return a.sign;
    else
      return a.sign * _cmp(a.digits, b.digits);
  };


  const plus = (a, b) => {
    if (_isZero(a))
      return b;
    else if (_isZero(b))
      return a;
    else if (a.sign != b.sign)
      return minus(a, negative(b));
    else
      return make(a.sign, _plus(a.digits, b.digits));
  };


  const minus = (a, b) => {
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
  };


  const _lo = d => d % HALFBASE;
  const _hi = d => Math.floor(d / HALFBASE);


  const _timesSingleDigit = (s, d, target=null, offset=0) => {
    if (target == null)
      target = new Array(s.length + offset + 1).fill(0);

    const dlo = _lo(d);
    const dhi = _hi(d);

    let carry = 0;

    for (let i = 0; i < s.length; ++i) {
      const slo = _lo(s[i]);
      const shi = _hi(s[i]);

      const m = dlo * shi + dhi * slo;
      let lo = dlo * slo + _lo(m) * HALFBASE;
      let hi = dhi * shi + _hi(m);

      if (lo >= BASE) {
        lo -= BASE;
        hi += 1;
      }

      const tlo = target[i + offset] + lo;
      carry = tlo >= BASE;
      target[i + offset] = carry ? tlo - BASE : tlo;

      const thi = target[i + offset + 1] + hi + carry;
      carry = thi >= BASE;
      target[i + offset + 1] = carry ? thi - BASE : thi;

      for (let j = i + offset + 2; carry && j < target.length; ++j) {
        const t = target[j] + carry;
        carry = t >= BASE;
        target[j] = carry ? t - BASE : t;
      }
    }

    return target;
  };


  const _times = (r, s) => {
    const result = new Array(r.length + s.length).fill(0);

    for (let i = 0; i < r.length; ++i)
      _timesSingleDigit(s, r[i], result, i);

    while (_last(result) == 0)
      result.pop();

    return result;
  };


  const times = (a, b) => {
    if (_isZero(a))
      return a;
    else if (_isZero(b))
      return b;
    else
      return make(a.sign * b.sign, _times(a.digits, b.digits));
  };


  const _quotient2by1 = (ahi, alo, b) => Math.floor(ahi * BASE / b + alo / b);


  const _divmod = (r, s) => {
    const k = BASELENGTH - 1 - Math.floor(Math.log(_last(s)) / Math.log(2));
    r = _shiftLeft(r, k);
    s = _shiftLeft(s, k);

    const n = s.length;
    const m = r.length - s.length;
    const q = new Array(m + 1).fill(0);

    if (_cmp(r, s, m) >= 0) {
      q[m] = 1;
      _minus(r, _shiftLeft(s, m * BASELENGTH), true);
    }

    for (let j = m - 1; r.length > 0 && j >= 0; --j) {
      q[j] = Math.min(_quotient2by1(r[n + j], r[n + j - 1], s[n - 1]),
                      BASE - 1);

      let t = _timesSingleDigit(s, q[j]);
      while (_last(t) == 0)
        t.pop();

      while (_cmp(r, t, j) < 0) {
        --q[j];
        t = _minus(t, s, true);
      }
      r = _minus(r, _shiftLeft(t, j * BASELENGTH), true);
    }

    while (_last(q) == 0)
      q.pop();

    return [q, _shiftRight(r, k)];
  };


  const idiv = (a, b) => {
    if (b.sign == 0)
      throw new Error('division by zero');
    else if (a.sign == 0)
      return a;

    const s = a.sign * b.sign;
    const d = _cmp(a.digits, b.digits);

    if (d == 0)
      return s;
    else if (d < 0)
      return s > 0 ? 0 : s;
    else {
      const [q, r] = _divmod(a.digits, b.digits);
      if (s > 0 || r.length == 0)
        return make(s, q);
      else
        return make(s, _plus(q, [1]));
    }
  };


  const mod = (a, b) => {
    if (b.sign == 0)
      throw new Error('division by zero');
    else if (a.sign == 0)
      return a;

    const s = a.sign * b.sign;
    const d = _cmp(a.digits, b.digits);

    if (d == 0)
      return 0;
    else if (d < 0)
      return s > 0 ? a : make(b.sign, _minus(b.digits, a.digits));
    else {
      const [q, r] = _divmod(a.digits, b.digits);
      if (s > 0 || r.length == 0)
        return make(b.sign, r);
      else
        return make(b.sign, _minus(b.digits, r));
    }
  };


  const divmod = (a, b) => {
    if (b.sign == 0)
      throw new Error('division by zero');
    else if (a.sign == 0)
      return a;

    const s = a.sign * b.sign;
    const d = _cmp(a.digits, b.digits);

    if (d == 0)
      return [s, 0];
    else if (d < 0)
      return s > 0 ? [0, a] : [s, make(b.sign, _minus(b.digits, a.digits))];
    else {
      const [q, r] = _divmod(a.digits, b.digits);
      if (s > 0 || r.length == 0)
        return [make(s, q), make(b.sign, r)];
      else
        return [make(s, _plus(q, [1])), make(b.sign, _minus(b.digits, r))];
    }
  };


  const _shiftRight = (r, n) => {
    const t = r.slice(Math.floor(n / BASELENGTH));
    const m = n % BASELENGTH;

    if (m > 0) {
      const fr = powersOfTwo[m];
      const fl = powersOfTwo[BASELENGTH - m];

      for (let i = 0; i < t.length - 1; ++i)
        t[i] = Math.floor(t[i] / fr) + t[i + 1] % fr * fl;

      t[t.length - 1] = Math.floor(t[t.length - 1] / fr);
    }

    while (_last(t) == 0)
      t.pop();

    return t;
  };


  const _shiftLeft = (r, n) => {
    const t = r.slice();
    const m = n % BASELENGTH;

    if (m > 0) {
      const fl = powersOfTwo[m];
      const fr = powersOfTwo[BASELENGTH - m];

      for (let i = t.length - 1; i > 0; --i)
        t[i] = t[i] % fr * fl + Math.floor(t[i - 1] / fr);

      t[0] = t[0] % fr * fl;
      t.push(Math.floor(_last(r) / fr));
    }

    while (_last(t) == 0)
      t.pop();

    return new Array(Math.floor(n / BASELENGTH)).fill(0).concat(t);
  };


  const shiftRight = (a, n) => {
    if (a.sign == 0 || n == 0)
      return make(a.sign, a.digits);
    else if (n < 0)
      return make(a.sign, _shiftLeft(a.digits, -n));
    else
      return make(a.sign, _shiftRight(a.digits, n));
  };


  const shiftLeft = (a, n) => {
    if (a.sign == 0 || n == 0)
      return make(a.sign, a.digits);
    else if (n < 0)
      return make(a.sign, _shiftRight(a.digits, -n));
    else
      return make(a.sign, _shiftLeft(a.digits, n));
  };


  const _divideByTwoInPlace = r => {
    const f = BASE / 2;

    for (let i = 0; i < r.length - 1; ++i)
      r[i] = Math.floor(r[i] / 2) + (r[i + 1] % 2 ? f : 0);

    r[r.length - 1] = Math.floor(r[r.length - 1] / 2);

    while (_last(r) == 0)
      r.pop();
  };


  const gcdBinary = (a, b) => {
    if (_isZero(a))
      return b;
    else if (_isZero(b))
      return a;
    else if (cmp(a, b) == 0)
      return a;

    let r = a.digits.slice();
    let s = b.digits.slice();
    let k = 0;

    while (r[0] % 2 == 0 && s[0] % 2 == 0) {
      _divideByTwoInPlace(r);
      _divideByTwoInPlace(s);
      ++k;
    }

    while (r[0] % 2 == 0)
      _divideByTwoInPlace(r);

    while (s[0] % 2 == 0)
      _divideByTwoInPlace(s);

    while (true) {
      const d = _cmp(r, s);
      if (d == 0)
        break;

      if (d < 0)
        [r, s] = [s, r];

      _minus(r, s, true);
      while (r[0] % 2 == 0)
        _divideByTwoInPlace(r);
    }

    return make(1, _shiftLeft(r, k));
  };


  const gcdInt = (a, b) => {
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
    __context__: () => 'integers',

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
      LongInt: {
        LongInt: mod,
        Integer: (x, y) => mod(x, promote(y))
      },
      Integer: {
        LongInt: (x, y) => mod(promote(x), y),
        Integer: (x, y) => x - Math.floor(x / y) * y
      }
    },
    divmod: {
      LongInt: {
        LongInt: divmod,
        Integer: (x, y) => divmod(x, promote(y))
      },
      Integer: {
        LongInt: (x, y) => divmod(promote(x), y),
        Integer: (x, y) => [Math.floor(x / y), x - Math.floor(x / y) * y]
      }
    },
    shiftRight: {
      Integer: { Integer: (x, n) => shiftRight(promote(x), n) },
      LongInt: { Integer: shiftRight }
    },
    shiftLeft: {
      Integer: { Integer: (x, n) => shiftLeft(promote(x), n) },
      LongInt: { Integer: shiftLeft }
    },
    gcd: {
      Integer: {
        Integer: gcdInt,
        LongInt: (x, y) => gcdBinary(promote(x), y)
      },
      LongInt: {
        Integer: (x, y) => gcdBinary(x, promote(y)),
        LongInt: gcdBinary
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
