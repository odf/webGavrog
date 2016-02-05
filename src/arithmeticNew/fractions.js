import * as I from 'immutable';


export default function fraction(intOps) {

  class Fraction {
    constructor(numer, denom) {
      this.numer = numer;
      this.denom = denom;
    }

    toString() {
      const n = asInteger(this);
      if (n !== undefined)
        return n.toString();
      else
        return this.numer.toString() + '/' + this.denom.toString();
    }
  };


  const toJS = n => intOps.toJS(n.numer) / intOps.toJS(n.denom);


  const _mod = (a, b) => intOps.minus(a, intOps.times(intOps.idiv(a, b), b));

  const _gcd = (a, b) => {
    a = intOps.abs(a);
    b = intOps.abs(b);

    while (intOps.sgn(b) > 0)
      [a, b] = [b, _mod(a, b)];

    return a;
  };


  const make = (numer, denom) => {
    const s = intOps.sgn(denom);

    if (s < 0)
      return make(intOps.negative(numer), intOps.negative(denom));
    else if (s == 0)
      throw new Error('fraction has zero denominator');
    else {
      const a = _gcd(denom, numer);
      const n = intOps.idiv(numer, a);
      const d = intOps.idiv(denom, a);

      if (intOps.cmp(d, 1) == 0 || intOps.sgn(n) == 0)
        return n;
      else
        return new Fraction(n, d);
    }
  };


  const negative = q => make(intOps.negative(q.numer), q.denom);
  const abs      = q => make(intOps.abs(q.numer), q.denom);
  const sgn      = q => intOps.sgn(q.numer);


  const cmp = (q, r) => sgn(minus(q, r));


  const plus = function plus(q, r) {
    const a = _gcd(q.denom, r.denom);
    const s = intOps.idiv(r.denom, a);
    const t = intOps.idiv(q.denom, a);

    return make(intOps.plus(intOps.times(s, q.numer), intOps.times(t, r.numer)),
                intOps.times(s, q.denom));
  };


  const minus = (q, r) => plus(q, negative(r));


  const times = function times(q, r) {
    const a = _gcd(q.numer, r.denom);
    const b = _gcd(q.denom, r.numer);

    return make(intOps.times(intOps.idiv(q.numer, a), intOps.idiv(r.numer, b)),
                intOps.times(intOps.idiv(q.denom, b), intOps.idiv(r.denom, a)));
  };


  const div = (q, r) => times(q, make(r.denom, r.numer));


  const idiv = function idiv(q, r) {
    const t = div(q, r);
    return intOps.idiv(t.numer, t.denom);
  };


  return {
  };
};


if (require.main == module) {
  const { intParsers, intMethods } = require('./integers').default();
  const a = require('./base').default()

  a.register(intMethods);

  const { parsers, methods } = fraction(a.ops);
}
