import * as io from '../io/cgd';
import * as pgr from '../pgraphs/periodic';

const fs = require('fs');

Array.prototype.toString = function() {
  return `${this.map(x => x.toString()).join(' ')}`;
};

pgr.useModularSolver(true);


process.argv.slice(2).forEach(file => {
  const text = fs.readFileSync(file, { encoding: 'utf8' });

  for (const { graph, name } of io.structures(text)) {
    console.log(name);
    const pos = pgr.barycentricPlacement(graph);
    for (const v of pgr.vertices(graph).sort((v, w) => v - w))
      console.log(`  ${v} ${pos.get(v)}`);
    console.log();
  }
});
