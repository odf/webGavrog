import * as I from 'immutable';


const _assert = (condition, message) => {
  if (!condition)
    throw new Error(message || 'assertion error');
};


const _isElement = (dsImpl, D) =>
  typeof D == 'number' && D >= 1 && D <= dsImpl.size;

const _isIndex = (dsImpl, i) =>
  typeof i == 'number' && i >= 0 && i <= dsImpl.dim;

const _elements = dsImpl => I.Range(1, dsImpl.size+1);
const _indices  = dsImpl => I.Range(0, dsImpl.dim+1);
const _index    = (dsImpl, i, D) => i * dsImpl.size + D - 1;
const _get      = (dsImpl, list, i, D) => list.get(_index(dsImpl, i, D));
const _set      = (dsImpl, list, i, D, x) => list.set(_index(dsImpl, i, D), x);

const _s = (dsImpl, i, D) => {
  if (_isElement(dsImpl, D) && _isIndex(dsImpl, i))
    return _get(dsImpl, dsImpl.s, i, D);
};

const _v = (dsImpl, i, j, D) => {
  if (_isElement(dsImpl, D) && _isIndex(dsImpl, i) && _isIndex(dsImpl, j)) {
    if (j == i+1)
      return _get(dsImpl, dsImpl.v, i, D);
    else if (j == i-1)
      return _get(dsImpl, dsImpl.v, j, D);
    else if (_get(dsImpl, dsImpl.s, i, D) == _get(dsImpl, dsImpl.s, j, D))
      return 2;
    else
      return 1;
  }
};


const _merge = (a, b) => a.withMutations(list => {
  b.forEach((x, i) => {
    if (x !== undefined) list.set(i, x);
  });
});


const _precheckPairings = (specs, size) => {
  specs.forEach(p => {
    _assert(p.size == 1 || p.size == 2,
            'expected pair or singleton, got '+p);

    const D = p.get(0);
    const E = p.size > 1 ? p.get(1) : p.get(0);

    _assert(typeof D == 'number' && D % 1 == 0 && D > 0,
            'expected a positive integer, got '+D);
    _assert(D <= size,
            'expected at most '+size+', got '+D);

    _assert(typeof E == 'number' && E % 1 == 0 && E >= 0,
            'expected a non-negative integer, got '+E);
    _assert(E <= size,
            'expected at most '+size+', got '+E);
  });
};


const _withPairings = (dsImpl, i, inputs) => {
  const specs = I.List(inputs).map(I.List);
  _precheckPairings(specs, dsImpl.size);

  _assert(typeof i == 'number' && i % 1 == 0 && i >= 0 && i <= dsImpl.dim,
          'expected an integer between 0 and '+dsImpl.dim+', got i');

  const sNew = I.List().withMutations(list => {
    const dangling = [];

    specs.forEach(p => {
      const D = p.get(0);
      const E = p.size > 1 ? p.get(1) : p.get(0);
      const Di = _get(dsImpl, list, i, D);
      const Ei = _get(dsImpl, list, i, E);

      _assert(Di === undefined || Di == E,
              'conflicting partners '+Di+' and '+E+' for '+D);
      _assert(Ei === undefined || Ei == D,
              'conflicting partners '+Ei+' and '+D+' for '+E);

      dangling.push(_get(dsImpl, dsImpl.s, i, D));
      dangling.push(_get(dsImpl, dsImpl.s, i, E));

      _set(dsImpl, list, i, D, E);
      _set(dsImpl, list, i, E, D);
    });

    dangling.forEach(D => {
      if (D && _get(dsImpl, list, i, D) === undefined)
        _set(dsImpl, list, i, D, 0);
    });
  });

  return _fromData(dsImpl.dim, _merge(dsImpl.s, sNew), dsImpl.v);
};


const _precheckBranchings = (specs, size) => {
  specs.forEach(p => {
    _assert(p.size == 2, 'expected pair, got '+p);

    const D = p.get(0);
    const v = p.get(1);

    _assert(typeof D == 'number' && D % 1 == 0 && D > 0,
            'expected a positive integer, got '+D);
    _assert(D <= size,
            'expected at most '+size+', got '+D);

    _assert(typeof v == 'number' && v % 1 == 0 && v >= 0,
            'expected a non-negative integer, got '+v);
  });
};


const _withBranchings = (dsImpl, i, inputs) => {
  const specs = I.List(inputs).map(I.List);
  _precheckBranchings(specs, dsImpl.size);

  _assert(typeof i == 'number' && i % 1 == 0 && i >= 0 && i <= dsImpl.dim-1,
          'expected integer between 0 and '+dsImpl.dim-1+', got i');

  const vNew = I.List().withMutations(list => {
    specs.forEach(p => {
      const D = p.get(0);
      const v = p.get(1);
      const vD = _get(dsImpl, list, i, D);

      _assert(vD === undefined || vD == v,
              'conflicting values '+vD+' and '+v+' for '+D);

      let E = D;
      do {
        E = _get(dsImpl, dsImpl.s, i, E) || E;
        _set(dsImpl, list, i, E, v);
        E = _get(dsImpl, dsImpl.s, i+1, E) || E;
        _set(dsImpl, list, i, E, v);
      }
      while (E != D);
    });
  });

  return _fromData(dsImpl.dim, dsImpl.s, _merge(dsImpl.v, vNew));
};


const _fromData = (dim, sData, vData) => {
  const s = I.List(sData);
  const v = I.List(vData);
  const size = v.size / dim;

  const _ds = { s, v, dim, size };

  return {
    isElement     : d         => _isElement(_ds, D),
    elements      : ()        => _elements(_ds),
    isIndex       : i         => _isIndex(_ds, i),
    indices       : ()        => _indices(_ds),
    s             : (i, D)    => _s(_ds, i, D),
    v             : (i, j, D) => _v(_ds, i, j, D),
    withPairings  : (i, data) => _withPairings(_ds, i, data),
    withBranchings: (i, data) => _withBranchings(_ds, i, data),

    toString() { return stringify(this); },
    toJSON() { return stringify(this); }
  }
};


export const build = (dim, size, pairingsFn, branchingsFn) => {
  const s = I.List().setSize((dim+1) * size);
  const v = I.List().setSize(dim * size);
  const ds0 = _fromData(dim, s, v);

  const ds1 = I.Range(0, dim+1).reduce(
    (tmp, i) => tmp.withPairings(i, pairingsFn(ds0, i)),
    ds0);

  const ds2 = I.Range(0, dim).reduce(
    (tmp, i) => tmp.withBranchings(i, branchingsFn(ds1, i)),
    ds1);

  return ds2;
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

  const s = new Array((dim+1) * size);
  const v = new Array(dim * size);

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

  return _fromData(dim, s, v);
};


export const orbitReps1 = (ds, i) => {
  return ds.elements().filter(D => (ds.s(i, D) || D) >= D);
};


export const orbit2 = (ds, i, j, D) => {
  return I.Set().withMutations(set => {
    let E = D;
    do {
      E = ds.s(i, E) || E;
      set.add(E);
      E = ds.s(j, E) || E;
      set.add(E);
    }
    while (E != D);
  });
};


export const orbitReps2 = (ds, i, j) => {
  const seen = new Array(ds.elements().size + 1);
  const result = [];

  ds.elements().forEach(D => {
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
  });

  return I.List(result);
};


export const stringify = ds => {
  const sDefs = ds.indices()
    .map(i => (
      orbitReps1(ds, i)
        .map(D => ds.s(i, D) || 0)
        .join(' ')))
    .join(',');

  const mDefs = ds.indices()
    .filter(i => ds.isIndex(i+1))
    .map(i => (
      orbitReps2(ds, i, i+1)
        .map(D => m(ds, i, i+1, D) || 0)
        .join(' ')))
    .join(',');

  const n = ds.elements().size;
  const d = ds.indices().size - 1;

  return '<1.1:'+n+(d == 2 ? '' : ' '+d)+':'+sDefs+':'+mDefs+'>';
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
export const size = ds => ds.elements().size;

export const isIndex = (ds, i) => ds.isIndex(i);
export const indices = ds => ds.indices();
export const dim = ds => ds.indices().size - 1;

export const s = (ds, i, D) => ds.s(i, D);
export const v = (ds, i, j, D) => ds.v(i, j, D);
export const m = (ds, i, j, D) => ds.v(i, j, D) * r(ds, i, j, D);

export const withPairings = (ds, i, specs) => ds.withPairings(i, specs);
export const withBranchings = (ds, i, specs) => ds.withBranchings(i, specs);


export const parseSymbols = text => text
  .split('\n')
  .filter(line => !line.match(/^\s*(#.*)?$/))
  .map(parse);


if (require.main == module) {
  const ds = parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>');

  console.log(stringify(ds));
  console.log('' + ds);

  console.log('' + ds.withPairings(1, [[2,1]]));
  console.log('' + ds.withBranchings(0, [[2,3],[1,5]]));
}
