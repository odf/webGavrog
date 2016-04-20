export function methods(rationals) {
  const ops = rationals;


  class ImpreciseInteger {
    constructor(value) {
      this.value = value;
    }

    toString() {
      return this.value.toString() + '.0';
    }

    get __typeName() { return 'ImpreciseInteger'; }
  };


  const isInteger = x => {
    const s = Math.abs(x);
    return s % 1 == 0 && s + 1 > s;
  };

  const make = x => isInteger(x) ? new ImpreciseInteger(x) : x;


  const methods = {
    isReal: {
      Float           : x => true,
      ImpreciseInteger: x => true
    },
    toJS: {
      Float           : x => x,
      ImpreciseInteger: x => x.value
    }
  };

  for (const name of [ 'abs', 'floor', 'ceil', 'sqrt', 'round' ]) {
    methods[name] = {
      Float           : x => make(Math[name](x)),
      ImpreciseInteger: x => make(Math[name](x.value))
    }
  }

  methods.sqrt.Integer = x => make(Math.sqrt(x));

  for (const [op, name] of [
    [x => -x               , 'negative'],
    [x => (x > 0) - (x < 0), 'sgn'     ]
  ]) {
    methods[name] = {
      Float           : x => make(op(x)),
      ImpreciseInteger: x => make(op(x.value))
    }
  }

  for (const [op, name] of [
    [(x, y) => (x > y) - (x < y), 'cmp'  ],
    [(x, y) => x + y            , 'plus' ],
    [(x, y) => x - y            , 'minus'],
    [(x, y) => x * y            , 'times'],
    [(x, y) => x / y            , 'div'  ]
  ]) {
    methods[name] = {
      Float: {
        Float           : (x, y) => make(op(x, y)),
        Integer         : (x, y) => make(op(x, y)),
        ImpreciseInteger: (x, y) => make(op(x, y.value)),
        Fraction        : (x, y) => make(op(x, ops.toJS(y)))
      },
      ImpreciseInteger: {
        Float           : (x, y) => make(op(x.value, y)),
        Integer         : (x, y) => make(op(x.value, y)),
        ImpreciseInteger: (x, y) => make(op(x.value, y.value)),
        Fraction        : (x, y) => make(op(x, ops.toJS(y)))
      },
      Integer: {
        Float           : (x, y) => make(op(x, y)),
        ImpreciseInteger: (x, y) => make(op(x, y.value))
      },
      Fraction: {
        Float           : (x, y) => make(op(ops.toJS(x), y)),
        ImpreciseInteger: (x, y) => make(op(ops.toJS(x), y.value))
      }
    };
  }

  return methods;
}
