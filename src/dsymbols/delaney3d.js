import { stabilizer } from '../fpgroups/stabilizer';
import { abelianInvariants } from '../fpgroups/invariants';
import { seq, range } from '../common/lazyseq';

import * as cosets      from '../fpgroups/cosets';
import * as fundamental from './fundamental';
import * as derived     from './derived';
import * as covers      from './covers';


const coreType = {
   1: 'z1',
   2: 'z2',
   3: 'z3',
   6: 's3',
   8: 'd4',
  12: 'a4',
  24: 's4'
};


const fullyInvolutive = ct =>
  ct.every(row => Object.keys(row).every(g => row[g] == row[-g]));

const cType = ct =>
  ct.length == 4 ? (fullyInvolutive(ct) ? 'v4' : 'z4') : coreType[ct.length];


const degree = (ct, word) => {
  let k = 0;
  for (let i = 1; ; ++i) {
    k = word.reduce((k, g) => ct[k][g], k);
    if (k == 0)
      return i;
  }
};


const flattensAll = (ct, cones) =>
  cones.every(([wd, d]) => degree(ct, wd) == d);


export const pseudoToroidalCover = ds => {
  ds = derived.orientedCover(ds);

  const fg = fundamental.fundamentalGroup(ds);
  const cones = fg.cones;

  if (cones.some(c => c[1] == 5 || c[1] > 6))
    throw new Error('violates the crystallographic restriction');

  const tableGen = cosets.tables(fg.nrGenerators, fg.relators, 4);
  const base = seq(tableGen).map(cosets.coreTable);

  const cores = base
    .filter(ct => flattensAll(ct, cones))
    .map(ct => [cType(ct), ct]);

  const cones2 = cones.filter(c => c[1] == 2);
  const cones3 = cones.filter(c => c[1] == 3);

  const z2a = base.filter(ct => ct.length == 2 &&  flattensAll(ct, cones2));
  const z2b = base.filter(ct => ct.length == 2 && !flattensAll(ct, cones2));
  const z3a = base.filter(ct => ct.length == 3 &&  flattensAll(ct, cones3));
  const s3a = base.filter(ct => ct.length == 6 &&  flattensAll(ct, cones3));

  const z6 = z3a.flatMap(
    a => z2a.map(b => cosets.intersectionTable(a, b))
      .filter(ct => ct.length == 6 && flattensAll(ct, cones))
      .map(ct => ['z6', ct]));

  const d6 = s3a.flatMap(
    a => z2b.map(b => cosets.intersectionTable(a, b))
      .filter(ct => ct.length == 12 && flattensAll(ct, cones))
      .map(ct => ['d6', ct]));

  const candidates = cores.append(z6).append(d6);

  for (const type of 'z1 z2 z3 z4 v4 s3 z6 d4 d6 a4 s4'.split(' ')) {
    for (const [t, table] of candidates) {
      if (t == type) {
        const domain = range(0, table.length);
        const stab = stabilizer(
          domain.first(),
          fg.nrGenerators,
          fg.relators,
          domain,
          (p, g) => table[p][g]
        );
        const inv = abelianInvariants(stab.generators.length, stab.relators);

        if (inv.length == 3 && inv.every(x => x == 0))
          return covers.coverForTable(ds, table, fg.edge2word);
      }
    }
  }
};


if (require.main == module) {
  const delaney = require('./delaney');

  const test = ds => {
    console.log(`ds = ${ds}`);
    console.log(`cov = ${pseudoToroidalCover(ds)}`);
    console.log();
  }

  test(delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>'));
  test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'));
}
