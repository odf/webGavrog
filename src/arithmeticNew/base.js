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


const defaults = {
  isZero       : [{ method: (x, ops) => ops.sgn(x) == 0 }],
  isPositive   : [{ method: (x, ops) => ops.sgn(x) >  0 }],
  isNonNegative: [{ method: (x, ops) => ops.sgn(x) >= 0 }],
  isNegative   : [{ method: (x, ops) => ops.sgn(x) <  0 }],
  isNonPositive: [{ method: (x, ops) => ops.sgn(x) <= 0 }],

  mod: [{ method: (x, y, ops) => ops.minus(x, ops.times(ops.idiv(x, y), y)) }]
};


export default function arithmetic() {
  const _registry = I.Map().asMutable();

  const _call = (op, ops) => {
    const dispatch = _registry.get(op);

    return (...args) => {
      const method = dispatch.getIn(args.map(typeOf)) || dispatch.get()

      if (method)
        return method(...args, ops);
      else {
        const msg = `Operator '${op}' not defined on [${args.map(typeOf)}]`;
        throw new Error(msg);
      }
    };
  };

  const result = {
    register(specs) {
      for (const op in specs) {
        for (const {argtypes, method} of specs[op]) {
          _registry.setIn([op].concat(argtypes || [undefined]), method);
        }
      }
      return this;
    },

    ops() {
      const result = {};
      _registry.keySeq().forEach(op => { result[op] = _call(op, result); });
      return result;
    }
  };

  return result.register(defaults);
};


if (require.main == module) {
  const ops = arithmetic()
    .register({
      add: [
        { argtypes: ['Integer', 'Integer'], method: (a, b) => a + b },
        { argtypes: ['Integer', 'String' ], method: (n, s) => `${n}+"${s}"` },
        { method: (x, y) => `${x} plus ${y}` }
      ]
    })
    .ops();

  console.log(`add(3, 4) = ${ops.add(3, 4)}`);
  console.log(`add(5, "Olaf") = ${ops.add(5, "Olaf")}`);
  console.log(`add("Olaf", "Delgado") = ${ops.add("Olaf", "Delgado")}`);
}
