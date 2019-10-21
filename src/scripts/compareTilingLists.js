import * as fs from 'fs';

import * as DS from '../dsymbols/delaney';
import * as props from '../dsymbols/properties';


const listA = DS.parseSymbols(
  fs.readFileSync(process.argv[2], { encoding: 'utf8' })
);

const listB = DS.parseSymbols(
  fs.readFileSync(process.argv[3], { encoding: 'utf8' })
);

const invarsA = listA.map(ds => props.invariant(ds).join(' '));
const invarsB = listB.map(ds => props.invariant(ds).join(' '));


for (let i = 0; i < listA.length; ++i) {
  if (invarsB.indexOf(invarsA[i]) < 0)
    console.log(`- ${i} ${listA[i]}`);
}

for (let i = 0; i < listB.length; ++i) {
  if (invarsA.indexOf(invarsB[i]) < 0)
    console.log(`+ ${i} ${listB[i]}`);
}
