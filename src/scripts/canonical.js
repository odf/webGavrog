import * as fs from 'fs';

import * as DS      from '../dsymbols/delaney';
import * as derived from '../dsymbols/derived';
import * as props   from '../dsymbols/properties';


const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text)
  .map(ds => [derived.canonical(ds), props.invariant(ds)])
  .sort(function(a, b) {
    if (DS.dim(a[0]) != DS.dim(b[0]))
      return DS.dim(a[0]) - DS.dim(b[0]);
    if (DS.size(a[0]) != DS.size(b[0]))
      return DS.size(a[0]) - DS.size(b[0]);
    const ia = a[1];
    const ib = b[1];
    for (let i = 0; i < ia.size && i < ib.size; ++i)
      if (ia.get(i) != ib.get(i))
        return ia.get(i) - ib.get(i);
    return ia.size() - ib.size();
  })
  .forEach(e => console.log(`${e[0]}`));
