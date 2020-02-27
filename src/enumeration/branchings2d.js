import { backtrack } from '../common/iterators';
import * as delaney from '../dsymbols/delaney';
import * as delaney2d from '../dsymbols/delaney2d';
import * as props from '../dsymbols/properties';

import { rationals as opsQ } from '../arithmetic/types';


const isLoopless = (ds, i, j, D) => ds.orbit2(i, j, D)
  .every(E => ds.s(i, E) != E && ds.s(j, E) != E);


const openOrbits = ds => {
  const result = [];

  for (const [i, j] of [[0, 1], [1, 2]]) {
    for (const D of ds.orbitReps2(i, j)) {
      if (!ds.v(i, j, D))
        result.push([i, D, ds.r(i, j, D), isLoopless(ds, i, j, D)]);
    }
  }

  return result;
};


const compareMapped = (ds, m) => {
  for (const D of ds.elements()) {
    for (const [i, j] of [[0, 1], [1, 2]]) {
      const d = ds.v(i, j, D) - ds.v(i, j, m[D]);
      if (d != 0) return d;
    }
  }
  return 0;
};


const isCanonical = (ds, maps) => maps.every(m => compareMapped(ds, m) >= 0);


const newCurvature = (curv, loopless, v) =>
  opsQ.plus(curv, opsQ.times(loopless ? 2 : 1, opsQ.minus(opsQ.div(1, v), 1)));


export const branchings = (
  ds,
  faceSizesAtLeast = 3,
  vertexDegreesAtLeast = 3,
  curvatureAtLeast = 0,
  spinsToTry = [1, 2, 3, 4, 6]
) => {
  const maps = props.automorphisms(ds);

  const isCandidate = (curv, i, D, r, loopless, v) =>
    opsQ.cmp(newCurvature(curv, loopless, v), curvatureAtLeast) >= 0 &&
    r * v >= (i == 0 ? faceSizesAtLeast : vertexDegreesAtLeast);

  return backtrack({
    root: [ds, delaney2d.curvature(ds), openOrbits(ds)],

    extract([ds, curv, unused]) {
      if (unused.length == 0 && isCanonical(ds, maps))
        return ds;
    },

    children([ds, curv, unused]) {
      if (unused.length) {
        const [i, D, r, loopless] = unused[0]

        return spinsToTry
          .filter(v => isCandidate(curv, i, D, r, loopless, v))
          .map(v => [
            delaney.withBranchings(ds, i, [[D, v]]),
            newCurvature(curv, loopless, v),
            unused.slice(1)
          ]);
      }
    }
  });
}
