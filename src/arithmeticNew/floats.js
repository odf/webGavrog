export function methods(rationals, rationalTypes) {
  const methods = {
    toJS    : [ { argtypes: ['Float'], method: x => x  } ],
    negative: [ { argtypes: ['Float'], method: x => -x } ],
    abs     : [ { argtypes: ['Float'], method: x => Math.abs(x) } ],
    sgn     : [ { argtypes: ['Float'], method: x => (x > 0) - (x < 0) } ],
    floor   : [ { argtypes: ['Float'], method: x => Math.floor(x) } ],
    ceil    : [ { argtypes: ['Float'], method: x => Math.ceil(x) } ]
  };

  for (const [op, name] of [
    [(x, y) => (x > y) - (x < y), 'cmp'  ],
    [(x, y) => x + y            , 'plus' ],
    [(x, y) => x - y            , 'minus'],
    [(x, y) => x * y            , 'times'],
    [(x, y) => x / y            , 'div'  ]
  ]) {
    methods[name] = [ { argtypes: ['Float', 'Float'], method: op } ];

    for (const T of rationalTypes) {
      methods[name].push({
        argtypes: ['Float', T], method: (x, y) => op(x, rationals.toJS(y))
      });
      methods[name].push({
        argtypes: [T, 'Float'], method: (x, y) => op(rationals.toJS(x), y)
      });
    }
  }

  return methods;
}
