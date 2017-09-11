export const extend = integers => {
  const ops = integers;


  const mod = (x, y) => {
    if (x == 0)
      return 0;
    else {
      const t = x % y;
      return t < 0 ? t + y : t;
    }
  };


  const areClose = (x, y, eps=Math.pow(2, -40)) =>
    (x == 0 && Math.abs(y) < eps) || (y == 0 && Math.abs(x) < eps) ||
    Math.abs(x - y) <= eps * Math.max(Math.abs(x), Math.abs(y));


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
    Integer : x => Math.sqrt(x),
    Float   : x => Math.sqrt(x)
  };

  for (const [name, op] of [
    [ 'cmp'  , (x, y) => (x > y) - (x < y)              ],
    [ 'plus' , (x, y) => x + y                          ],
    [ 'minus', (x, y) => x - y                          ],
    [ 'times', (x, y) => (x == 0 || y == 0) ? 0 : x * y ],
    [ 'div'  , (x, y) => x == 0 ? 0 : x / y             ],
    [ 'mod'  , mod ],
    [ 'areClose', areClose ]
  ]) {
    methods[name] = {
      Float: {
        Float   : (x, y) => op(x, y),
        Integer : (x, y) => op(x, y)
      },
      Integer: {
        Float   : (x, y) => op(x, y)
      }
    };
  }

  for (const [name, op] of [
    [ 'div'  , (x, y) => x == 0 ? 0 : x / y ],
    [ 'areClose', areClose ]
  ]) {
    methods[name] = {
      Float: {
        Float  : (x, y) => op(x, y),
        Integer: (x, y) => op(x, y)
      },
      Integer: {
        Float  : (x, y) => op(x, y),
        Integer: (x, y) => op(x, y)
      }
    };
  }

  return ops.register(methods);
};
