let _timers = null;

export function useTimers(timers) {
  _timers = timers;
};


export const typeOf = x => {
  _timers && _timers.start('arithmetic: type determination');

  let t = x == null ? 'Null' : (x.__typeName || x.constructor.name);

  if (t == 'Number') {
    t = Number.isSafeInteger(x)
      ? 'Integer' : 'Float';
  }
  else if (t == 'Array') {
    t = (x.length > 0 && x[0].constructor.name == 'Array')
      ? 'Matrix' : 'Vector';
  }

  _timers && _timers.stop('arithmetic: type determination');

  return t;
};


const call = (dispatch, op, ops) => (...args) => {
  _timers && _timers.start('arithmetic: dispatch');

  let next = dispatch;
  for (let i = 0; i < args.length && next; ++i)
    next = next[typeOf(args[i])];

  const method = next || dispatch['__default__'];

  _timers && _timers.stop('arithmetic: dispatch');

  if (method)
    return method(...args, ops);
  else {
    const msg = `Operator '${op}' not defined on [${args.map(typeOf)}]`;
    throw new Error(msg);
  }
};


const _isObject = o => o != null && o.constructor == Object;


const mergeDeep = (obj, mods) => {
  const out = Object.assign({}, obj);

  for (const k in mods) {
    if (_isObject(out[k]) && _isObject(mods[k]))
      out[k] = mergeDeep(out[k], mods[k]);
    else
      out[k] = mods[k];
  }

  return out;
};


const gcd = (a, b, ops) => {
  a = ops.abs(a);
  b = ops.abs(b);

  while (ops.sgn(b) > 0)
    [a, b] = [b, ops.mod(a, b)];

  return a;
};


const mod = (x, y, ops) => ops.minus(x, ops.times(ops.idiv(x, y), y));


const fromRepr = (obj, ops) => {
  const keys = Object.keys(obj);
  if (keys.length != 1)
    throw new Error('must have exactly one key');

  return ops[`__${keys[0]}__`](obj);
};


const defaults = {
  isInteger    : { __default__: x => false },
  isRational   : { __default__: x => false },
  isReal       : { __default__: x => false },

  eq: { __default__: (a, b, ops) => ops.cmp(a, b) == 0 },
  ne: { __default__: (a, b, ops) => ops.cmp(a, b) != 0 },
  lt: { __default__: (a, b, ops) => ops.cmp(a, b) <  0 },
  gt: { __default__: (a, b, ops) => ops.cmp(a, b) >  0 },
  le: { __default__: (a, b, ops) => ops.cmp(a, b) <= 0 },
  ge: { __default__: (a, b, ops) => ops.cmp(a, b) >= 0 },

  mod: { __default__: mod },
  gcd: { __default__: gcd },

  typeOf  : { __default__: x => typeOf(x) },
  repr    : { __default__: (x, ops) => ({ [typeOf(x)]: ops.__repr__(x) }) },
  fromRepr: { Object: fromRepr },

  __repr__: { __default__: x => x }
};


export function arithmetic(registry = mergeDeep({}, defaults)) {
  const result = {
    register(specs) {
      return arithmetic(mergeDeep(registry, specs));
    }
  };
  for (const op in registry)
    result[op] = call(registry[op], op, result);

  return result;
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
    });

  console.log(`add(3, 4) = ${ops.add(3, 4)}`);
  console.log(`add(5, "Olaf") = ${ops.add(5, "Olaf")}`);
  console.log(`add("Olaf", "Delgado") = ${ops.add("Olaf", "Delgado")}`);
  console.log(`test(5, "Olaf") = ${ops.test(5, "Olaf")}`);
}
