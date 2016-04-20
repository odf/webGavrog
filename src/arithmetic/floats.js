export function methods(rationals) {
  const ops = rationals;


  const make = x => {
    if (x == 0)
      return Number.MIN_VALUE;
    else if (Number.isSafeInteger(x))
      return (1 + Number.EPSILON) * x;
    else
      return x;
  };


  const methods = {
    isReal  : { Float: x => true },
    toJS    : { Float: x => x },
    negative: { Float: x => -x },
    sgn     : { Float: x => (x > 0) - (x < 0) }
  };

  for (const name of [ 'abs', 'floor', 'ceil', 'round' ])
    methods[name] = { Float: x => Math[name](x) }

  methods.sqrt = {
    Float  : x => make(Math.sqrt(x)),
    Integer: x => make(Math.sqrt(x))
  };

  for (const [op, name] of [
    [(x, y) => (x > y) - (x < y), 'cmp'  ],
    [(x, y) => x + y            , 'plus' ],
    [(x, y) => x - y            , 'minus'],
    [(x, y) => x * y            , 'times'],
    [(x, y) => x / y            , 'div'  ]
  ]) {
    methods[name] = {
      Float: {
        Float   : (x, y) => make(op(x, y)),
        Integer : (x, y) => make(op(x, y)),
        Fraction: (x, y) => make(op(x, ops.toJS(y)))
      },
      Integer: {
        Float   : (x, y) => make(op(x, y))
      },
      Fraction: {
        Float   : (x, y) => make(op(ops.toJS(x), y))
      }
    };
  }

  return methods;
}
