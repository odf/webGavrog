import * as I from 'immutable';


export const typeOf = x => {
  const t = x.__typeName || x.constructor.name;

  if (t == 'Number') {
    const s = Math.abs(x);
    return (s % 1 == 0 && s + 1 > s) ? 'Integer' : 'Float';
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


const defaults = {
  isZero       : { __default__: (x, ops) => ops.sgn(x) == 0 },
  isPositive   : { __default__: (x, ops) => ops.sgn(x) >  0 },
  isNonNegative: { __default__: (x, ops) => ops.sgn(x) >= 0 },
  isNegative   : { __default__: (x, ops) => ops.sgn(x) <  0 },
  isNonPositive: { __default__: (x, ops) => ops.sgn(x) <= 0 },

  mod: { __default__: (x, y, ops) => ops.minus(x, ops.times(ops.idiv(x, y), y)) }
};


export function arithmetic() {
  let _registry = I.Map();

  const result = {
    register(specs) {
      _registry = _registry.mergeDeep(specs);
      return this;
    },

    ops() {
      const result = {};
      _registry.forEach(
        (dispatch, op) => result[op] = call(dispatch, op, result)
      );
      return result;
    }
  };

  return result.register(defaults);
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
