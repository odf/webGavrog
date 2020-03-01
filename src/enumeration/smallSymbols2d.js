import { backtrack } from '../common/iterators';
import * as delaney from '../dsymbols/delaney';
import * as props from '../dsymbols/properties';
import * as dsets2d from './dsets2d';
import symbols from '../io/ds';

import { rationals as opsQ } from '../arithmetic/types';


import * as timing from '../common/timing';
const timers = timing.timers();


const _loopless = (ds, i, j, D) => ds.orbit2(i, j, D)
  .every(E => ds.s(i, E) != E && ds.s(j, E) != E);


const _orbits = ds => {
  const result = [];

  for (const [i, j] of [[0, 1], [1, 2]]) {
    for (const D of ds.orbitReps2(i, j)) {
      result.push([i, D, ds.r(i, j, D), _loopless(ds, i, j, D)]);
    }
  }

  return result;
};


const _openOrbits = ds =>
  _orbits(ds).filter(([i, D, r, loopless]) => !ds.v(i, i+1, D));


const _withMinimalBranchings = ds => {
  const s = new Array((ds.dim +1) * ds.size).fill(0);
  const v = new Array(ds.dim * ds.size).fill(0);

  for (let D = 1; D <= ds.size; ++D) {
    for (let i = 0; i <= ds.dim; ++i)
      s[i * ds.size + D - 1] = ds.s(i, D);
  }

  for (let i = 0; i < ds.dim; ++i) {
    const j = i + 1;
    for (const D of ds.orbitReps2(i, j)) {
      const q = Math.ceil(3 / ds.r(i, j, D));
      for (const E of ds.orbit2(i, j, D))
        v[i * ds.size + E - 1] = q;
    }
  }

  return delaney.makeDSymbol(ds.dim, s, v);
};


const _compareMapped = (ds, m) => {
  for (const [i, j] of [[0, 1], [1, 2]]) {
    for (const D of ds.elements()) {
      const d = ds.v(i, j, D) - ds.v(i, j, m[D]);
      if (d != 0) return d;
    }
  }
  return 0;
};


const _isCanonical = (ds, maps) => maps.every(m => _compareMapped(ds, m) >= 0);


const _newCurvature = (curv, loopless, v, vOld) =>
  opsQ.plus(
    curv,
    opsQ.times(loopless ? 2 : 1, opsQ.minus(opsQ.div(1, v), opsQ.div(1, vOld)))
  );


const _isMinimallyHyperbolic = (ds, curv) => {
  if (opsQ.ge(curv, 0))
    return false;

  for (const [i, D, r, loopless] of _orbits(ds)) {
    const v = ds.v(i, i+1, D);

    if (v && v > Math.ceil(3 / r)) {
      const newCurv = _newCurvature(curv, loopless, v-1, v);
      if (opsQ.lt(newCurv, 0))
        return false;
    }
  }

  return true;
};


const _goodResult = (ds, curv) => {
  let good;

  if (opsQ.le(curv, 0))
    good = true;
  else {
    const cones = [];
    const corners = [];
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      for (const D of ds.orbitReps2(i, j)) {
        const v = ds.v(i, j, D);
        if (v > 1) {
          if (_loopless(ds, i, j, D))
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
    const key = front + middle + back + cross;

    const goodKeys = [
      '', '*', 'x',
      '532', '432', '332',
      '422', '322', '222',
      '44', '33', '22',
      '*532', '*432', '*332', '3*2',
      '*422', '*322', '*222', '2*4', '2*3', '2*2',
      '*44', '*33', '*22', '4*', '3*', '2*', '4x', '3x', '2x',
    ];

    good = goodKeys.indexOf(key) >= 0;
  }

  return good;
};


const _morphism = (src, srcD0, img, imgD0) => {
  const idcs = src.indices();

  const q = [[srcD0, imgD0]];
  const m = new Array(src.size + 1);
  m[srcD0] = imgD0;

  while (q.length) {
    const [D, E] = q.shift();

    for (const i of idcs) {
      const Di = src.s(i, D);
      const Ei = img.s(i, E);

      if (Di != null || Ei != null) {
        if (m[Di] == null) {
          q.push([Di, Ei]);
          m[Di] = Ei;
        }
        else if (m[Di] != Ei)
          return null;
      }
    }
  }

  return m;
};


const _automorphisms = ds => {
  const elms = ds.elements();
  if (elms.length) {
    const D = elms[0];
    return elms.map(E => _morphism(ds, D, ds, E)).filter(m => m != null);
  }
};


const _curvature = ds => {
  const denom = 420;
  let numer = -ds.size * denom;
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    for (const D of ds.orbitReps2(i, j)) {
      const k = _loopless(ds, i, j, D) ? 2 : 1;
      numer += k * denom / ds.v(i, j, D);
    }
  }
  const curv = opsQ.div(numer, denom);

  return curv;
};


const branchings = ds => {
  timers && timers.start('branchings.init');
  timers && timers.start('branchings.init.openOrbit');
  const unused = _openOrbits(ds);
  timers && timers.stop('branchings.init.openOrbit');
  timers && timers.start('branchings.init.automorphism');
  const maps = _automorphisms(ds);
  timers && timers.stop('branchings.init.automorphism');
  timers && timers.start('branchings.init.withMinimalBranchings');
  const ds0 = _withMinimalBranchings(ds);
  timers && timers.stop('branchings.init.withMinimalBranchings');
  timers && timers.start('branchings.init.curvature');
  const curv0 = _curvature(ds0);
  timers && timers.stop('branchings.init.curvature');
  timers && timers.stop('branchings.init');

  const root = [ds0, curv0, unused];

  const extract = ([ds, curv, unused]) => {
    if (unused.length == 0) {
      timers && timers.start('branchings.extract');
      const keep = _isCanonical(ds, maps) && _goodResult(ds, curv);
      timers && timers.stop('branchings.extract');
      if (keep)
        return ds;
    }
  };

  const children = ([ds, curv, unused]) => {
    if (unused.length) {
      if (opsQ.lt(curv, 0)) {
        return [[ds, curv, []]];
      }
      else {
        timers && timers.start('branchings.children');
        const [i, D, r, loopless] = unused[0];
        const v0 = ds.v(i, i+1, D);
        const out = [];

        for (let v = v0; v <= 7; ++v) {
          const newCurv = _newCurvature(curv, loopless, v, v0);
          const newDs = delaney.withBranchings(ds, i, [[D, v]]);

          if (opsQ.ge(newCurv, 0) || _isMinimallyHyperbolic(newDs, newCurv))
            out.push([ newDs, newCurv, unused.slice(1) ]);

          if (opsQ.lt(newCurv, 0))
            break;
        }
        timers && timers.stop('branchings.children');

        return out;
      }
    }
  };

  return backtrack({ extract, root, children });
}


if (require.main == module) {
  const arg = process.argv[2];

  timers && timers.start('total');

  if (Number.isInteger(parseInt(arg))) {
    const maxSize = parseInt(arg);
    const ds0 = delaney.parse('<1.1:1:1,1,1:0,0>');

    for (const dset of dsets2d.delaneySets(maxSize)) {
      timers && timers.start('branchings');
      for (const ds of branchings(dset))
        console.log(`${ds}`);
      timers && timers.stop('branchings');
    }
  }
  else {
    for (const ds of branchings([...symbols(arg)][0]))
      console.log(`${ds}`);
  }

  timers && timers.stop('total');
  timers && console.log(`${JSON.stringify(timers.current(), null, 2)}`);
}
