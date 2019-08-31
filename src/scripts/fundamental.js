import * as fs from 'fs';

import * as delaney from '../dsymbols/delaney';
import * as derived from '../dsymbols/derived';
import * as fundamental from '../dsymbols/fundamental';
import * as properties from '../dsymbols/properties';
import * as simplify from '../dsymbols/simplify';


const makeFundamental = ds => {
  const sub = derived.barycentricSubdivision(ds);

  const dim = delaney.dim(sub);
  const idcs = sub.indices().filter(i => i != dim - 1);

  const marked = {};
  for (const [D, i] of fundamental.innerEdges(sub)) {
    if (i == dim) {
      for (const E of properties.orbit(sub, idcs, D)) {
        marked[E] = true;
      }
    }
  }

  const removed = [];
  for (const D of sub.elements()) {
    if (marked[D])
      removed.push(D);
  }

  return derived.canonical(simplify.collapse(sub, removed, dim));
};


const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

for (const ds of delaney.parseSymbols(text))
  console.log(`${makeFundamental(ds)}`);
