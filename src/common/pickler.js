const registry = {
};


export const register = (type, encoder, decoder) => {
  registry[type] = { encoder, decoder };
};


const mapObject = (obj, fn) => {
  const out = {};
  for (const k of Object.keys(obj))
    out[k] = fn(obj[k]);
  return out;
};


export const pickle = x => {
  if (x == null)
    return x;
  else {
    const type = x.__typeName;

    if (type != null && registry[type] != null) {
      const encoder = registry[type].encoder || (x => x);
      return { __typeName: type, value: encoder(x) };
    }
    else if (x.constructor.name == 'Array')
      return x.map(pickle);
    else if (x.constructor.name == 'Object')
      return mapObject(x, pickle);
    else
      return x;
  }
};


export const unpickle = x => {
  if (x == null)
    return x;
  else {
    const type = x.__typeName;

    if (type != null && registry[type] != null) {
      const decoder = registry[type].decoder || (x => x);
      return decoder(x.value);
    }
    else if (x.constructor.name == 'Array')
      return x.map(unpickle);
    else if (x.constructor.name == 'Object')
      return mapObject(x, unpickle);
    else
      return x;
  }
};
