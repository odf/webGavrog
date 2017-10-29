const typeOf = x => {
  const t = x == null ? 'Null' : (x.__typeName || x.constructor.name);

  if (t == 'Number') {
    return Number.isSafeInteger(x) ? 'Integer' : 'Float';
  }
  else if (t == 'Array') {
    const isMatrix = x.length > 0 && x[0].constructor.name == 'Array';
    return isMatrix ? 'Matrix' : 'Vector';
  }
  else
    return t;
};


const call = (dispatch, op, ops) => (...args) => {
  let next = dispatch;
  for (let i = 0; next && i < args.length; ++i)
    next = next[typeOf(args[i])];

  const method = next || dispatch['__default__'];

  if (method)
    return method(...args, ops);
  else {
    const types = args.map(typeOf);
    const context = ops.__context__();
    throw new Error(`${context} - Operator '${op}' not defined on [${types}]`);
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


const gcdex = (a, b, ops) => {
  const cs = [[a, b], [1, 0], [0, 1]];

  while (ops.ne(cs[0][1], 0)) {
    const q = ops.idiv(cs[0][0], cs[0][1]);
    for (let i = 0; i < 3; ++i)
      [cs[i][0], cs[i][1]] =
      [cs[i][1], ops.minus(cs[i][0], ops.times(q, cs[i][1]))];
  }

  return [cs[0][0], cs[1][0], cs[2][0], cs[1][1], cs[2][1]];
};


const mod = (x, y, ops) => ops.minus(x, ops.times(ops.idiv(x, y), y));


const defaults = {
  __context__: () => 'default',

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
  gcdex: { __default__: gcdex },

  typeOf     : { __default__: x => typeOf(x) }
};


export const arithmetic = (registry = mergeDeep({}, defaults)) => {
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
