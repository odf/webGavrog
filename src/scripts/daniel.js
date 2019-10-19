import * as generators from '../common/generators';

import * as covers from '../dsymbols/covers';
import * as DS from '../dsymbols/delaney';
import * as DS2D from '../dsymbols/delaney2d';
import * as props from '../dsymbols/properties';

import { rationals } from '../arithmetic/types';
const Q = rationals;


const _loopless = (ds, i, j, D) => DS.orbit2(ds, i, j, D)
  .every(E => ds.s(i, E) != E && ds.s(j, E) != E);


const _orbits = ds => {
  const result = [];

  for (const [i, j] of [[0, 1], [1, 2]]) {
    for (const D of DS.orbitReps2(ds, i, j)) {
      result.push([i, D, DS.r(ds, i, j, D), _loopless(ds, i, j, D)]);
    }
  }

  return result;
};


const _openOrbits = ds =>
  _orbits(ds).filter(([i, D, r, loopless]) => !ds.v(i, i+1, D));


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


const _compareMapped = (ds, m) => {
  for (const D of ds.elements()) {
    for (const [i, j] of [[0, 1], [1, 2]]) {
      const d = ds.v(i, j, D) - ds.v(i, j, m[D]);
      if (d != 0) return d;
    }
  }
  return 0;
};


const _isCanonical = (ds, maps) => maps.every(m => _compareMapped(ds, m) >= 0);


const _newCurvature = (curv, loopless, v, vOld) =>
  Q.plus(
    curv,
    Q.times(loopless ? 2 : 1, Q.minus(Q.div(1, v), Q.div(1, vOld)))
  );


const isMinimallyHyperbolic = ds => {
  const curv = DS2D.curvature(ds);
  if (Q.ge(curv, 0))
    return false;

  for (const [i, D, r, loopless] of _orbits(ds)) {
    const v = ds.v(i, i+1, D);

    if (v && v > Math.ceil(3 / r)) {
      const newCurv = _newCurvature(curv, loopless, v-1, v);
      if (Q.lt(newCurv, 0))
        return false;
    }
  }

  return true;
};


const branchings = ds => {
  const unused = _openOrbits(ds);
  const maps = props.automorphisms(ds);
  const ds0 = _withMinimalBranchings(ds);

  return generators.backtracker({
    root: [ds0, DS2D.curvature(ds0), unused],

    extract([ds, curv, unused]) {
      if (
        unused.length == 0
          && _isCanonical(ds, maps)
          && (Q.le(curv, 0) || DS2D.isSpherical(ds))
      )
        return ds;
    },

    children([ds, curv, unused]) {
      if (unused.length) {
        if (Q.lt(curv, 0)) {
          return [[ds, curv, []]];
        }
        else {
          const [i, D, r, loopless] = unused[0];
          const v0 = ds.v(i, i+1, D);
          const out = [];

          for (let v = v0; v <= 7; ++v) {
            const newCurv = _newCurvature(curv, loopless, v, v0);
            const newDs = DS.withBranchings(ds, i, [[D, v]]);

            if (Q.ge(newCurv, 0) || isMinimallyHyperbolic(newDs))
              out.push([ newDs, newCurv, unused.slice(1) ]);

            if (Q.lt(newCurv, 0))
              break;
          }

          return out;
        }
      }
    }
  });
}


if (require.main == module) {
  const maxDsSize = parseInt(process.argv[2]);

  covers.covers(DS.parse('<1.1:1:1,1,1:0,0>'), maxDsSize)
    .flatMap(ds => generators.results(branchings(ds)))
    .forEach(ds => console.log(`${ds}`));
}
