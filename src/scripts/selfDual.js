import * as fs from 'fs';

import * as DS         from '../dsymbols/delaney';
import * as properties from '../dsymbols/properties';
import * as derived    from '../dsymbols/derived';

const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

const invariant = ds => I.List(properties.invariant(ds));

DS.parseSymbols(text).forEach(function(ds) {
  if (invariant(derived.dual(ds)).equals(invariant(ds)))
    console.log(''+ds);
});
