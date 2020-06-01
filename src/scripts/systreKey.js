import * as fs from 'fs';

import { structures } from '../io/cgd';
import { isConnected, isLocallyStable } from '../pgraphs/periodic';
import { minimalImage, isLadder } from '../pgraphs/symmetries';
import { invariant } from '../pgraphs/invariant';


process.argv.slice(2).forEach(file => {
  const text = fs.readFileSync(file, { encoding: 'utf8' });

  for (const { name, graph } of structures(text)) {
    console.log(name);

    try {
      if (!isConnected(graph))
        console.log(`  Error: net '${name}' is not connected`);
      else if (!isLocallyStable(graph))
        console.log(`  Error: net '${name}' is not locally stable`);
      else if (isLadder(graph))
        console.log(`  Error: net '${name}' is a ladder`);
      else {
        for (const [head, tail, shift] of invariant(minimalImage(graph)))
          console.log(`  ${head} ${tail} ${shift.join(' ')}`);
      }
    } catch(ex) {
      console.log(ex.stack);
    }

    console.log();
  }
});
