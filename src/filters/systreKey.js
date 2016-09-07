import * as io from '../io/cgd';
import * as inv from '../pgraphs/invariant';


const fs = require('fs');

Array.prototype.toString = function() {
  return `${this.map(x => x.toString()).join(' ')}`;
};


process.argv.slice(2).forEach(file => {
  const text = fs.readFileSync(file, { encoding: 'utf8' });

  for (const b of io.structures(text)) {
    console.log(b.name);

    try {
      const key = inv.invariant(b.graph);
      for (const [head, tail, shift] of key) {
        console.log(`  ${head} ${tail} ${shift}`);
      }
    } catch(ex) {
      console.log(ex.stack);
    }
    console.log();
  }
});
