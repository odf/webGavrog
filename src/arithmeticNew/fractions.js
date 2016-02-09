export function methods(intOps, intTypes, typeName = 'Fraction') {

  class Fraction {
    constructor(numer, denom) {
      this.numer = numer;
      this.denom = denom;
    }

    toString() {
      return this.numer.toString() + '/' + this.denom.toString();
    }

    get __typeName() { return typeName; }
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


  const parse = s => {
    const parts = s.split('/');
    if (parts.length == 1)
      return intOps.integer(parts[0]);
    else if (parts.length == 2)
      return make(intOps.integer(parts[0]), intOps.integer(parts[1]));
    else
      throw new Error(`expected an integer or fraction literal, got ${s}`);
  };


  const promote = n => new Fraction(n, 1);

  const negative = q => new Fraction(intOps.negative(q.numer), q.denom);
  const abs      = q => new Fraction(intOps.abs(q.numer), q.denom);
  const sgn      = q => intOps.sgn(q.numer);


  const floor = q => {
    return intOps.idiv(q.numer, q.denom);
  };

  const ceil = q => {
    return intOps.idiv(intOps.plus(q.numer, intOps.minus(q.denom, 1)),
                       q.denom);
  };

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


  const methods = {
    toJS    : { [typeName]: toJS     },
    negative: { [typeName]: negative },
    abs     : { [typeName]: abs      },
    sgn     : { [typeName]: sgn      },
    floor   : { [typeName]: floor    },
    ceil    : { [typeName]: ceil     }
  };

  methods.rational = { String: parse };
  for (const intType of intTypes)
    methods.rational[intType] = x => x;

  for (const [op, name] of [
    [cmp  , 'cmp'  ],
    [plus , 'plus' ],
    [minus, 'minus'],
    [times, 'times'],
    [div  , 'div'  ]
  ]) {
    methods[name] = { [typeName]: { [typeName]: op } };

    for (const intType of intTypes) {
      methods[name][typeName][intType] = (x, y) => op(x, promote(y));
      methods[name][intType] = { [typeName]: (x, y) => op(promote(x), y) };
    }
  }

  for (const t1 of intTypes) {
    methods.div[t1] = {};
    for (const t2 of intTypes) {
      methods.div[t1][t2] = (x, y) => make(x, y);
    }
  }

  return methods;
};


if (require.main == module) {
  const a = require('./base').arithmetic()
    .register(require('./integers').methods());

  const ops = a.register(methods(a.ops(), ['Integer', 'LongInt'])).ops();
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
  console.log(`floor( 5/3) = ${ops.floor(ops.div( 5, 3))}`);
  console.log(`floor(-5/3) = ${ops.floor(ops.div(-5, 3))}`);
  console.log(`ceil ( 5/3) = ${ops.ceil (ops.div( 5, 3))}`);
  console.log(`ceil (-5/3) = ${ops.ceil (ops.div(-5, 3))}`);

  console.log(`${ops.rational('-12_345_678_901_234_567_890')}`);
  console.log(`${ops.rational('-111_111_111_111_111_111/-12_345_679')}`);

  console.log();
  console.log(`Computation time: ${timer()} msec`);
}
