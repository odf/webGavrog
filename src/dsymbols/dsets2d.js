import * as generators from '../common/generators';

import * as derived from './derived';
import * as DS from './delaney';


const _firstUndefined = data => {
  const i = data.indexOf(null);
  if (i >= 0)
    return [Math.floor(i / 3) + 1, i % 3];
};


const _size = data => data.length / 3;


const _get = (data, i, D) => data[(D - 1) * 3 + i];


const _set = (data, i, D, E) => {
  data[(D - 1) * 3 + i] = E;
  data[(E - 1) * 3 + i] = D;
};


const _makeDelaneySet = data => {
  const dim = 2;
  const size = _size(data);
  const ops = new Array(dim + 1).fill(0).map(_ => []);
  const brs = new Array(dim).fill(0).map(_ => []);

  for (let D = 1; D <= size; ++D) {
    for (let i = 0; i <= 2; ++i)
      ops[i].push([D, _get(data, i, D)]);
  }
  return DS.build(dim, size, (_, i) => ops[i], (_, i) => brs[i]);
};


const _scan = (data, w, D, limit) => {
  let [E, k] = [D, 0];

  while (k < limit && _get(data, w[k], E) != null)
    [E, k] = [_get(data, w[k], E), k + 1];

  return [E, k];
};


const _scan02Orbit = (data, D) => {
  const [head, i] = _scan(data, [0, 2, 0, 2], D, 4);
  const [tail, j] = _scan(data, [2, 0, 2, 0], D, 4 - i);
  const gap = 4 - i - j;
  return [head, tail, gap, 2 * (i % 2)];
};


const _potentialChildren = (data, maxSize) => {
  const size = _size(data);
  const limit = Math.min(size + 1, maxSize);
  const undef = _firstUndefined(data);

  if (undef == null)
    return [];

  const [D, i] = undef;
  const result = [];

  for (let E = D; E <= limit; ++E) {
    if (E > size)
      data = data.concat([null, null, null]);

    if (_get(data, i, E) == null) {
      const out = data.slice();
      _set(out, i, D, E);

      const [head, tail, gap, k] = _scan02Orbit(out, D);

      if (gap == 1) {
        _set(out, k, head, tail);
        result.push(out);
      }
      else if (gap > 0 || head == tail)
        result.push(out);
    }
  }

  return result;
};


const _compareRenumberedFrom = (data, D0) => {
  const n2o = [ null, D0];
  const o2n = { [D0]: 1 };

  for (let D = 1; D <= _size(data); ++D) {
    if (D >= n2o.length)
      throw new Error("symbol is not transitive");

    for (const i of [0, 1, 2]) {
      const E = _get(data, i, n2o[D]);
      if (E != null && o2n[E] == null) {
        o2n[E] = n2o.length;
        n2o.push(E);
      }

      const nval = o2n[E];
      const oval = _get(data, i, D);
      if (oval != nval)
        return oval == null ? -1 : nval == null ? 1 : nval - oval;
    }
  }

  return 0;
};


const _isCanonical = data => {
  for (let D = 1; D <= _size(data); ++D) {
    if (_compareRenumberedFrom(data, D) < 0)
      return false;
  }
  return true;
};


const delaneySets = maxSize => {
  return generators.backtracker({
    root: [null, null, null],

    extract(data) {
      return _firstUndefined(data) ? null : _makeDelaneySet(data);
    },

    children(data) {
      return _potentialChildren(data, maxSize).filter(_isCanonical);
    }
  });
}


const _withMinimalBranchings = ds => {
  const branchings = (i, j) =>
    DS.orbitReps2(ds, i, j)
    .filter(D => !ds.v(i, j, D))
    .map(D => [D, Math.ceil(3 / DS.r(ds, i, j, D))]);

  return DS.withBranchings(
    DS.withBranchings(ds, 0, branchings(0, 1)),
    1,
    branchings(1, 2)
  );
};


if (require.main == module) {
  const maxDsSize = parseInt(process.argv[2]);

  for (const ds of generators.results(delaneySets(maxDsSize)))
    console.log(`${derived.canonical(_withMinimalBranchings(ds))}`);
}
