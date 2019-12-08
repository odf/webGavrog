import * as fs from 'fs';

import { parseSymbols } from '../dsymbols/delaney';
import { isPseudoConvex } from '../dsymbols/delaney2d';

const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

for (const ds of parseSymbols(text)) {
  if (isPseudoConvex(ds))
    console.log(`${ds}`);
}
