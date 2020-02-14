import * as pickler from '../common/pickler';


const range = (from, to) => [...Array(to).keys()].slice(from);


class DSymbol {
  constructor(dim, sData, vData) {
    this._s = new Int32Array(sData);
    this._v = new Int32Array(vData);
    this._dim = dim;
    this._size = this._v.length / dim;
  }

  get dim() {
    return this._dim;
  }

  get size() {
    return this._size;
  }

  isElement(D) {
    return Number.isInteger(D) && D >= 1 && D <= this.size;
  }

  elements() {
    return range(1, this.size + 1);
  }

  isIndex(i) {
    return Number.isInteger(i) && i >= 0 && i <= this.dim;
  }

  indices() {
    return range(0, this.dim + 1);
  }

  s(i, D) {
    if (this.isElement(D) && this.isIndex(i))
      return this._s[i * this.size + D - 1];
  }

  v(i, j, D) {
    if (this.isElement(D) && this.isIndex(i) && this.isIndex(j)) {
      if (j == i+1)
        return this._v[i * this.size + D - 1];
      else if (j == i-1)
        return this._v[j * this.size + D - 1];
      else if (this.s(i, D) == this.s(j, D))
        return 2;
      else
        return 1;
    }
  }

  toString() {
    const out = [
      '<1.1:',
      (this.dim == 2 ? [this.size] : [this.size, this.dim]).join(' '),
      ':'
    ];

    for (let i = 0; i <= this.dim; ++i) {
      if (i > 0)
        out.push(',');
      const reps = this.elements().filter(D => (this.s(i, D) || D) >= D);
      out.push(reps.map(D => this.s(i, D) || 0).join(' '));
    }

    out.push(':');

    for (let i = 0; i < this.dim; ++i) {
      if (i > 0)
        out.push(',');
      const reps = orbitReps2(this, i, i+1);
      out.push(reps.map(D => m(this, i, i+1, D) || 0).join(' '));
    }

    out.push('>');

    return out.join('');
  }

  get __typeName() { return 'DelaneySymbol'; }
};


pickler.register(
  'DelaneySymbol',
  ({ _s, _v, _dim }) => ({ _s, _v, _dim }),
  ({ _s, _v, _dim }) => new DSymbol(_dim, _s, _v)
);


export const makeDSymbol = (dim, s, v) =>
  Object.freeze(new DSymbol(dim, s, v));


const _assert = (condition, message) => {
  if (!condition)
    throw new Error(message || 'assertion error');
};


const _assertIndex = (ds, i) =>
  _assert(ds.isIndex(i), `need integer between 0 and ${ds.dim}, got ${i}`);

const _assertElement = (ds, D) =>
  _assert(ds.isElement(D), `need integer between 1 and ${ds.size}, got ${D}`);


const _assertNonNegative = v =>
  _assert(Number.isInteger(v) && v >= 0, `need non-negative integer, got ${v}`);


export const withPairings = (ds, i, specs) => {
  _assertIndex(ds, i);

  const sNew = ds._s.slice();
  const get = D => sNew[i * ds.size + D - 1];
  const set = (D, x) => { sNew[i * ds.size + D - 1] = x; };

  const dangling = [];

  for (const [D, E] of specs) {
    _assertElement(ds, D);
    _assertElement(ds, E);

    dangling.push(get(D));
    dangling.push(get(E));

    set(D, E);
    set(E, D);
  }

  for (const D of dangling) {
    if (D && get(get(D)) != D)
      set(D, 0);
  }

  return makeDSymbol(ds.dim, sNew, ds._v);
};


export const withBranchings = (ds, i, specs) => {
  _assertIndex(ds, i);

  const vNew = ds._v.slice();
  const set = (D, x) => { vNew[i * ds.size + D - 1] = x; };

  for (const [D, v] of specs) {
    _assertElement(ds, D);
    _assertNonNegative(v);

    let E = D;
    do {
      E = ds.s(i, E) || E;
      set(E, v);
      E = ds.s(i+1, E) || E;
      set(E, v);
    }
    while (E != D);
  }

  return makeDSymbol(ds.dim, ds._s, vNew);
};


export const build = (dim, size, pairingsFn, branchingsFn) => {
  let ds = makeDSymbol(
    dim,
    new Int32Array((dim+1) * size),
    new Int32Array(dim * size)
  );

  const ds0 = ds;
  for (let i = 0; i <= dim; ++i)
    ds = withPairings(ds, i, pairingsFn(ds0, i));

  const ds1 = ds;
  for (let i = 0; i < dim; i++)
    ds = withBranchings(ds, i, branchingsFn(ds1, i));

  return ds;
};


export const parse = str => {
  const _parseInts = str => str.trim().split(/\s+/).map(s => parseInt(s));

  const parts = str.trim().replace(/^</, '').replace(/>$/, '').split(/:/);
  if (parts[0].match(/\d+\.\d+/))
    parts.shift();

  const dims = _parseInts(parts[0]);
  const size = dims[0];
  const dim  = dims[1] || 2;

  const gluings = parts[1].split(/,/).map(_parseInts);
  const degrees = parts[2].split(/,/).map(_parseInts);

  const s = new Int32Array((dim+1) * size);
  const v = new Int32Array(dim * size);

  const get = (a, i, D)    => a[i * size + D - 1];
  const set = (a, i, D, x) => { a[i * size + D - 1] = x; };

  for (let i = 0; i <= dim; ++i) {
    let k = -1;
    for (let D = 1; D <= size; ++D) {
      if (!get(s, i, D)) {
        const E = gluings[i][++k];
        set(s, i, D, E);
        set(s, i, E, D);
      }
    }
  }

  for (let i = 0; i < dim; ++i) {
    let k = -1;
    for (let D = 1; D <= size; ++D) {
      if (!get(v, i, D)) {
        const m = degrees[i][++k];
        let E = D;
        let r = 0;

        do {
          E = get(s, i, E) || E;
          E = get(s, i+1, E) || E;
          ++r;
        }
        while (E != D);

        const b = m / r;

        do {
          E = get(s, i, E) || E;
          set(v, i, E, b);
          E = get(s, i+1, E) || E;
          set(v, i, E, b);
        }
        while (E != D);
      }
    }
  }

  return makeDSymbol(dim, s, v);
};


export const orbit2 = (ds, i, j, D) => {
  const seen = new Int8Array(ds.size + 1);
  const result = [];

  let E = D;
  do {
    for (const k of [i, j]) {
      E = ds.s(k, E) || E;
      if (!seen[E]) {
        result.push(E);
        seen[E] = true;
      }
    }
  }
  while (E != D);

  return result;
};


export const orbitReps2 = (ds, i, j) => {
  const seen = new Int8Array(ds.size + 1);
  const result = [];

  for (const D of ds.elements()) {
    if (!seen[D]) {
      let E = D;

      do {
        E = ds.s(i, E) || E;
        seen[E] = true;
        E = ds.s(j, E) || E;
        seen[E] = true;
      }
      while (E != D);

      result.push(D);
    }
  }

  return result;
};


export const r = (ds, i, j, D) => {
  let k = 0;
  let E = D;

  do {
    E = ds.s(i, E) || E;
    E = ds.s(j, E) || E;
    ++k;
  }
  while (E != D);

  return k;
};


export const isElement = (ds, D) => ds.isElement(D);
export const elements = ds => ds.elements();
export const size = ds => ds.size;

export const isIndex = (ds, i) => ds.isIndex(i);
export const indices = ds => ds.indices();
export const dim = ds => ds.dim;

export const s = (ds, i, D) => ds.s(i, D);
export const v = (ds, i, j, D) => ds.v(i, j, D);
export const m = (ds, i, j, D) => ds.v(i, j, D) * r(ds, i, j, D);


export const parseSymbols = text => text
  .split('\n')
  .filter(line => line.match(/^\s*</))
  .map(parse);


if (require.main == module) {
  const ds = parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>');

  console.log(`${ds}`);
  console.log(`pickled: ${JSON.stringify(pickler.pickle(ds))}`);
  console.log(`unpickled: ${pickler.unpickle(pickler.pickle(ds))}`);

  console.log(`${withPairings(ds, 1, [[2,1]])}`);
  console.log(`${withBranchings(ds, 0, [[2,3],[1,5]])}`);
}
