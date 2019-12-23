import * as pickler from '../common/pickler';

export const extend = (intOps, intTypes, typeName = 'Fraction') => {

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


  pickler.register(
    typeName,
    ({ numer, denom }) =>
      ({ numer: pickler.pickle(numer), denom: pickler.pickle(denom) }),
    ({ numer, denom }) =>
      new Fraction(pickler.unpickle(numer), pickler.unpickle(denom))
  );


  const toJS = n => intOps.toJS(n.numer) / intOps.toJS(n.denom);


  const make = (numer, denom) => {
    if (intOps.lt(denom, 0))
      return make(intOps.negative(numer), intOps.negative(denom));
    else if (intOps.eq(denom, 0))
      throw new Error('fraction has zero denominator');
    else if (intOps.eq(numer, 0))
      return numer;
    else {
      const [q, r] = intOps.divmod(numer, denom);

      if (intOps.eq(r, 0))
        return q;
      else {
        const a = intOps.gcd(denom, numer);
        return new Fraction(intOps.idiv(numer, a), intOps.idiv(denom, a));
      }
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


  const floor = q => intOps.idiv(q.numer, q.denom);

  const ceil = q => {
    const [n, r] = intOps.divmod(q.numer, q.denom);
    if (intOps.gt(r, 0))
      return intOps.plus(n, 1);
    else
      return n;
  };


  const round = q => {
    const [n, r] = intOps.divmod(q.numer, q.denom);
    if (intOps.ge(intOps.times(2, r), q.denom))
      return intOps.plus(n, 1);
    else
      return n;
  };


  const cmp = (q, r) => {
    const a = intOps.gcd(q.denom, r.denom);
    const s = intOps.idiv(r.denom, a);
    const t = intOps.idiv(q.denom, a);

    return intOps.cmp(intOps.times(s, q.numer), intOps.times(t, r.numer));
  };


  const plus = (q, r) => {
    const a = intOps.gcd(q.denom, r.denom);
    const s = intOps.idiv(r.denom, a);
    const t = intOps.idiv(q.denom, a);

    return make(intOps.plus(intOps.times(s, q.numer), intOps.times(t, r.numer)),
                intOps.times(s, q.denom));
  };


  const minus = (q, r) => plus(q, negative(r));


  const times = (q, r) => {
    const a = intOps.gcd(q.numer, r.denom);
    const b = intOps.gcd(q.denom, r.numer);

    return make(intOps.times(intOps.idiv(q.numer, a), intOps.idiv(r.numer, b)),
                intOps.times(intOps.idiv(q.denom, b), intOps.idiv(r.denom, a)));
  };


  const div = (q, r) => times(q, new Fraction(r.denom, r.numer));


  const idiv = (q, r) => {
    const t = div(q, r);

    if (intOps.typeOf(t) == typeName)
      return sgn(r) < 0 ? ceil(t): floor(t);
    else
      return sgn(r) < 0 ? intOps.ceil(t) : intOps.floor(t);
  };


  const methods = {
    __context__: () => `fractions(${intOps.__context__()})`,

    isRational: { [typeName]: x => true },
    isReal    : { [typeName]: x => true },
    toJS      : { [typeName]: toJS     },
    negative  : { [typeName]: negative },
    abs       : { [typeName]: abs      },
    sgn       : { [typeName]: sgn      },
    floor     : { [typeName]: floor    },
    ceil      : { [typeName]: ceil     },
    round     : { [typeName]: round    }
  };

  methods.rational = { String: parse };
  for (const intType of intTypes)
    methods.rational[intType] = x => x;

  for (const [op, name] of [
    [cmp  , 'cmp'  ],
    [plus , 'plus' ],
    [minus, 'minus'],
    [times, 'times'],
    [div  , 'div'  ],
    [idiv , 'idiv' ]
  ]) {
    methods[name] = { [typeName]: { [typeName]: op } };

    for (const intType of intTypes) {
      methods[name][typeName][intType] = (x, y) => op(x, promote(y));
      methods[name][intType] = { [typeName]: (x, y) => op(promote(x), y) };
    }
  }

  for (const t1 of intTypes) {
    for (const t2 of intTypes) {
      methods.div[t1][t2] = (x, y) => make(x, y);
    }
  }

  return intOps.register(methods);
};


if (require.main == module) {
  const a = require('./integers').extend(require('./base').arithmetic());
  const ops = extend(a, ['Integer', 'LongInt']);
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
  console.log(`round( 5/3) = ${ops.round(ops.div( 5, 3))}`);
  console.log(`round(-5/3) = ${ops.round(ops.div(-5, 3))}`);

  console.log(`${ops.rational('-12_345_678_901_234_567_890')}`);
  console.log(`${ops.rational('-111_111_111_111_111_111/-12_345_679')}`);

  console.log();
  console.log(`Computation time: ${timer()} msec`);
}
