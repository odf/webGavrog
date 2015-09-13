import * as fs from 'fs';

import * as DS         from '../dsymbols/delaney';
import * as properties from '../dsymbols/properties';

const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text).forEach(function(ds) {
  if (properties.isMinimal(ds))
    console.log(''+ds);
});
