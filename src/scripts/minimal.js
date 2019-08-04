import * as fs from 'fs';

import * as delaney from '../dsymbols/delaney';
import * as derived from '../dsymbols/derived';

const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

for (const ds of delaney.parseSymbols(text))
  console.log(`${derived.minimal(ds)}`);
