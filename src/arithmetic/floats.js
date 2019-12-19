export const extend = baseOps => {
  const mod = (x, y) => {
    if (x == 0)
      return 0;
    else {
      const t = x % y;
      return t < 0 ? t + Math.abs(y) : t;
    }
  };

  const idiv = (x, y) => {
    if (y == 0)
      throw new Error('division by zero');
    else if (x == 0)
      return x;

    return y < 0 ? Math.ceil(x / y) : Math.floor(x / y);
  };


  const methods = {
    __context__: () => 'floats',

    isInteger: {
      Integer: x => true
    },
    isReal: {
      Integer: x => true,
      Float: x => true
    },
    toJS: {
      Integer: x => x,
      Float: x => x
    },
    negative: {
      Integer: x => -x,
      Float: x => -x
    },
    sgn: {
      Integer: x => (x > 0) - (x < 0),
      Float: x => (x > 0) - (x < 0)
    },
    __Float__: { Object: ({ Float: x }) => x },
    __Integer__: { Object: ({ Integer: x }) => x }
  };

  for (const name of [ 'abs', 'floor', 'ceil', 'round', 'sqrt' ])
    methods[name] = {
      Integer: x => Math[name](x),
      Float: x => Math[name](x)
    }

  for (const [name, op] of [
    [ 'cmp'  , (x, y) => (x > y) - (x < y)              ],
    [ 'plus' , (x, y) => x + y                          ],
    [ 'minus', (x, y) => x - y                          ],
    [ 'times', (x, y) => (x == 0 || y == 0) ? 0 : x * y ],
    [ 'div'  , (x, y) => x == 0 ? 0 : x / y             ],
    [ 'mod'  , mod ],
    [ 'idiv' , idiv ]
  ]) {
    methods[name] = {
      Float: {
        Float  : op,
        Integer: op
      },
      Integer: {
        Float  : op,
        Integer: op
      }
    };
  }

  return baseOps.register(methods);
};
