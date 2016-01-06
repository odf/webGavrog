import * as I from 'immutable';
import * as generators from '../common/generators';
import * as DS from './delaney';
import * as DS2D from './delaney2d';
import * as props from './properties';
import * as Q  from '../arithmetic/number';


const _loopless = (ds, i, j, D) => props.orbit(ds, [i, j], D)
  .every(E => ds.s(i, E) != E && ds.s(j, E) != E);


const _openOrbits = ds => I.Set(
  I.List([[0,1], [1,2]])
    .flatMap(([i,j]) => (
      DS.orbitReps2(ds, i, j)
        .filter(D => !ds.v(i, j, D))
        .map(D => I.List([i, D, DS.r(ds, i, j, D), _loopless(ds, i, j, D)])))));


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
      if (unused.isEmpty() && _isCanonical(ds, maps))
        return ds;
    },

    children([ds, curv, unused]) {
      if (!unused.isEmpty()) {
        const orb = unused.first();
        const unusedRemaining = unused.remove(orb);
        const [i, D, r, loopless] = orb.toArray();

        return spinsToTry
          .filter(v => isCandidate(curv, i, D, r, loopless, v))
          .map(v => [
            ds.withBranchings(i, [[D, v]]),
            _newCurvature(curv, loopless, v),
            unusedRemaining
          ]);
      }
    }
  });
}


if (require.main == module) {
  const ds = DS.parse('<1.1:1:1,1,1:0,0>');
  generators.results(branchings(ds)).forEach(sym => console.log(`${sym}`));
}
