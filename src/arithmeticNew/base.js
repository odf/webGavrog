import * as I from 'immutable';


export const typeOf = x => {
  const t = x.constructor.name;

  if (t == 'Number') {
    const s = Math.abs(x);
    return (s % 1 == 0 && s + 1 > s) ? 'Integer' : 'Float';
  }
  else
    return t;
};


export default function arithmetic() {
  const _registry = I.Map().asMutable();

  const _call = op => {
    const dispatch = _registry.get(op);

    return (...args) => {
      const method = dispatch.getIn(args.map(typeOf));

      if (method)
        return method(...args);
      else {
        const msg = `Operator '${op}' not defined on [${args.map(typeOf)}]`;
        throw new Error(msg);
      }
    };
  };

  return {
    register(specs) {
      for (const {op, argtypes, method} of specs) {
        _registry.setIn([op].concat(argtypes), method);
      }
      return this;
    },

    ops() {
      const result = {};
      _registry.keySeq().forEach(op => { result[op] = _call(op); });
      return result;
    }
  };
};


if (require.main == module) {
  const ops = arithmetic()
    .register([
      { op: 'add',
        argtypes: ['Integer', 'Integer'],
        method: (a, b) => a + b
      },
      { op: 'add',
        argtypes: ['Integer', 'String'],
        method: (n, s) => `${n}+"${s}"`
      }
    ])
    .ops();

  console.log(`add(3, 4) = ${ops.add(3, 4)}`);
  console.log(`add(5, "Olaf") = ${ops.add(5, "Olaf")}`);
}
