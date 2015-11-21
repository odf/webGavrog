import * as I from 'immutable';


export default function vector(scalar, zero) {

  const Vector = I.Record({
    size: undefined,
    data: undefined
  });

  Vector.prototype.toString = function() {
    return `<vector: List [ ${this.data.join(', ')} ]>`;
  };

  Vector.prototype.equals = function(other) {
    return cmp(this, other) == 0;
  };

  const get = (v, i) => v.data[i];

  const _make = data => {
    if (data.length == 0)
      throw new Error('must have positive size');

    return new Vector({
      size: data.length,
      data: data
    });
  };

  const _array = (len, val = 0) => Array(len).fill(val);

  const make     = data => _make(Array.isArray(data) ? data : data.toJS());
  const constant = (size, value) => _make(_array(size, value));

  const set    = (v, i, x)  => _make(v.data.slice().fill(x, i, i+1));
  const update = (v, i, fn) => set(v, i, fn(get(v, i)));

  const plus = (v, w) => {
    if (v.size != w.size)
      throw new Error('shapes do not match');

    return _make(
      _array(v.size).map((_, i) => (
        scalar.plus(get(v, i), get(w, i)))));
  };

  const minus = (v, w) => {
    if (v.size != w.size)
      throw new Error('shapes do not match');

    return _make(
      _array(v.size).map((_, i) => (
        scalar.minus(get(v, i), get(w, i)))));
  };

  const scaled = (f, v) => _make(v.data.map(x => scalar.times(f, x)));

  const cmp = (v, w) => {
    for (let i = 0; i < v.size && i < w.size; ++i) {
      const d = scalar.cmp(get(v, i), get(w, i));
      if (d)
        return d;
    }

    return v.size - w.size;
  };

  const dotProduct = (v, w) => {
    if (v.size != w.size)
      throw new Error('shapes do not match');

    return _array(v.size)
      .map((_, i) => scalar.times(get(v, i), get(w, i)))
      .reduce(scalar.plus, zero);
  };

  const crossProduct = (v, w) => {
    if (v.size != 3 || w.size != 3)
      throw new Error('both vector must be three-dimensional');

    return make([
      scalar.minus(scalar.times(get(v, 1), get(w, 2)),
                   scalar.times(get(v, 2), get(w, 1))),
      scalar.minus(scalar.times(get(v, 2), get(w, 0)),
                   scalar.times(get(v, 0), get(w, 2))),
      scalar.minus(scalar.times(get(v, 0), get(w, 1)),
                   scalar.times(get(v, 1), get(w, 0)))
    ]);
  };

  const norm       = v => Math.sqrt(scalar.toJS(dotProduct(v, v)));
  const normalized = v => scaled(1 / norm(v), v);

  return {
    get,
    make,
    constant,
    set,
    update,
    plus,
    minus,
    scaled,
    cmp,
    dotProduct,
    crossProduct,
    norm,
    normalized
  };
};
