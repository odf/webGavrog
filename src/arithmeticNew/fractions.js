import * as I from 'immutable';


export default function fraction(intOps) {

  class Fraction {
    constructor(numer, denom) {
      this.numer = numer;
      this.denom = denom;
    }

    toString() {
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


  const promote = n => new Fraction(n, 1);

  const negative = q => new Fraction(intOps.negative(q.numer), q.denom);
  const abs      = q => new Fraction(intOps.abs(q.numer), q.denom);
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


  const div = (q, r) => times(q, new Fraction(r.denom, r.numer));


  return {
    methods: {
      toJS    : [ { argtypes: ['Fraction'], method: toJS } ],
      negative: [ { argtypes: ['Fraction'], method: negative } ],
      abs     : [ { argtypes: ['Fraction'], method: abs } ],
      sgn     : [ { argtypes: ['Fraction'], method: sgn } ],

      cmp: [
        { argtypes: ['Fraction', 'Fraction'],
          method  : cmp },
        { argtypes: ['Fraction', 'Integer' ],
          method  : (x, y) => cmp(x, promote(y)) },
        { argtypes: ['Integer' , 'Fraction'],
          method  : (x, y) => cmp(promote(x), y) },
        { argtypes: ['Fraction', 'LongInt' ],
          method  : (x, y) => cmp(x, promote(y)) },
        { argtypes: ['LongInt' , 'Fraction'],
          method  : (x, y) => cmp(promote(x), y) },
      ],
      plus: [
        { argtypes: ['Fraction', 'Fraction'],
          method  : plus },
        { argtypes: ['Fraction', 'Integer' ],
          method  : (x, y) => plus(x, promote(y)) },
        { argtypes: ['Integer' , 'Fraction'],
          method  : (x, y) => plus(promote(x), y) },
        { argtypes: ['Fraction', 'LongInt' ],
          method  : (x, y) => plus(x, promote(y)) },
        { argtypes: ['LongInt' , 'Fraction'],
          method  : (x, y) => plus(promote(x), y) },
      ],
      minus: [
        { argtypes: ['Fraction', 'Fraction'],
          method  : minus },
        { argtypes: ['Fraction', 'Integer' ],
          method  : (x, y) => minus(x, promote(y)) },
        { argtypes: ['Integer' , 'Fraction'],
          method  : (x, y) => minus(promote(x), y) },
        { argtypes: ['Fraction', 'LongInt' ],
          method  : (x, y) => minus(x, promote(y)) },
        { argtypes: ['LongInt' , 'Fraction'],
          method  : (x, y) => minus(promote(x), y) },
      ],
      times: [
        { argtypes: ['Fraction', 'Fraction'],
          method  : times },
        { argtypes: ['Fraction', 'Integer' ],
          method  : (x, y) => times(x, promote(y)) },
        { argtypes: ['Integer' , 'Fraction'],
          method  : (x, y) => times(promote(x), y) },
        { argtypes: ['Fraction', 'LongInt' ],
          method  : (x, y) => times(x, promote(y)) },
        { argtypes: ['LongInt' , 'Fraction'],
          method  : (x, y) => times(promote(x), y) },
      ],
      div: [
        { argtypes: ['Integer' , 'Integer' ], method: (x, y) => make(x, y) },
        { argtypes: ['Integer' , 'LongInt' ], method: (x, y) => make(x, y) },
        { argtypes: ['LongInt' , 'Integer' ], method: (x, y) => make(x, y) },
        { argtypes: ['LongInt' , 'LongInt' ], method: (x, y) => make(x, y) },
        { argtypes: ['Fraction', 'Fraction'], method: div },
        { argtypes: ['Fraction', 'Integer' ],
          method  : (x, y) => div(x, promote(y)) },
        { argtypes: ['Integer' , 'Fraction'],
          method  : (x, y) => div(promote(x), y) },
        { argtypes: ['Fraction', 'LongInt' ],
          method  : (x, y) => div(x, promote(y)) },
        { argtypes: ['LongInt' , 'Fraction'],
          method  : (x, y) => div(promote(x), y) }
      ]
    }
  };
};


if (require.main == module) {
  const { methods: intMethods } = require('./integers').default();
  const a = require('./base').default()

  a.register(intMethods);

  const { methods } = fraction(a.ops());

  const ops = a.register(methods).ops();
  const timer = require('../common/util').timer();

  const N = 128;
  let t = 0, q = 1;

  for (let i = 0; i < 128; ++i) {
    q = ops.div(q, 2);
    t = ops.plus(t, q);
  }
  console.log(`${t}`);
  console.log(`${ops.plus(t, q)}`);

  console.log();
  console.log(`Computation time: ${timer()} msec`);
}
