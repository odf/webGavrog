import * as I from 'immutable';


export const typeOf = x => {
  const t = x == null ? 'Null' : (x.__typeName || x.constructor.name);

  if (t == 'Number') {
    if (Number.isSafeInteger(x))
      return 'Integer';
    else
      return 'Float';
  }
  else if (t == 'Array') {
    if (x.length > 0 && x[0].constructor.name == 'Array')
      return 'Matrix';
    else
      return 'Vector';
  }
  else
    return t;
};


const call = (dispatch, op, ops) => (...args) => {
  const method = dispatch.getIn(args.map(typeOf)) || dispatch.get('__default__')

  if (method)
    return method(...args, ops);
  else {
    const msg = `Operator '${op}' not defined on [${args.map(typeOf)}]`;
    throw new Error(msg);
  }
};


const gcd = (a, b, ops) => {
  a = ops.abs(a);
  b = ops.abs(b);

  while (ops.sgn(b) > 0)
    [a, b] = [b, ops.mod(a, b)];

  return a;
};


const defaults = {
  isInteger    : { __default__: x => false },
  isRational   : { __default__: x => false },
  isReal       : { __default__: x => false },

  isZero       : { __default__: (x, ops) => ops.sgn(x) == 0 },
  isNonZero    : { __default__: (x, ops) => ops.sgn(x) != 0 },
  isPositive   : { __default__: (x, ops) => ops.sgn(x) >  0 },
  isNonNegative: { __default__: (x, ops) => ops.sgn(x) >= 0 },
  isNegative   : { __default__: (x, ops) => ops.sgn(x) <  0 },
  isNonPositive: { __default__: (x, ops) => ops.sgn(x) <= 0 },

  eq: { __default__: (a, b, ops) => ops.cmp(a, b) == 0 },
  ne: { __default__: (a, b, ops) => ops.cmp(a, b) != 0 },
  lt: { __default__: (a, b, ops) => ops.cmp(a, b) <  0 },
  gt: { __default__: (a, b, ops) => ops.cmp(a, b) >  0 },
  le: { __default__: (a, b, ops) => ops.cmp(a, b) <= 0 },
  ge: { __default__: (a, b, ops) => ops.cmp(a, b) >= 0 },

  mod: {
    __default__: (x, y, ops) => ops.minus(x, ops.times(ops.idiv(x, y), y))
  },

  gcd: { __default__: gcd },

  typeOf: { __default__: x => typeOf(x) }
};


export function arithmetic(registry = I.Map().mergeDeep(defaults)) {
  return {
    register(specs) {
      return arithmetic(registry.mergeDeep(specs));
    },

    ops() {
      const result = {};
      registry.forEach(
        (dispatch, op) => result[op] = call(dispatch, op, result)
      );
      return result;
    }
  };
};


if (require.main == module) {
  const ops = arithmetic()
    .register({
      add: {
        Integer: {
          Integer: (a, b) => a + b,
          String : (n, s) => `${n}+"${s}"`
        },
        __default__: (x, y) => `${x} plus ${y}`
      },
      test: {
        __default__: (x, y, ops) => `<${ops.add(x, y)}>`
      }
    })
    .ops();

  console.log(`add(3, 4) = ${ops.add(3, 4)}`);
  console.log(`add(5, "Olaf") = ${ops.add(5, "Olaf")}`);
  console.log(`add("Olaf", "Delgado") = ${ops.add("Olaf", "Delgado")}`);
  console.log(`test(5, "Olaf") = ${ops.test(5, "Olaf")}`);
}
