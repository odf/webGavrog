import * as pickler from '../common/pickler';

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
      if (isZero(this))
        return '0';
      else {
        const s = [];
        let t = this.digits;
        let r;

        while (t.length > 1) {
          [t, r] = _divmod(t, [decimalBase]);
          s.push((r[0] + decimalBase).toString().slice(1));
        }

        s.push(t[0].toString());

        if (this.sign < 0)
          s.push('-');

        return s.reverse().join('');
      }
    }

    get __typeName() { return 'LongInt'; }
  };


  pickler.register(
    'LongInt',
    ({ sign, digits }) => ({ sign, digits }),
    ({ sign, digits }) => make(sign, digits)
  );


  const negative = n => make(-n.sign, n.digits);
  const sgn      = n => n.sign;
  const abs      = n => n.sign == 0 ? 0 : make(1, n.digits);
  const isZero   = n => n.sign == 0;
  const isEven   = n => n.sign == 0 || n.digits[0] % 2 == 0;

  const last = a => a[a.length - 1];


  const make = (s, d) => {
    let i = d.length;
    while (i > 0 && d[i - 1] == 0)
      --i;

    if (i == 0)
      return 0;
    else if (i == 1)
      return s * d[0];
    else
      return new LongInt(s, d.slice(0, i));
  };


  const shouldPromote = n => Math.abs(n) >= BASE;

  const promote = n => {
    const sign = (n > 0) - (n < 0);
    n = Math.abs(n);

    const m = Math.ceil(Math.log(n + 1) / Math.log(BASE));
    const digits = new Array(m);
    for (let i = 0; i < m; ++i) {
      digits[i] = n % BASE;
      n = Math.floor(n / BASE);
    }

    return new LongInt(sign, digits);
  };

  const toJS = n => {
    if (isZero(n))
      return 0;
    else if (n.digits.length == 1)
      return n.sign * n.digits[0];
    else {
      const k = n.digits.length - 2;
      return (
        n.sign * (n.digits[k + 1] * BASE + n.digits[k]) * Math.pow(BASE, k)
      );
    }
  };


  const parse = literal => {
    if (!literal.match(/^[+-]?\d{1,3}(_?\d{3})*$/))
      throw new Error(`expected an integer literal, got "${literal}"`);

    const sign = literal[0] == '-' ? -1 : 1;
    const s = literal.replace(/^[+-]/, '').replace(/_/g, '');
    const offset = s.length % decimalBaseLength;

    let digits = offset ? [parseInt(s.slice(0, offset))] : [];

    for (let i = offset; i < s.length; i += decimalBaseLength) {
      const chunk = s.slice(i, i + decimalBaseLength);
      digits = _plus(
        _timesSingleDigit(digits, decimalBase),
        [parseInt(chunk)]
      );
    }

    return make(sign, digits);
  };


  const _cmp = (r, s, k=0) => {
    if (r.length != s.length + k)
      return r.length - (s.length + k);

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

    for (let i = 0; i < r.length && (i < s.length || carry); ++i) {
      const sum = carry + (i < s.length ? r[i] + s[i] : r[i]);
      carry = sum >= BASE;
      result[i] = sum % BASE;
    }

    if (carry)
      result.push(1);

    return result;
  };


  const _minus = (r, s, inplace=false) => {
    const result = inplace ? r : r.slice();
    let borrow = 0;

    for (let i = 0; i < r.length && (i < s.length || borrow); ++i) {
      const dif = (i < s.length ? r[i] - s[i] : r[i]) - borrow;
      borrow = dif < 0;
      result[i] = borrow ? dif + BASE : dif;
    }

    if (borrow)
      throw new Error("panic: internal function called with bad arguments");

    while (last(result) == 0)
      result.pop();

    return result;
  };


  const cmp = (a, b) => {
    if (isZero(a))
      return -b.sign;
    else if (isZero(b))
      return a.sign;
    else if (a.sign != b.sign)
      return a.sign;
    else
      return a.sign * _cmp(a.digits, b.digits);
  };


  const plus = (a, b) => {
    if (isZero(a))
      return make(b.sign, b.digits);
    else if (isZero(b))
      return make(a.sign, a.digits);
    else if (a.sign != b.sign)
      return minus(a, new LongInt(-b.sign, b.digits));
    else
      return make(a.sign, _plus(a.digits, b.digits));
  };


  const minus = (a, b) => {
    if (isZero(a))
      return negative(b);
    else if (isZero(b))
      return make(a.sign, a.digits);
    else if (a.sign != b.sign)
      return plus(a, new LongInt(-b.sign, b.digits));
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


  const _split = d => [d % HALFBASE, Math.floor(d / HALFBASE)];


  const _timesSingleDigit = (s, d, target=null, offset=0) => {
    if (target == null)
      target = new Array(s.length + offset + 1).fill(0);

    const [dlo, dhi] = _split(d);
    let carry = 0;

    for (let i = 0; i < s.length; ++i) {
      const [slo, shi] = _split(s[i]);
      const m = dlo * shi + dhi * slo;
      const [mlo, mhi] = _split(m);

      let lo = dlo * slo + mlo * HALFBASE;
      let hi = dhi * shi + mhi;

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


  const times = (a, b) => {
    if (isZero(a) || isZero(b))
      return 0;
    else {
      const digitsOut = new Array(a.digits.length + b.digits.length).fill(0);

      for (let i = 0; i < a.digits.length; ++i)
        _timesSingleDigit(b.digits, a.digits[i], digitsOut, i);

      return make(a.sign * b.sign, digitsOut);
    }
  };


  const _divmod = (r, s) => {
    const k = BASELENGTH - 1 - Math.floor(Math.log2(last(s)));
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
      q[j] = Math.min(
        Math.floor(r[n + j] * BASE / s[n - 1] + r[n + j - 1] / s[n - 1]),
        BASE - 1
      );

      let t = _timesSingleDigit(s, q[j]);
      while (last(t) == 0)
        t.pop();

      while (_cmp(r, t, j) < 0) {
        --q[j];
        t = _minus(t, s, true);
      }
      r = _minus(r, _shiftLeft(t, j * BASELENGTH), true);
    }

    while (last(q) == 0)
      q.pop();

    return [q, _shiftRight(r, k)];
  };


  const divmod = (a, b) => {
    if (b.sign == 0)
      throw new Error('division by zero');
    else if (a.sign == 0)
      return [a, 0];

    const s = a.sign * b.sign;
    const d = _cmp(a.digits, b.digits);

    if (d == 0)
      return [s, 0];
    else {
      const [q, r] = (d < 0) ? [[], a.digits] : _divmod(a.digits, b.digits);
      if (r.length == 0)
        return [make(s, q), 0];
      else if (a.sign > 0)
        return [
          make(b.sign, q),
          make(1, r)
        ];
      else
        return [
          make(-b.sign, _plus(q, [1])),
          make(1, _minus(b.digits, r))
        ];
    }
  };


  const idiv = (a, b) => divmod(a, b)[0];
  const mod = (a, b) => divmod(a, b)[1];


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

    while (last(t) == 0)
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
      t.push(Math.floor(last(r) / fr));
    }

    while (last(t) == 0)
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
    for (let i = 0; i < r.length - 1; ++i)
      r[i] = Math.floor(r[i] / 2) + (BASE / 2) * (r[i + 1] % 2);

    r[r.length - 1] = Math.floor(r[r.length - 1] / 2);

    while (last(r) == 0)
      r.pop();
  };


  const gcdBinary = (a, b) => {
    if (isZero(a))
      return make(1, b.digits);
    else if (isZero(b) || cmp(a, b) == 0)
      return make(1, a.digits);

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


  const modInt = (x, y) => {
    if (y == 0)
      throw new Error('division by zero');

    const t = x % y;
    return t < 0 ? t + Math.abs(y) : t;
  };

  const idivInt = (x, y) => {
    if (y == 0)
      throw new Error('division by zero');

    return y < 0 ? Math.ceil(x / y) : Math.floor(x / y);
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
        Integer: (x, y) => idivInt(x, y)
      }
    },
    mod: {
      LongInt: {
        LongInt: mod,
        Integer: (x, y) => mod(x, promote(y))
      },
      Integer: {
        LongInt: (x, y) => mod(promote(x), y),
        Integer: (x, y) => modInt(x, y)
      }
    },
    divmod: {
      LongInt: {
        LongInt: divmod,
        Integer: (x, y) => divmod(x, promote(y))
      },
      Integer: {
        LongInt: (x, y) => divmod(promote(x), y),
        Integer: (x, y) => [idivInt(x, y), modInt(x, y)]
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
    }
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
