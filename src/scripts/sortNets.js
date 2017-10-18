import * as io from '../io/cgd';
import * as pgr from '../pgraphs/periodic';

const fs = require('fs');

Array.prototype.toString = function() {
  return `${this.map(x => x.toString()).join(' ')}`;
};


const graphs = [];

process.argv.slice(2).forEach(file => {
  const text = fs.readFileSync(file, { encoding: 'utf8' });

  for (const { graph, name } of io.structures(text))
    graphs.push({ graph, name });
});

graphs.sort(({graph: g1, name: n1}, {graph: g2, name: n2}) =>
            (pgr.vertices(g1).size - pgr.vertices(g2).size ||
             g1.edges.length - g2.edges.length));

for (const { graph, name } of graphs) {
  console.log('PERIODIC_GRAPH');
  console.log(`  NAME ${name}`);
  console.log('  EDGES');
  for (const e of graph.edges)
    console.log(`    ${e.head} ${e.tail} ${e.shift}`);
  console.log('END');
  console.log();
}
