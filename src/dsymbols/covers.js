import { cosetTable, tables } from '../fpgroups/cosets';
import { cover } from './derived';
import { fundamentalGroup } from './fundamental';


const traceWord = (table, start, word) =>
  word.reduce((row, gen) => table[row][gen], start);


export const coverForTable = (ds, table, edgeToWord) => cover(
  ds,
  table.length,
  (sheet, i, D) => traceWord(table, sheet, edgeToWord[D][i] || [])
);


export function* covers(ds, maxDeg) {
  const { nrGenerators, relators, edge2word } = fundamentalGroup(ds);

  for (const table of tables(nrGenerators, relators, maxDeg))
    yield coverForTable(ds, table, edge2word);
};


export const subgroupCover = (ds, subgroupGens) => {
  const { nrGenerators, relators, edgeToWord } = fundamentalGroup(ds);
  const table = cosetTable(nrGenerators, relators, subgroupGens);

  return coverForTable(ds, table, edge2word);
};


export const finiteUniversalCover = ds => subgroupCover(ds, []);


if (require.main == module) {
  const delaney = require('./delaney');
  const n = parseInt(process.argv[2]) || 2;
  const ds = delaney.parse('<1.1:1:1,1,1:4,3>');

  for (const cov of covers(ds, n))
    console.log(`${cov}`);

  console.log(`${finiteUniversalCover(ds)}`);
}
