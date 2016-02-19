import * as I from 'immutable';

import { stabilizer } from '../fpgroups/stabilizer';

import * as util        from '../common/util';
import * as generators  from '../common/generators';
import * as cosets      from '../fpgroups/cosets';
import * as fundamental from './fundamental';
import * as derived     from './derived';
import * as covers      from './covers';

import { intMatrices } from '../arithmeticNew/types';
const ops = intMatrices;

const _coreType = {
   1: 'z1',
   2: 'z2',
   3: 'z3',
   6: 's3',
   8: 'd4',
  12: 'a4',
  24: 's4'
};


const _fullyInvolutive = ct =>
  ct.every(row => row.keySeq().every(g => row.get(g) == row.get(-g)));


const _traceWord = (ct, k, word) => word.reduce((k, g) => ct.getIn([k, g]), k);


const _degree = function _degree(ct, word) {
  let k = 0;
  for (let i = 1; ; ++i) {
    k = _traceWord(ct, k, word);
    if (k == 0)
      return i;
  }
};


const _flattensAll = (ct, cones) =>
  cones.every(([wd, d]) => _degree(ct, wd) == d);


const _isDiagonal = mat => {
  const [nrows, ncols] = ops.shape(mat);
  return (
    I.Range(0, nrows).every(i => (
      I.Range(0, ncols).every(j => (
        i == j || 0 == ops.sgn(mat[i][j]))))));
}


const _gcd = function _gcd(a, b) {
  a = ops.abs(a);
  b = ops.abs(b);

  while (ops.sgn(b) > 0)
    [a, b] = [b, ops.mod(a, b)];

  return a;
};


const _factors = function _factors(xs) {
  return I.List(xs).withMutations(function(xs) {
    I.Range(0, xs.size).forEach(function(i) {
      let a = xs.get(i);
      I.Range(i+1, xs.size).forEach(function(j) {
        const b = xs.get(j);
        const g = _gcd(a, b);
        xs.set(j, ops.sgn(g) == 0 ? 0 : ops.times(ops.idiv(a, g), b));
        a = g;
      });
      xs.set(i, a);
    });
  });
};


const _invariants = function _invariants(nrGens, rels) {
  let mat = cosets.relatorMatrix(nrGens, rels).toJS();

  while (!_isDiagonal(mat)) {
    mat = ops.transposed(ops.triangulation(mat).R);
    mat = ops.transposed(ops.triangulation(mat).R);
  }

  const [nrows, ncols] = ops.shape(mat);
  const d = Math.min(nrows, ncols);
  const diag = I.Range(0, d).map(i => mat[i][i]);
  const factors = _factors(diag)
    .filter(x => ops.cmp(x, 1))
    .sort((a, b) => ops.cmp(a, b));

  return I.Repeat(0, nrGens - d).concat(factors);
};


export function pseudoToroidalCover(ds) {
  const t = util.timer();
  const elapsed = () => `${Math.round(t())} msec`;

  ds = derived.orientedCover(ds);
  console.log(`  ${elapsed()} to compute the oriented cover`);

  const fg = fundamental.fundamentalGroup(ds);
  console.log(`  ${elapsed()} to compute the fundamental group`);
  const cones = fg.cones;

  if (cones.some(c => c[1] == 5 || c[1] > 6))
    throw new Error('violates the crystallographic restriction');

  const subgroupsTimers = util.timers();
  cosets.useTimers(subgroupsTimers);
  const tableGen = cosets.tables(fg.nrGenerators, fg.relators, 4);
  const subgroups = I.List(generators.results(tableGen));
  console.log(`  ${elapsed()} to generate the base subgroups`);
  console.log(`  subgroup generation timing details:`);
  console.log(`${JSON.stringify(subgroupsTimers.current(), null, 2)}`);

  const base = subgroups.map(cosets.coreTable);
  console.log(`  ${elapsed()} to compute the cores`);

  const cType = ct =>
    ct.size == 4 ? (_fullyInvolutive(ct) ? 'v4' : 'z4') : _coreType[ct.size];

  const cores = base
    .filter(ct => _flattensAll(ct, cones))
    .map(ct => [cType(ct), ct]);

  const cones2 = cones.filter(c => c[1] == 2);
  const cones3 = cones.filter(c => c[1] == 3);

  const z2a = base.filter(ct => ct.size == 2 &&  _flattensAll(ct, cones2));
  const z2b = base.filter(ct => ct.size == 2 && !_flattensAll(ct, cones2));
  const z3a = base.filter(ct => ct.size == 3 &&  _flattensAll(ct, cones3));
  const s3a = base.filter(ct => ct.size == 6 &&  _flattensAll(ct, cones3));

  const z6 = z3a.flatMap(a => (
    z2a
      .map(b => cosets.intersectionTable(a, b))
      .filter(ct => ct.size == 6 && _flattensAll(ct, cones))
      .map(ct => ['z6', ct])));

  const d6 = s3a.flatMap(a => (
    z2b
      .map(b => cosets.intersectionTable(a, b))
      .filter(ct => ct.size == 12 && _flattensAll(ct, cones))
      .map(ct => ['d6', ct])));

  const categorized = I.Seq().concat(cores, z6, d6).groupBy(a => a[0]);
  const candidates = I.List('z1 z2 z3 z4 v4 s3 z6 d4 d6 a4 s4'.split(' '))
    .flatMap(type => categorized.get(type) || [])
    .map(([type, table]) => table);

  console.log(`  ${elapsed()} to compile the candidate subgroups list`);

  const stabilizerTimers = util.timers();

  const good = candidates.find(function(table) {
    const domain = table.keySeq();
    const stab = stabilizer(
      domain.first(),
      fg.nrGenerators,
      fg.relators,
      domain,
      (...args) => table.getIn(args),
      stabilizerTimers
    );
    const inv = _invariants(stab.generators.size, stab.relators);
    return inv.map(x => ops.sgn(x)).equals(I.List([0,0,0]));
  });
  console.log(`  ${elapsed()} to check for a good subgroup`);
  console.log(`  stabilizer timing details:`);
  console.log(`${JSON.stringify(stabilizerTimers.current(), null, 2)}`);

  if (good) {
    const result = covers.coverForTable(ds, good, fg.edge2word);
    console.log(`  ${elapsed()} to construct the result D-symbol`);
    return result;
  }
};


if (require.main == module) {
  const delaney = require('./delaney');

  const test = function test(ds) {
    console.log('ds = '+ds);
    const cov = pseudoToroidalCover(ds);
    console.log('cov = '+cov);
    console.log();
  }

  test(delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>'));
  test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'));
}
