import * as I from 'immutable';

import { stabilizer } from '../fpgroups/stabilizer';
import { abelianInvariants } from '../fpgroups/invariants';

import * as generators  from '../common/generators';
import * as cosets      from '../fpgroups/cosets';
import * as fundamental from './fundamental';
import * as derived     from './derived';
import * as covers      from './covers';


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


const _degree = (ct, word) => {
  let k = 0;
  for (let i = 1; ; ++i) {
    k = _traceWord(ct, k, word);
    if (k == 0)
      return i;
  }
};


const _flattensAll = (ct, cones) =>
  cones.every(([wd, d]) => _degree(ct, wd) == d);


export const pseudoToroidalCover = ds => {
  ds = derived.orientedCover(ds);

  const fg = fundamental.fundamentalGroup(ds);
  const cones = fg.cones;

  if (cones.some(c => c[1] == 5 || c[1] > 6))
    throw new Error('violates the crystallographic restriction');

  const tableGen = cosets.tables(fg.nrGenerators, fg.relators, 4);
  const subgroups = I.List(generators.results(tableGen));
  const base = subgroups.map(cosets.coreTable);

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

  const good = candidates.find(table => {
    const domain = table.keySeq();
    const stab = stabilizer(
      domain.first(),
      fg.nrGenerators,
      fg.relators,
      domain,
      (...args) => table.getIn(args)
    );
    const inv = abelianInvariants(stab.generators.size, stab.relators);
    return inv.length == 3 && inv.every(x => x == 0);
  });

  if (good)
    return covers.coverForTable(ds, good, fg.edge2word);
};


if (require.main == module) {
  const delaney = require('./delaney');

  const test = ds => {
    console.log('ds = '+ds);
    const cov = pseudoToroidalCover(ds);
    console.log('cov = '+cov);
    console.log();
  }

  test(delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>'));
  test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'));
}
