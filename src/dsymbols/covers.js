import * as DS          from './delaney';
import * as fundamental from './fundamental';
import * as derived     from './derived';
import * as cosets      from '../fpgroups/cosets';
import { seq }          from '../common/lazyseq';


export const coverForTable = (ds, table, edgeToWord) =>
  derived.cover(ds, table.length, (k, i, D) => (
    (edgeToWord[D][i] || []).reduce((k, g) => table[k][g], k)));


export const subgroupCover = (ds, subgroupGens) => {
  const fun = fundamental.fundamentalGroup(ds);

  return coverForTable(
    ds,
    cosets.cosetTable(fun.nrGenerators, fun.relators, subgroupGens),
    fun.edge2word);
};


export const finiteUniversalCover = ds => subgroupCover(ds, []);


export function* coversGenerator(ds, maxDeg) {
  const fun = fundamental.fundamentalGroup(ds);

  for (const table of cosets.tables(fun.nrGenerators, fun.relators, maxDeg))
    yield coverForTable(ds, table, fun.edge2word);
};


export const covers = (ds, maxDeg) => seq(coversGenerator(ds, maxDeg));


if (require.main == module) {
  const n = parseInt(process.argv[2]) || 2;
  const ds = DS.parse('<1.1:1:1,1,1:4,3>');

  covers(ds, n).forEach(ds => console.log(`${ds}`));
  console.log(`${finiteUniversalCover(ds)}`);
}
