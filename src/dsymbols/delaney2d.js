import * as DS from './delaney';
import * as p  from './properties';
import * as d  from './derived';
import * as cv from './covers';

import { rationals } from '../arithmetic/types';
const Q = rationals;


const _assert = (condition, message) => {
  if (!condition)
    throw new Error(message || 'assertion error');
};


const _map1dOrbits = (fn, ds) => {
  const result = [];

  for (const i of ds.indices()) {
    for (const j of ds.indices()) {
      if (j > i) {
        for (const D of DS.orbitReps2(ds, i, j))
          result.push(fn(i, j, D));
      }
    }
  }

  return result;
};


const _loopless = (ds, i, j, D) =>
  DS.orbit2(ds, i, j, D).every(E => ds.s(i, E) != E && ds.s(j, E) != E);


const _unbranched = ds => _map1dOrbits(ds.v.bind(ds), ds).every(v => v == 1);

const _fullyBranched = ds => _map1dOrbits(ds.v.bind(ds), ds).every(v => !!v);

const _sum = numbers => numbers.reduce((a, x) => Q.plus(a, x), 0);


export const curvature = (ds, vDefault = 1) => {
  _assert(DS.dim(ds) == 2, 'must be two-dimensional');
  _assert(p.isConnected(ds), 'must be connected');

  const orbitContribution = (i, j, D) =>
    Q.div((_loopless(ds, i, j, D) ? 2 : 1), (ds.v(i, j, D) || vDefault));

  return Q.minus(_sum(_map1dOrbits(orbitContribution, ds)), DS.size(ds));
};


export const isProtoEuclidean = ds => Q.ge(curvature(ds), 0);
export const isProtoSpherical = ds => Q.gt(curvature(ds), 0);
export const isEuclidean = ds => _fullyBranched(ds) && Q.eq(curvature(ds), 0);
export const isHyperbolic = ds => _fullyBranched(ds) && Q.lt(curvature(ds), 0);


export const isSpherical = ds => {
  if (_fullyBranched(ds) && isProtoSpherical(ds)) {
    const dso = d.orientedCover(ds);
    const cones = _map1dOrbits(dso.v.bind(dso), dso).filter(v => v > 1);

    return (
      cones.length != 1
        && (cones.length != 2 || (cones[0] == cones[1]))
    );
  }
  else
    return false;
};


export const orbifoldSymbol = ds => {
  //TODO correctly handle multiple boundary components

  const orbitType = (i, j, D) => [ds.v(i, j, D), _loopless(ds, i, j, D)];

  const types = _map1dOrbits(orbitType, ds);
  const cones = types.filter(([v, c]) => v > 1 && c).map(([v]) => v);
  const corners = types.filter(([v, c]) => v > 1 && !c).map(([v]) => v);

  const cost = Q.minus(2, _sum([
    Q.div(curvature(ds), 2),
    _sum(cones.map(v => Q.div(v - 1, v))),
    _sum(corners.map(v => Q.div(v - 1, 2*v))),
    (p.isLoopless(ds) ? 0 : 1)
  ]));

  _assert(Q.typeOf(cost) == 'Integer',
          'residual cost should be an integer, got ${cost}');

  const repeat = (c, n) => new Array(n).fill(c);

  const sym = [].concat(
    cones.sort().reverse(),
    (p.isLoopless(ds) ? [] : ['*']),
    corners.sort().reverse(),
    (p.isWeaklyOriented(ds) ? repeat('o', cost/2) : repeat('x', cost))
  ).join('');

  if (sym == 'x' || sym == '*' || sym == '')
    return '1'+sym;
  else
    return sym;
};


export const toroidalCover = ds => {
  _assert(isEuclidean(ds), 'must be euclidean');

  const dso = d.orientedCover(ds);
  const degree = Math.max(..._map1dOrbits(dso.v.bind(dso), dso));

  return cv.covers(dso, degree).filter(_unbranched).first();
};


const _cutsOffDisk = (ds, candidates, branched) => {
  console.log(
    `_cutsOffDisk(${ds}, ${JSON.stringify(candidates)}, ${branched})`
  );
  const pairs = [];
  for (const D of candidates) {
    const E = ds.s(1, D);
    pairs.push([D, D]);
    pairs.push([E, E]);
  }
  const tmp = DS.withPairings(ds, 1, pairs);
  const patch = d.subsymbol(tmp, [0, 1, 2], candidates[0]);
  console.log(`  patch = ${patch}`);

  if (patch.size == candidates.length)
    return false;

  console.log(`  isWeaklyOriented = ${p.isWeaklyOriented(patch)}`);
  if (!p.isWeaklyOriented(patch))
    return false;

  const nrLoops = i => patch.elements().filter(D => ds.s(i, D) == D).length;
  const nrOrbits = (i, j) => DS.orbitReps2(patch, 0, 1).length;

  const nf = patch.size;
  const ne = (3 * nf + nrLoops(0) + nrLoops(1) + nrLoops(2)) / 2;
  const nv = nrOrbits(0, 1) + nrOrbits(0, 2) + nrOrbits(1, 2);
  console.log(`  nf = ${nf}, ne = ${ne}, nv = ${nv}`);

  if (nf - ne + nv != 1)
    return false;

  const orbitType = (i, j, D) => [patch.v(i, j, D), _loopless(patch, i, j, D)];
  const types = _map1dOrbits(orbitType, patch);
  const cones = types.filter(([v, c]) => v > 1 && c).map(([v]) => v);
  console.log(`  cones = ${JSON.stringify(cones)}`);

  return cones.length == 0 || (branched && cones.length == 1 && cones[0] == 2);
};


export const isPseudoConvex = ds => {
  _assert(DS.dim(ds) == 2, 'must be two-dimensional');
  _assert(p.isConnected(ds), 'must be connected');

  ds = d.orientedCover(ds);
  const ori = p.partialOrientation(ds);

  for (const A1 of ds.elements()) {
    if (ori[A1] < 0)
      continue;
    const face1 = p.orbit(ds, [0, 1], A1);
    const vert1 = p.orbit(ds, [1, 2], A1);

    for (const A2 of face1) {
      if (ori[A2] > 0)
        continue;

      if (vert1.indexOf(A2) >= 0) {
        if (_cutsOffDisk(ds, [A1, A2], true))
          return false;
      }

      for (const B2 of p.orbit(ds, [1, 2], A2)) {
        if (ori[B2] < 0 || face1.indexOf(B2) >= 0)
          continue;

        for (const B1 of p.orbit(ds, [0, 1], B2)) {
          if (ori[B1] > 0)
            continue;

          if (vert1.indexOf(B1) >= 0) {
            if (_cutsOffDisk(ds, [A1, A2, B2, B1], false))
              return false;
          }
        }
      }
    }
  }

  return true;
};


if (require.main == module) {
  const test = ds => {
    const is = fn => fn(ds) ? 'is' : 'is not';

    console.log(`ds = ${ds}`);
    console.log(`  curvature is ${curvature(ds)}`);
    console.log(`  symbol ${is(isProtoEuclidean)} proto-euclidean`);
    console.log(`  symbol ${is(isProtoSpherical)} proto-spherical`);
    console.log(`  symbol ${is(isEuclidean)} euclidean`);
    console.log(`  symbol ${is(isHyperbolic)} hyperbolic`);
    console.log(`  symbol ${is(isSpherical)} spherical`);
    console.log(`  symbol ${is(isPseudoConvex)} pseudo-convex`);
    console.log(`  orbifold symbol = ${orbifoldSymbol(ds)}`);

    if (isEuclidean(ds)) {
      const dst = toroidalCover(ds);
      console.log(`  toroidal cover = ${dst}`);

      const curv = curvature(dst);
      const orbs = orbifoldSymbol(dst);

      if (Q.eq(curv, 0) && orbs == 'o')
        console.log('    (curvature and orbifold symbol okay)');
      else
        console.error(`    !!!! curvature ${curv}, orbifold symbol ${orbs}`);
    }
    console.log();
  };

  test(DS.parse('<1.1:3:1 2 3,1 3,2 3:4 0,0>'));
  test(DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,0>'));
  test(DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(DS.parse('<1.1:1:1,1,1:5,3>'));
  test(DS.parse('<1.1:1:1,1,1:6,3>'));
  test(DS.parse('<1.1:1:1,1,1:7,3>'));
  test(DS.parse('<1.1:2:2,1 2,1 2:2,4 4>'));
  test(DS.parse('<1.1:2:2,1 2,1 2:2,4 5>'));
  test(DS.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(DS.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));
  test(DS.parse('<1.1:5:2 4 5,1 2 3 5,3 4 5:8 3,8 3>'));
  test(DS.parse(
    '<1.1:12:1 2 4 6 8 10 12,5 9 7 11 6 12 10,2 3 4 8 7 12 11:3 3 3,3 3 3>'
  ));
}
