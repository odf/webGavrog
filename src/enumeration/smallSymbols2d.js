import { backtrack } from '../common/iterators';
import * as delaney from '../dsymbols/delaney';
import * as props from '../dsymbols/properties';
import * as dsets2d from './dsets2d';
import symbols from '../io/ds';

import { rationals as opsQ } from '../arithmetic/types';


const isLoopless = (ds, i, j, D) =>
  ds.orbit2(i, j, D).every(E => ds.s(i, E) != E && ds.s(j, E) != E);


const orbits = ds => {
  const result = [];

  for (const [i, j] of [[0, 1], [1, 2]]) {
    for (const D of ds.orbitReps2(i, j))
      result.push([i, D, ds.r(i, j, D), isLoopless(ds, i, j, D)]);
  }

  return result;
};


const openOrbits = ds =>
  orbits(ds).filter(([i, D, r, loopless]) => !ds.v(i, i+1, D));


const compareMapped = (ds, m) => {
  for (const [i, j] of [[0, 1], [1, 2]]) {
    for (const D of ds.elements()) {
      const d = ds.v(i, j, D) - ds.v(i, j, m[D]);
      if (d != 0) return d;
    }
  }
  return 0;
};


const isCanonical = (ds, maps) => maps.every(m => compareMapped(ds, m) >= 0);


const newCurvature = (curv, loopless, v, vOld) =>
  opsQ.plus(
    curv,
    opsQ.times(loopless ? 2 : 1, opsQ.minus(opsQ.div(1, v), opsQ.div(1, vOld)))
  );


const withBranching = (ds, i, D, v) => {
  const orb = ds.orbit2(i, i+1, D);
  const getV = (j, E) => j == i && orb.includes(E) ? v : ds.v(j, j+1, E);

  return delaney.buildDSymbol({ getV }, ds);
};


const isMinimallyHyperbolic = (ds, curv) => {
  if (opsQ.sgn(curv) >= 0)
    return false;

  for (const [i, D, r, type] of orbits(ds)) {
    const v = ds.v(i, i+1, D);

    if ((v - 1) * r >= 3 && opsQ.sgn(newCurvature(curv, type, v-1, v)) < 0)
      return false;
  }

  return true;
};


const allowedSphericalOrbifolds = [
  '', '*', 'x',
  '532', '432', '332',
  '422', '322', '222',
  '44', '33', '22',
  '*532', '*432', '*332', '3*2',
  '*422', '*322', '*222', '2*4', '2*3', '2*2',
  '*44', '*33', '*22', '4*', '3*', '2*', '4x', '3x', '2x',
];


const goodResult = (ds, curv) => {
  if (opsQ.sgn(curv) <= 0)
    return true;
  else {
    const cones = [];
    const corners = [];
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      for (const D of ds.orbitReps2(i, j)) {
        const v = ds.v(i, j, D);
        if (v > 1) {
          if (isLoopless(ds, i, j, D))
            cones.push(v);
          else
            corners.push(v);
        }
      }
    }
    const front = cones.sort().reverse().join('');
    const middle = props.isLoopless(ds) ? '' : '*';
    const back = corners.sort().reverse().join('');
    const cross = props.isWeaklyOriented(ds) ? '' : 'x';

    return allowedSphericalOrbifolds.includes(front + middle + back + cross);
  }
};


const morphism = (src, img, srcD0, imgD0) => {
  const src2img = new Array(src.size + 1);
  const queue = [[srcD0, imgD0]];

  while (queue.length) {
    const [D, E] = queue.shift();

    if (src2img[D] == E)
      continue;
    else if (src2img[D] != null)
      return null;
    else if (D != null) {
      src2img[D] = E;

      for (let i = 0; i <= src.dim; ++i)
        queue.push([src.s(i, D), img.s(i, E)]);
    }
  }

  return src2img;
};


const automorphisms = ds => {
  const result = [];

  for (let D = 1; D <= ds.size; ++D) {
    const phi = morphism(ds, ds, 1, D);
    if (phi != null)
      result.push(phi);
  }

  return result;
};


const curvature = ds => {
  const denom = 420;
  let numer = -ds.size * denom;
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    for (const D of ds.orbitReps2(i, j)) {
      const k = isLoopless(ds, i, j, D) ? 2 : 1;
      numer += k * denom / ds.v(i, j, D);
    }
  }
  const curv = opsQ.div(numer, denom);

  return curv;
};


const withMinimalBranchings = ds => {
  const v = new Array(ds.dim * ds.size + 1).fill(0);

  for (let i = 0; i < ds.dim; ++i) {
    const j = i + 1;
    for (const D of ds.orbitReps2(i, j)) {
      const q = Math.ceil(3 / ds.r(i, j, D));
      for (const E of ds.orbit2(i, j, D))
        v[i * ds.size + E] = q;
    }
  }

  return delaney.buildDSymbol({ getV: (i, D) => v[i * ds.size + D] }, ds);
};


const branchings = ds => {
  const unused = openOrbits(ds);
  const maps = automorphisms(ds);
  const ds0 = withMinimalBranchings(ds);
  const curv0 = curvature(ds0);

  return backtrack({
    root: [ds0, curv0, unused],

    extract([ds, curv, unused]) {
      if (unused.length == 0 && isCanonical(ds, maps) && goodResult(ds, curv))
        return ds;
    },

    children([ds, curv, unused]) {
      if (unused.length) {
        if (opsQ.sgn(curv) < 0)
          return [[ds, curv, []]];
        else {
          const [i, D, r, loopless] = unused[0];
          const v0 = ds.v(i, i+1, D);
          const out = [];

          for (let v = v0; v <= 7; ++v) {
            const newCurv = newCurvature(curv, loopless, v, v0);
            const newDs = withBranching(ds, i, D, v);

            if (opsQ.sgn(newCurv) >= 0 || isMinimallyHyperbolic(newDs, newCurv))
              out.push([ newDs, newCurv, unused.slice(1) ]);

            if (opsQ.sgn(newCurv) < 0)
              break;
          }

          return out;
        }
      }
    }
  });
}


if (require.main == module) {
  const arg = process.argv[2];

  if (Number.isInteger(parseInt(arg))) {
    const maxSize = parseInt(arg);
    const ds0 = delaney.parse('<1.1:1:1,1,1:0,0>');

    for (const dset of dsets2d.delaneySets(maxSize)) {
      for (const ds of branchings(dset))
        console.log(`${ds}`);
    }
  }
  else {
    for (const ds of branchings([...symbols(arg)][0]))
      console.log(`${ds}`);
  }
}
