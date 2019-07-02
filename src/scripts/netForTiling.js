import * as fs from 'fs';

import parseDSymbols from '../io/ds';
import * as tilings  from '../dsymbols/tilings';


const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

for (const item of parseDSymbols(text)) {
  const graph = tilings.skeleton(tilings.makeCover(item.symbol)).graph;

  console.log('PERIODIC_GRAPH');
  console.log(`  NAME ${item.name}`);
  console.log('  EDGES');
  for (const e of graph.edges)
    console.log(`    ${e.head} ${e.tail} ${e.shift.join(' ')}`);
  console.log('END');
  console.log();
}
