import { backtrack } from '../common/iterators';
import * as delaney from '../dsymbols/delaney';


const getSize = data => data.length / 3;
const get = (data, i, D) => data[(D - 1) * 3 + i];


const set = (data, i, D, E) => {
  data[(D - 1) * 3 + i] = E;
  data[(E - 1) * 3 + i] = D;
};


const firstUndefined = data => {
  const i = data.indexOf(null);
  if (i >= 0)
    return [Math.floor(i / 3) + 1, i % 3];
};


const makeDelaneySet = data => delaney.buildDSet({
  dim: 2,
  size: getSize(data),
  getS: (i, D) => get(data, i, D)
});


const scan = (data, w, D, limit) => {
  let [E, k] = [D, 0];

  while (k < limit && get(data, w[k], E) != null)
    [E, k] = [get(data, w[k], E), k + 1];

  return [E, k];
};


const scan02Orbit = (data, D) => {
  const [head, i] = scan(data, [0, 2, 0, 2], D, 4);
  const [tail, j] = scan(data, [2, 0, 2, 0], D, 4 - i);
  const gap = 4 - i - j;
  return [head, tail, gap, 2 * (i % 2)];
};


const potentialChildren = (data, maxSize) => {
  const size = getSize(data);
  const limit = Math.min(size + 1, maxSize);
  const [D, i] = firstUndefined(data) || [];

  const result = [];

  if (D != null) {
    for (let E = D; E <= limit; ++E) {
      if (get(data, i, E) == null) {
        const out = E > size ? data.concat([null, null, null]) : data.slice();
        set(out, i, D, E);

        const [head, tail, gap, k] = scan02Orbit(out, D);

        if (gap == 1)
          set(out, k, head, tail);

        if (gap > 0 || head == tail)
          result.push(out);
      }
    }
  }

  return result;
};


const compareRenumberedFrom = (data, D0) => {
  const n2o = [ null, D0];
  const o2n = { [D0]: 1 };

  for (let D = 1; D <= getSize(data); ++D) {
    if (D >= n2o.length)
      throw new Error("symbol is not transitive");

    for (const i of [0, 1, 2]) {
      const E = get(data, i, n2o[D]);
      if (E != null && o2n[E] == null) {
        o2n[E] = n2o.length;
        n2o.push(E);
      }

      const nval = o2n[E];
      const oval = get(data, i, D);
      if (oval != nval)
        return oval == null ? -1 : nval == null ? 1 : nval - oval;
    }
  }

  return 0;
};


const isCanonical = data => {
  for (let D = 1; D <= getSize(data); ++D) {
    if (compareRenumberedFrom(data, D) < 0)
      return false;
  }

  return true;
};


export const delaneySets = maxSize => backtrack({
  root: [null, null, null],

  extract(data) {
    return firstUndefined(data) ? null : makeDelaneySet(data);
  },

  children(data) {
    return potentialChildren(data, maxSize).filter(isCanonical);
  }
});
