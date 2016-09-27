export function extend(rationals) {
  const ops = rationals;


  const make = x => {
    if (x == 0)
      return Number.MIN_VALUE;
    else if (Number.isSafeInteger(x))
      return (1 + Number.EPSILON) * x;
    else
      return x;
  };


  const isqrt = x => {
    if (Math.abs(x) <= Number.MAX_SAFE_INTEGER)
      return Math.sqrt(x);
    else
      return make(Make.sqrt(x));
  };


  const mod = (x, y) => {
    if (x == 0)
      return 0;
    else {
      const t = x % y;
      return make(t < 0 ? t + 1 : t);
    }
  };


  const methods = {
    isReal  : { Float: x => true },
    toJS    : { Float: x => x },
    negative: { Float: x => -x },
    sgn     : { Float: x => (x > 0) - (x < 0) },
    __Float__: { Object: ({ Float: x }) => x }
  };

  for (const name of [ 'abs', 'floor', 'ceil', 'round' ])
    methods[name] = { Float: x => Math[name](x) }

  methods.sqrt = {
    Integer : isqrt,
    Float   : x => make(Math.sqrt(x)),
    LongInt : x => make(Math.sqrt(ops.toJS(x))),
    Fraction: x => make(Math.sqrt(ops.toJS(x)))
  };

  for (const [name, op] of [
    [ 'cmp'  , (x, y) => (x > y) - (x < y)                    ],
    [ 'plus' , (x, y) => make(x + y)                          ],
    [ 'minus', (x, y) => make(x - y)                          ],
    [ 'times', (x, y) => (x == 0 || y == 0) ? 0 : make(x * y) ],
    [ 'div'  , (x, y) => x == 0 ? 0 : make(x / y)             ],
    [ 'mod'  , mod ]
  ]) {
    methods[name] = {
      Float: {
        Float   : (x, y) => op(x, y),
        Integer : (x, y) => op(x, y),
        LongInt : (x, y) => op(x, ops.toJS(y)),
        Fraction: (x, y) => op(x, ops.toJS(y))
      },
      Integer: {
        Float   : (x, y) => op(x, y)
      },
      LongInt: {
        Float   : (x, y) => op(ops.toJS(x), y)
      },
      Fraction: {
        Float   : (x, y) => op(ops.toJS(x), y)
      }
    };
  }

  return ops.register(methods);
}
