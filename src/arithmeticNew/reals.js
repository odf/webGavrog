const a = require('./base').default()


const { methods: intMethods } = require('./integers').default();
a.register(intMethods);


const { methods: ratMethods } = require('./fractions').default(
  a.ops(), ['Integer', 'LongInt'], 'Fraction'
);
a.register(ratMethods);


const ratOps = a.ops();

const realMethods = {
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
  realMethods[name] = [ { argtypes: ['Float', 'Float'], method: op } ];

  for (const ratType of ['Integer', 'LongInt', 'Fraction']) {
    realMethods[name].push({
      argtypes: ['Float', ratType], method: (x, y) => op(x, ratOps.toJS(y))
    });
    realMethods[name].push({
      argtypes: [ratType, 'Float'], method: (x, y) => op(ratOps.toJS(x), y)
    });
  }
}

a.register(realMethods);

const ops = a.ops();

export default ops;


if (require.main == module) {
  console.log(`${ops.div(2,3)}`);
  console.log(`${ops.plus(ops.div(2,3), 0.1)}`);
}
