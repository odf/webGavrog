import * as fs from 'fs';

import { structures } from '../io/cgd';
import { vertices, coordinationSeq } from '../pgraphs/periodic';
import { minimalImage } from '../pgraphs/symmetries';


const pad = (x, n) => x.toString().padStart(n);


for (const name of process.argv.slice(2)) {
  const data = fs.readFileSync(name, { encoding: 'utf8' });

  for (const input of structures(data)) {
    console.log();
    console.log(`## ${input.name || '-'}`);

    const G = minimalImage(input.graph);

    let s = 1;
    let k = 0;
    for (const x of coordinationSeq(G, vertices(G)[0], 100)) {
      s += x;
      k += 1;
      console.log(`${pad(k, 4)}  ${pad(x, 8)}  ${pad(s, 10)}  ` +
                  (s / (k * k * k)).toFixed(4).padStart(8));
    }
  }
}
