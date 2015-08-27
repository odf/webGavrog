import * as I from 'immutable';


const checkedInt = function checkedInt(longInt) {
  const CheckedInt = I.Record({ value: undefined });

  CheckedInt.prototype.toString = function() { return `${this.value}`; };

  const canDowncast = n => n.digits <= 1;

  const make     = n => new CheckedInt({ value: n });
  const toJS     = n => n.value;
  const promote  = n => longInt.shouldPromote(n) ? longInt.promote(n) : make(n);

  const negative = n => make(-n.value);
  const abs      = n => make(Math.abs(n.value));
  const sgn      = n => (n.value > 0) - (n.value < 0);
  const isEven   = n => n.value % 2 == 0;

  const cmp   = (a, b) => a.value - b.value;
  const plus  = (a, b) => promote(a.value + b.value);
  const minus = (a, b) => promote(a.value - b.value);

  const times = (a, b) => {
    const product = a.value * b.value;
    if (longInt.shouldPromote(product))
      return longInt.times(longInt.promote(a.value), longInt.promote(b.value));
    else
      return make(product);
  };

  const idiv = (a, b) => make(Math.floor(a.value / b.value));
  const mod  = (a, b) => make(a.value % b.value);

  return {
    canDowncast: canDowncast,
    type    : CheckedInt,
    promote : promote,
    toJS    : toJS,
    negative: negative,
    abs     : abs,
    sgn     : sgn,
    isEven  : isEven,
    cmp     : cmp,
    plus    : plus,
    minus   : minus,
    times   : times,
    idiv    : idiv,
    mod     : mod
  };
};


module.exports = checkedInt(require('./longInt'));

module.exports.custom = checkedInt;


if (require.main == module) {
  const {
    promote, negative, abs, sgn, isEven, cmp, plus, minus, times, idiv, mod
  } = checkedInt(require('./longInt').custom(4));

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
