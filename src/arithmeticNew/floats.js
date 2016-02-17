export function methods(rationals, rationalTypes) {
  const methods = {
    toJS    : { Float: x => x                 },
    negative: { Float: x => -x                },
    abs     : { Float: x => Math.abs(x)       },
    sgn     : { Float: x => (x > 0) - (x < 0) },
    floor   : { Float: x => Math.floor(x)     },
    ceil    : { Float: x => Math.ceil(x)      },
    sqrt    : { Float: x => Math.sqrt(x)      }
  };

  for (const [op, name] of [
    [(x, y) => (x > y) - (x < y), 'cmp'  ],
    [(x, y) => x + y            , 'plus' ],
    [(x, y) => x - y            , 'minus'],
    [(x, y) => x * y            , 'times'],
    [(x, y) => x / y            , 'div'  ]
  ]) {
    methods[name] = { Float: { Float: op } };

    for (const T of rationalTypes) {
      methods[name]['Float'][T] = (x, y) => op(x, rationals.toJS(y));
      methods[name][T] = { Float: (x, y) => op(rationals.toJS(x), y) };
    }
  }

  for (const T of rationalTypes) {
    methods.sqrt[T] = x => Math.sqrt(rationals.toJS(x))
  }

  return methods;
}
