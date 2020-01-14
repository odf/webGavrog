import * as generators from '../common/generators';
import * as timing from '../common/timing';

import * as DS from './delaney';


const timers = timing.timers();


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
  timers && timers.start('make delaney set');

  const dim = 2;
  const size = _size(data);

  const s = new Array((dim + 1) * size).fill(0);

  for (let D = 1; D <= size; ++D) {
    for (let i = 0; i <= dim; ++i)
      s[i * size + D - 1] = _get(data, i, D);
  }

  timers && timers.stop('make delaney set');

  return DS.makeDSet(dim, s);
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
  timers && timers.start('potential children');

  const size = _size(data);
  const limit = Math.min(size + 1, maxSize);
  const undef = _firstUndefined(data);

  const result = [];

  if (undef != null) {
    const [D, i] = undef;

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
  }

  timers && timers.stop('potential children');

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
  timers && timers.start('is canonical');

  let result = true;

  for (let D = 1; D <= _size(data); ++D) {
    if (_compareRenumberedFrom(data, D) < 0) {
      result = false;
      break;
    }
  }

  timers && timers.stop('is canonical');

  return result;
};


export const delaneySets = maxSize => {
  const root = [null, null, null];

  const extract =
    data => _firstUndefined(data) ? null : _makeDelaneySet(data);

  const children =
    data => _potentialChildren(data, maxSize).filter(_isCanonical);

  return generators.backtrack({ extract, root, children });
}


const _withMinimalBranchings = ds => {
  timers && timers.start('minimal branching');

  const s = new Array((ds.dim +1) * ds.size).fill(0);
  const v = new Array(ds.dim * ds.size).fill(0);

  for (let D = 1; D <= ds.size; ++D) {
    for (let i = 0; i <= ds.dim; ++i)
      s[i * ds.size + D - 1] = ds.s(i, D);
  }

  for (let i = 0; i < ds.dim; ++i) {
    const j = i + 1;
    for (const D of DS.orbitReps2(ds, i, j)) {
      const q = Math.ceil(3 / DS.r(ds, i, j, D));
      for (const E of DS.orbit2(ds, i, j, D))
        v[i * ds.size + E - 1] = q;
    }
  }

  const out = DS.makeDSymbol(ds.dim, s, v);

  timers && timers.stop('minimal branching');
  return out;
};


if (require.main == module) {
  timers && timers.start('total');

  const maxDsSize = parseInt(process.argv[2]);

  for (const ds of delaneySets(maxDsSize))
    console.log(`${_withMinimalBranchings(ds)}`);

  timers && timers.stop('total');
  timers && console.log(`${JSON.stringify(timers.current(), null, 2)}`);
}
