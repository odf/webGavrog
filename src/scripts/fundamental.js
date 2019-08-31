import * as fs from 'fs';

import * as delaney from '../dsymbols/delaney';
import * as derived from '../dsymbols/derived';
import * as fundamental from '../dsymbols/fundamental';
import * as properties from '../dsymbols/properties';
import * as simplify from '../dsymbols/simplify';


const makeFundamental = ds => (
  derived.canonical(simplify.simplify(derived.barycentricSubdivision(ds)))
);


const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

for (const ds of delaney.parseSymbols(text))
  console.log(`${makeFundamental(ds)}`);
