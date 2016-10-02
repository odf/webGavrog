import * as fs from 'fs';

import * as DS      from '../dsymbols/delaney';
import * as derived from '../dsymbols/derived';

const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text).forEach(ds => console.log(`${derived.dual(ds)}`));
