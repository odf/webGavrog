import * as I from 'immutable';

export default function checkedInt(longInt) {
  const CheckedInt = I.Record({ value: undefined });

  CheckedInt.prototype.toString = function() { return `${this.value}`; };
  CheckedInt.prototype._type = `CheckedInt(${longInt._type})`;

  const make    = n => new CheckedInt({ value: n });
  const promote = n => longInt.shouldPromote(n) ? longInt.promote(n) : make(n);

  return {
    type       : CheckedInt,
    canDowncast: n => n.digits <= 1,
    promote    : promote,
    toJS       : n => n.value,
    negative   : n => make(-n.value),
    abs        : n => make(Math.abs(n.value)),
    sgn        : n => (n.value > 0) - (n.value < 0),
    isEven     : n => n.value % 2 == 0,
    cmp        : (a, b) => a.value - b.value,
    plus       : (a, b) => promote(a.value + b.value),
    minus      : (a, b) => promote(a.value - b.value),
    idiv       : (a, b) => make(Math.floor(a.value / b.value)),
    mod        : (a, b) => make(a.value % b.value),

    times(a, b) {
      const product = a.value * b.value;
      if (longInt.shouldPromote(product))
        return longInt.times(longInt.promote(a.value), longInt.promote(b.value));
      else
        return make(product);
    }
  }
};


if (require.main == module) {
  const longInt = require('./longInt');

  const {
    promote, negative, abs, sgn, isEven, cmp, plus, minus, times, idiv, mod
  } = checkedInt(longInt(4));

  console.log(promote(-1234));
  console.log(promote(-1234));
  console.log(promote(-12345));
  console.log(promote(-1234567890));

  console.log();
  console.log(plus(promote(1234), promote(8765)));
  console.log(plus(promote(1234), promote(8766)));
  console.log(minus(promote(1234), promote(1234)));
  console.log(minus(promote(1234), promote(1230)));
  console.log(plus(promote(1234), promote(-1234)));

  console.log();
  console.log(abs(promote(-1234)));
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
  console.log(times(promote(1111), promote(9)));
  console.log(times(promote(1235), promote(9)));
  console.log(idiv(promote(111), promote(37)));
  console.log(idiv(promote(111), promote(3)));
  console.log(idiv(promote(9998), promote(4999)));
  console.log(idiv(promote(2001), promote(1001)));
  console.log(idiv(promote(9999), promote(99)));

  console.log();
  console.log(mod(promote(111), promote(37)));
  console.log(mod(promote(112), promote(37)));
}
