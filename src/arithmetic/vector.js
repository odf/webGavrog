import * as I from 'immutable';


export default function vector(scalar, zero) {

  const Vector = I.Record({
    size: undefined,
    data: undefined
  });

  Vector.prototype.toString = function() {
    return '<vector: '+this.data+'>'
  };

  Vector.prototype.equals = function(other) {
    return this.size == other.size && this.data.equals(other.data);
  };

  const get = (v, i) => v.data.get(i);

  const make = function make(data) {
    const tmp = I.List(data);
    if (tmp.size == 0)
      throw new Error('must have positive size');

    return new Vector({
      size: tmp.size,
      data: tmp
    });
  };

  const constant = function constant(size, value) {
    const x = value === undefined ? zero : value;
    return make(I.List(I.Repeat(x, size)));
  };

  const set    = (v, i, x)  => make(v.data.set(i, x));
  const update = (v, i, fn) => make(v.data.update(i, fn));

  const plus = function plus(v, w) {
    if (v.size != w.size)
      throw new Error('shapes do not match');

    return make(I.Range(0, v.size).map(i => scalar.plus(get(v, i), get(w, i))));
  };

  const minus = function minus(v, w) {
    if (v.size != w.size)
      throw new Error('shapes do not match');

    return make(I.Range(0, v.size).map(i => scalar.minus(get(v, i), get(w, i))));
  };

  const scaled = (f, v) => make(v.data.map(x => scalar.times(f, x)));

  const cmp = function cmp(v, w) {
    const d = I.Range(0, Math.min(v.size, w.size))
      .map(i => scalar.cmp(get(v, i), get(w, i)))
      .filter(x => !!x)
      .first();

    return d || v.size - w.size;
  };

  const dotProduct = function dotProduct(v, w) {
    if (v.size != w.size)
      throw new Error('shapes do not match');

    return I.Range(0, v.size)
      .map(i => scalar.times(get(v, i), get(w, i)))
      .reduce(scalar.plus, zero);
  };

  const crossProduct = function crossProduct(v, w) {
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
