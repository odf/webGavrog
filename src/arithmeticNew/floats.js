export function methods() {
  const methods = {};

  for (const name of [ 'abs', 'floor', 'ceil', 'sqrt' ]) {
    methods[name] = {
      Float  : x => Math[name](x),
      Integer: x => Math[name](x)
    }
  }

  for (const [op, name] of [
    [x => x                , 'toJS'    ],
    [x => -x               , 'negative'],
    [x => (x > 0) - (x < 0), 'sgn'     ]
  ]) {
    methods[name] = {
      Float  : op,
      Integer: op
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
        Float  : op,
        Integer: op
      },
      Integer: {
        Float  : op,
        Integer: op
      }
    };
  }

  return methods;
}
