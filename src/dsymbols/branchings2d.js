import * as generators from '../common/generators';
import * as DS from './delaney';
import * as DS2D from './delaney2d';
import * as props from './properties';

import { rationals } from '../arithmetic/types';
const Q = rationals;


const _loopless = (ds, i, j, D) => DS.orbit2(ds, i, j, D)
  .every(E => ds.s(i, E) != E && ds.s(j, E) != E);


const _openOrbits = ds => {
  const result = [];

  for (const [i, j] of [[0, 1], [1, 2]]) {
    for (const D of DS.orbitReps2(ds, i, j)) {
      if (!ds.v(i, j, D))
        result.push([i, D, DS.r(ds, i, j, D), _loopless(ds, i, j, D)]);
    }
  }

  return result;
};


const _compareMapped = (ds, m) => {
  for (const D of ds.elements()) {
    for (const [i, j] of [[0, 1], [1, 2]]) {
      const d = ds.v(i, j, D) - ds.v(i, j, m.get(D));
      if (d != 0) return d;
    }
  }
  return 0;
};


const _isCanonical = (ds, maps) => maps.every(m => _compareMapped(ds, m) >= 0);


const _newCurvature = (curv, loopless, v) =>
  Q.plus(curv, Q.times(loopless ? 2 : 1, Q.minus(Q.div(1, v), 1)));


export const branchings = (
  ds,
  faceSizesAtLeast = 3,
  vertexDegreesAtLeast = 3,
  curvatureAtLeast = 0,
  spinsToTry = [1, 2, 3, 4, 6]
) => {
  const maps = props.automorphisms(ds);

  const isCandidate = (curv, i, D, r, loopless, v) =>
    Q.cmp(_newCurvature(curv, loopless, v), curvatureAtLeast) >= 0 &&
    r * v >= (i == 0 ? faceSizesAtLeast : vertexDegreesAtLeast);

  return generators.backtracker({
    root: [ds, DS2D.curvature(ds), _openOrbits(ds)],

    extract([ds, curv, unused]) {
      if (unused.length == 0 && _isCanonical(ds, maps))
        return ds;
    },

    children([ds, curv, unused]) {
      if (unused.length) {
        const [i, D, r, loopless] = unused[0]

        return spinsToTry
          .filter(v => isCandidate(curv, i, D, r, loopless, v))
          .map(v => [
            DS.withBranchings(ds, i, [[D, v]]),
            _newCurvature(curv, loopless, v),
            unused.slice(1)
          ]);
      }
    }
  });
}


if (require.main == module) {
  const covers = require('./covers');
  const isIsohedral = ds => DS.orbitReps2(ds, 0, 1).length == 1;

  const ds = DS.parse('<1.1:1:1,1,1:0,0>');

  covers.covers(ds, 12)
    .filter(isIsohedral)
    .filter(DS2D.isProtoEuclidean)
    .flatMap(ds => generators.results(branchings(ds)))
    .filter(DS2D.isEuclidean)
    .filter(props.isMinimal)
    .forEach(ds => console.log(`${ds}`));
}
