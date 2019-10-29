import * as generators from '../common/generators';
import * as cosets from '../fpgroups/cosets';
import * as util from '../common/util';

import * as covers from '../dsymbols/covers';
import * as DS from '../dsymbols/delaney';
import * as DS2D from '../dsymbols/delaney2d';
import * as fundamental from '../dsymbols/fundamental';
import * as props from '../dsymbols/properties';

import { rationals } from '../arithmetic/types';
const Q = rationals;


const timers = util.timers();


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


const _isMinimallyHyperbolic = (ds, curv) => {
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


const _goodResult = (ds, curv) => {
  let good;

  if (Q.le(curv, 0))
    good = true;
  else {
    const cones = [];
    const corners = [];
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      for (const D of DS.orbitReps2(ds, i, j)) {
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
      // TODO the following are only allowed for backwards compatibility
      //'722', '622', '522',
      //'*722', '*622', '*522',
      //'7*', '6*', '5*', '7x', '6x', '5x'
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
  timers && timers.start('curvature');
  const denom = 420;
  let numer = -DS.size(ds) * denom;
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    for (const D of DS.orbitReps2(ds, i, j)) {
      const k = _loopless(ds, i, j, D) ? 2 : 1;
      numer += k * denom / ds.v(i, j, D);
    }
  }
  const curv = Q.div(numer, denom);
  timers && timers.stop('curvature');
  return curv;
};


const branchings = ds => {
  timers && timers.start('branchings.init');
  const unused = _openOrbits(ds);
  const maps = _automorphisms(ds);
  const ds0 = _withMinimalBranchings(ds);
  const curv0 = _curvature(ds0);
  timers && timers.stop('branchings.init');

  return generators.backtracker({
    root: [ds0, curv0, unused],

    extract([ds, curv, unused]) {
      if (unused.length == 0) {
        timers && timers.start('branchings.extract');
        const keep = _isCanonical(ds, maps) && _goodResult(ds, curv);
        timers && timers.stop('branchings.extract');
        if (keep)
          return ds;
      }
    },

    children([ds, curv, unused]) {
      if (unused.length) {
        if (Q.lt(curv, 0)) {
          return [[ds, curv, []]];
        }
        else {
          timers && timers.start('branchings.children');
          const [i, D, r, loopless] = unused[0];
          const v0 = ds.v(i, i+1, D);
          const out = [];

          for (let v = v0; v <= 7; ++v) {
            const newCurv = _newCurvature(curv, loopless, v, v0);
            const newDs = DS.withBranchings(ds, i, [[D, v]]);

            if (Q.ge(newCurv, 0) || _isMinimallyHyperbolic(newDs, newCurv))
              out.push([ newDs, newCurv, unused.slice(1) ]);

            if (Q.lt(newCurv, 0))
              break;
          }
          timers && timers.stop('branchings.children');

          return out;
        }
      }
    }
  });
}


const delaneySets = maxSize => {
  const _firstUndefined = data => {
    const i = data.indexOf(null);
    if (i >= 0)
      return [Math.floor(i / 3) + 1, i % 3];
  };

  const _get = (data, i, D) => data[(D - 1) * 3 + i];

  const _set = (data, i, D, E) => {
    data[(D - 1) * 3 + i] = E;
    data[(E - 1) * 3 + i] = D;
  };

  const _makeDelaneySet = data => {
    const dim = 2;
    const size = data.length / 3;
    const ops = new Array(dim + 1).fill(0).map(_ => []);
    const brs = new Array(dim).fill(0).map(_ => []);

    for (let D = 1; D <= size; ++D) {
      for (let i = 0; i <= 2; ++i)
        brs[i].push([D, _get(data, i, D)]);
    }
    return DS.build(dim, size, (_, i) => ops[i], (_, i) => brs[i]);
  };

  const _close02Orbit = (data, D) => {
  };

  const _potentialChildren = (data, maxSize) => {
    const size = data.length / 3;
    const limit = Math.min(size + 1, maxSize);
    const [D, i] = _firstUndefined(data);
    const result = [];

    for (const E of range(D, limit)) {
      if (E > size)
        data = data.concat([null, null, null]);

      if (_get(data, E, i) == null) {
        out = data.slice();
        _set(out, i, D, E);
        _close02Orbits(out, D);
        result.push(out);
      }
    }

    return result;
  };

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


function* coversGenerator(ds, maxDeg) {
  timers && timers.start('covers');
  const fun = fundamental.fundamentalGroup(ds);
  const tableGenerator = cosets.tables(fun.nrGenerators, fun.relators, maxDeg);
  const iter = generators.results(tableGenerator);
  timers && timers.stop('covers');

  while (true) {
    timers && timers.start('covers');
    timers && timers.start('covers.generator');
    const result = iter.next();
    timers && timers.stop('covers.generator');
    timers && timers.stop('covers');

    if (result.done)
      break;

    timers && timers.start('covers');
    timers && timers.start('covers.convert');
    const cover = covers.coverForTable(ds, result.value, fun.edge2word);
    timers && timers.stop('covers.convert');
    timers && timers.stop('covers');

    yield cover;
  }
};


if (require.main == module) {
  const arg = process.argv[2];

  timers && timers.start('total');

  if (Number.isInteger(parseInt(arg))) {
    const ds0 = DS.parse('<1.1:1:1,1,1:0,0>');

    for (const dset of coversGenerator(ds0, parseInt(arg))) {
      timers && timers.start('branchings');
      for (const ds of generators.results(branchings(dset)))
        console.log(`${ds}`);
      timers && timers.stop('branchings');
    }
  }
  else {
    for (const ds of generators.results(branchings(DS.parseSymbols(arg)[0])))
      console.log(`${ds}`);
  }

  timers && timers.stop('total');
  timers && console.log(`${JSON.stringify(timers.current(), null, 2)}`);
}
