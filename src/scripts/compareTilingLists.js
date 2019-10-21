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


console.log("Duplicates in first list:");
for (let i = 0; i < listA.length; ++i) {
  const j = invarsA.indexOf(invarsA[i]);
  if (j < i)
    console.log(`#${j+1},#${i+1} ${listA[i]}`);
}
console.log();


console.log("In first list, but not in second:");
for (let i = 0; i < listA.length; ++i) {
  if (invarsB.indexOf(invarsA[i]) < 0)
    console.log(`#${i+1} ${listA[i]}`);
}
console.log();


console.log("Duplicates in second list:");
for (let i = 0; i < listB.length; ++i) {
  const j = invarsB.indexOf(invarsB[i]);
  if (j < i)
    console.log(`#${j+1},#${i+1} ${listB[i]}`);
}
console.log();


console.log("In second list, but not in first:");
for (let i = 0; i < listB.length; ++i) {
  if (invarsA.indexOf(invarsB[i]) < 0)
    console.log(`#${i+1} ${listB[i]}`);
}
