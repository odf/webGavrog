import * as I  from 'immutable';

import { build }   from './delaney';
import { minimal } from './derived';


export function fromCyclicAdjencencies(adjs) {
  const v2ch = I.Map().asMutable();
  const e2ch = I.Map().asMutable();

  let nextch = 1;
  let ne = 0;

  for (const [v, a] of adjs) {
    v2ch.set(v, nextch);

    for (const w of a) {
      if (w == v)
        throw new Error(`found a loop at vertex ${v}`);
      if (w > v)
        ++ne;
      e2ch.set(I.List([v, w]), nextch);
      nextch += 2;
    }
  }

  const size = 4 * ne;
  const op = [ [], [], [] ];

  e2ch.forEach((D, [v, w]) => {
    const E = e2ch.get(I.List([w, v]));
    if (E == null)
      console.warn(`missing ${v} in adjacencies for ${w}`);
    op[0].push([D, E+1]);
  });

  for (const [v, a] of adjs) {
    const d = 2 * a.length;
    const D = v2ch.get(v);
    for (let i = 1; i < d; i += 2)
      op[1].push([D+i, D + (i+1)%d]);
  }

  for (let D = 1; D < size; D += 2)
    op[2].push([D, D+1]);

  return build(
    2, size,
    (_, i) => op[i],
    (_, i) => I.Range(1, size+1).map(D => [D, 1])
  );
};


if (require.main == module) {
  const test = adjs => {
    const ds = fromCyclicAdjencencies(adjs);
    console.log(`${ds}`);
    console.log(`${minimal(ds)}`);
  };


  // Regular tetrahedron:

  test([
    [1, [2, 3, 4]],
    [2, [1, 4, 3]],
    [3, [1, 2, 4]],
    [4, [1, 3, 2]]
  ]);

  // Klein graph (according to S. Hyde):

  test([
    [ 0, [ 1,  2,  3,  4,  5,  6,  7]],
    [ 1, [ 0,  7, 21, 18, 15,  8,  2]],
    [ 2, [ 0,  1,  8,  9, 10, 11,  3]],
    [ 3, [ 0,  2, 11, 12, 13, 14,  4]],
    [ 4, [ 0,  3, 14, 15, 16, 17,  5]],
    [ 5, [ 0,  4, 17, 10, 18, 19,  6]],
    [ 6, [ 0,  5, 19, 13,  9, 20,  7]],
    [ 7, [ 0,  6, 20, 16, 12, 21,  1]],
    [ 8, [ 1, 15, 14, 23, 20,  9,  2]],
    [ 9, [ 2,  8, 20,  6, 13, 22, 10]],
    [10, [ 2,  9, 22, 18,  5, 17, 11]],
    [11, [ 2, 10, 17, 23, 21, 12,  3]],
    [12, [ 3, 11, 21,  7, 16, 22, 13]],
    [13, [ 3, 12, 22,  9,  6, 19, 14]],
    [14, [ 3, 13, 19, 23,  8, 15,  4]],
    [15, [ 4, 14,  8,  1, 18, 22, 16]],
    [16, [ 4, 15, 22, 12,  7, 20, 17]],
    [17, [ 4, 16, 20, 23, 11, 10,  5]],
    [18, [ 5, 10, 22, 15,  1, 21, 19]],
    [19, [ 5, 18, 21, 23, 14, 13,  6]],
    [20, [ 6,  9,  8, 23, 17, 16,  7]],
    [21, [ 1,  7, 12, 11, 23, 19, 18]],
    [22, [ 9, 13, 12, 16, 15, 18, 10]],
    [23, [ 8, 14, 19, 21, 11, 17, 20]]
  ]);
}
