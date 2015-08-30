import * as I  from 'immutable';
import * as DS from './delaney';
import * as p  from './properties';
import * as d  from './derived';
import * as cv from './covers';
import * as Q  from '../arithmetic/number';


const _assert = function _assert(condition, message) {
  if (!condition)
    throw new Error(message || 'assertion error');
};


const _map1dOrbits = function _map1dOrbits(fn, ds) {
  return ds.indices().flatMap(i => (
    ds.indices()
      .filter(j => j > i)
      .flatMap(j => (
        p.orbitReps(ds, [i, j], ds.elements())
          .map(D => fn(i, j, D))
      ))
  ));
};


const _loopless = function _loopless(ds, i, j, D) {
  return p.orbit(ds, [i, j], D)
    .every(E => ds.s(i, E) != E && ds.s(j, E) != E);
};


const _unbranched = ds => _map1dOrbits(ds.v, ds).every(v => v == 1);

const _sum = numbers => numbers.reduce(Q.plus, 0);


export function curvature(ds) {
  _assert(DS.dim(ds) == 2, 'must be two-dimensional');
  _assert(p.isConnected(ds), 'must be connected');

  const orbitContribution = (i, j, D) => (
    Q.div((_loopless(ds, i, j, D) ? 2 : 1), ds.v(i, j, D))
  );

  return Q.minus(_sum(_map1dOrbits(orbitContribution, ds)), DS.size(ds));
};


export function isEuclidean(ds) {
  return Q.cmp(curvature(ds), 0) == 0;
};


export function isHyperbolic(ds) {
  return Q.cmp(curvature(ds), 0) < 0;
};


export function isSpherical(ds) {
  if (Q.cmp(curvature(ds), 0) <= 0)
    return false;

  const dso   = d.orientedCover(ds);
  const cones = _map1dOrbits(dso.v, dso).filter(v => v > 1).toJS();
  const n     = cones.length;

  return n > 2 || (n == 2 && cones[0] == cones[1]);
};


export function orbifoldSymbol(ds) {
  const orbitType = (i, j, D) => (
    { v: ds.v(i, j, D), c: _loopless(ds, i, j, D) }
  );

  const v        = o => o.v;
  const isCone   = o => o.v > 1 && o.c;
  const isCorner = o => o.v > 1 && !o.c;

  const types   = _map1dOrbits(orbitType, ds);
  const cones   = types.filter(isCone).map(v);
  const corners = types.filter(isCorner).map(v);

  const cost = Q.toJS(Q.minus(2, _sum([
    Q.div(curvature(ds), 2),
    _sum(cones.map(v => Q.div(v - 1, v))),
    _sum(corners.map(v => Q.div(v - 1, 2*v))),
    (p.isLoopless(ds) ? 0 : 1)
  ])));

  const sym = I.List().concat(
    cones.sort().reverse(),
    (p.isLoopless(ds) ? [] : ['*']),
    corners.sort().reverse(),
    (p.isWeaklyOriented(ds) ? I.Repeat('o', cost/2) : I.Repeat('x', cost))
  ).join('');

  if (sym == 'x' || sym == '*' || sym == '')
    return '1'+sym;
  else
    return sym;
};


export function toroidalCover(ds) {
  _assert(isEuclidean(ds), 'must be euclidean');

  const dso = d.orientedCover(ds);
  const degree = _map1dOrbits(dso.v, dso).max();

  return cv.covers(dso, degree).filter(_unbranched).first();
};


if (require.main == module) {
  const test = function test(ds) {
    console.log('ds = '+ds);
    console.log('  curvature is '+curvature(ds));
    console.log('  symbol is '+(isEuclidean(ds) ? '' : 'not ')+'euclidean');
    console.log('  symbol is '+(isHyperbolic(ds) ? '' : 'not ')+'hyperbolic');
    console.log('  symbol is '+(isSpherical(ds) ? '' : 'not ')+'spherical');
    console.log('  orbifold symbol = '+orbifoldSymbol(ds));
    if (isEuclidean(ds)) {
      const dst = toroidalCover(ds);
      const curv = curvature(dst);
      const orbs = orbifoldSymbol(dst);

      console.log('  toroidal cover = '+dst);

      if (Q.cmp(curv, 0) == 0 && orbs == 'o')
        console.log('    (curvature and orbifold symbol okay)');
      else
        console.error('    !!!! curvature '+Q.toString(curvature(dst))+
                      ', orbifold symbol '+orbifoldSymbol(dst));
    }
    console.log();
  };

  test(DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(DS.parse('<1.1:1:1,1,1:5,3>'));
  test(DS.parse('<1.1:1:1,1,1:6,3>'));
  test(DS.parse('<1.1:1:1,1,1:7,3>'));
  test(DS.parse('<1.1:2:2,1 2,1 2:2,4 4>'));
  test(DS.parse('<1.1:2:2,1 2,1 2:2,4 5>'));
  test(DS.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(DS.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));
}
