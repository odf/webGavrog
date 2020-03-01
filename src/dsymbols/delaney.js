import * as pickler from '../common/pickler';


const range = (from, to) => [...Array(to).keys()].slice(from);


class DSymbol {
  constructor(dim, sData, vData) {
    this._s = new Int32Array(sData);
    this._v = new Int32Array(vData);
    this._dim = dim;
    this._size = this._s.length / (dim + 1);
    this._orbits2 = {};
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
      else if (j != i && this.s(i, D) == this.s(j, D))
        return 2;
      else
        return 1;
    }
  }

  orbits2(i, j) {
    if (!this._orbits2[[i, j]]) {
      const orbitIndex = {};
      const orbitList = [];

      for (let D = 1; D <= this.size; ++D) {
        if (orbitIndex[D] == null) {
          const elements = [];
          let r = 0;
          let E = D;

          do {
            E = this.s(i, E) || E;
            if (orbitIndex[E] == null) {
              orbitIndex[E] = orbitList.length;
              elements.push(E);
            }
            E = this.s(j, E) || E;
            if (orbitIndex[E] == null) {
              orbitIndex[E] = orbitList.length;
              elements.push(E);
            }
            ++r;
          }
          while (E != D);

          orbitList.push({ elements, r });
        }
      }

      this._orbits2[[i, j]] = { list: orbitList, index: orbitIndex };
    }

    return this._orbits2[[i, j]];
  }

  orbit2(i, j, D) {
    const { list, index } = this.orbits2(i, j);
    return (list[index[D]] || {}).elements;
  }

  r(i, j, D) {
    const { list, index } = this.orbits2(i, j);
    return (list[index[D]] || {}).r;
  }

  orbitReps2(i, j) {
    return this.orbits2(i, j).list.map(({ elements }) => elements[0]);
  }

  m(i, j, D) {
    return this.r(i, j, D) * this.v(i, j, D);
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
      const reps = this.orbitReps2(i, i+1);
      out.push(reps.map(D => this.m(i, i+1, D) || 0).join(' '));
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


const makeDSymbol = (dim, s, v) => Object.freeze(new DSymbol(dim, s, v));


export const isElement = (ds, D) => ds.isElement(D);
export const elements = ds => ds.elements();
export const size = ds => ds.size;

export const isIndex = (ds, i) => ds.isIndex(i);
export const indices = ds => ds.indices();
export const dim = ds => ds.dim;

export const s = (ds, i, D) => ds.s(i, D);
export const v = (ds, i, j, D) => ds.v(i, j, D);
export const r = (ds, i, j, D) => ds.r(i, j, D);
export const m = (ds, i, j, D) => ds.m(i, j, D);

export const orbit2 = (ds, i, j, D) => ds.orbit2(i, j, D);
export const orbitReps2 = (ds, i, j) => ds.orbitReps2(i, j);


const assert = (condition, message) => {
  if (!condition)
    throw new Error(message || 'assertion error');
};


const assertIndex = (ds, i) =>
  assert(ds.isIndex(i), `need integer between 0 and ${ds.dim}, got ${i}`);

const assertElement = (ds, D) =>
  assert(ds.isElement(D), `need integer between 1 and ${ds.size}, got ${D}`);


const assertNonNegative = v =>
  assert(Number.isInteger(v) && v >= 0, `need non-negative integer, got ${v}`);


const withPairings = (ds, i, specs) => {
  assertIndex(ds, i);

  const sNew = ds._s.slice();
  const get = D => sNew[i * ds.size + D - 1];
  const set = (D, x) => { sNew[i * ds.size + D - 1] = x; };

  const dangling = [];

  for (const [D, E] of specs) {
    assertElement(ds, D);
    assertElement(ds, E);

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


const withBranchings = (ds, i, specs) => {
  assertIndex(ds, i);

  const vNew = ds._v.slice();

  for (const [D, v] of specs) {
    assertElement(ds, D);
    assertNonNegative(v);

    for (const E of ds.orbit2(i, i+1, D))
      vNew[i * ds.size + E - 1] = v;
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


export const buildDSet = ({ dim, size, getS }) => {
  const offset = (i, D) => i * size + D - 1;
  const s = new Int32Array((dim + 1) * size);

  for (let i = 0; i <= dim; ++i) {
    for (let D = 1; D <= size; ++D) {
      const Di = getS(i, D);

      for (const [A, B] of [[D, Di], [Di, D]]) {
        const oldB = s[offset(i, A)];

        if (!Number.isInteger(B) || B < 1 || B > size)
          throw new Error(`s(${i}, ${A}) set to ${B}, must be in 1..${size}`);
        else if (oldB == 0)
          s[offset(i, A)] = B;
        else if (oldB != B)
          throw new Error(`s(${i}, ${A}) set to ${B}, was ${oldB}`);
      }
    }
  }

  return makeDSymbol(dim, s);
};


export const buildDSymbol = ({ dim, size, getS, getV, getM }, ds) => {
  if (getV && getM)
    throw new Error('must define exactly one of getV and getM');

  if (ds == null)
    ds = buildDSet({ dim, size, getS });

  const offset = (i, D) => i * ds.size + D - 1;
  const v = new Int32Array(ds.dim * ds.size);

  for (let i = 0; i < ds.dim; ++i) {
    for (let D = 1; D <= ds.size; ++D) {
      const val = getM ? getM(i, D) / ds.r(i, i+1, D) : getV(i, D);
      const oldVal = v[offset(i, D)];

      if (!Number.isInteger(val) || val < 0)
        throw new Error(`v(${i}, ${D}) set ${val}, must be natural number`);
      else if (oldVal == 0) {
        for (const E of ds.orbit2(i, i+1, D))
          v[offset(i, E)] = val;
      }
      else if (oldVal != val)
        throw new Error(`v(${i}, ${i+1}, ${D}) set to ${val}, was ${oldVal}`);
    }
  }

  return makeDSymbol(ds.dim, ds._s, v);
};


export const parse = str => {
  const parseInts = str => str.trim().split(/\s+/).map(s => parseInt(s));

  const parts = str.trim().replace(/^</, '').replace(/>$/, '').split(/:/);
  if (parts[0].match(/\d+\.\d+/))
    parts.shift();

  const dims = parseInts(parts[0]);
  const gluings = parts[1].split(/,/).map(parseInts);
  const degrees = parts[2].split(/,/).map(parseInts);

  const size = dims[0];
  const dim  = dims[1] || 2;
  const offset = (i, D) => i * size + D - 1;
  const s = new Int32Array((dim + 1) * size);
  const v = new Int32Array(dim * size);

  for (let i = 0; i <= dim; ++i) {
    let k = -1;
    for (let D = 1; D <= size; ++D) {
      if (!s[offset(i, D)]) {
        const E = gluings[i][++k];
        s[offset(i, D)] = E;
        s[offset(i, E)] = D;
      }
    }
  }

  const ds = makeDSymbol(dim, s);

  for (let i = 0; i < dim; ++i) {
    let k = -1;
    for (const D of ds.orbitReps2(i, i+1)) {
      const val = (degrees[i][++k] || 0) / ds.r(i, i+1, D);
      if (!Number.isInteger(val) || val < 0)
        throw new Error(`v(${i}, ${D}) set ${val}, must be natural number`);
      else {
        for (const E of ds.orbit2(i, i+1, D))
          v[offset(i, E)] = val;
      }
    }
  }

  return makeDSymbol(dim, s, v);
};


if (require.main == module) {
  const ds = parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>');

  console.log(`${ds}`);
  console.log(`pickled: ${JSON.stringify(pickler.pickle(ds))}`);
  console.log(`unpickled: ${pickler.unpickle(pickler.pickle(ds))}`);

  console.log(`${withPairings(ds, 1, [[2,1]])}`);
  console.log(`${withBranchings(ds, 0, [[2,3],[1,5]])}`);
}
