import * as fs from 'fs';

import * as DS         from '../dsymbols/delaney';
import * as properties from '../dsymbols/properties';
import * as derived    from '../dsymbols/derived';

const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text).forEach(function(ds) {
  if (properties.invariant(derived.dual(ds)).equals(properties.invariant(ds)))
    console.log(''+ds);
});
