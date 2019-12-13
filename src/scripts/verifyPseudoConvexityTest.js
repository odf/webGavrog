import * as fs from 'fs';

import { rationalMatrices } from '../arithmetic/types';
import { parseSymbols } from '../dsymbols/delaney';
import { isEuclidean, isPseudoConvex } from '../dsymbols/delaney2d';
import { makeCover, skeleton, chamberPositions } from '../dsymbols/tilings';


const hasNonDegenerateBarycentricPlacement = ds => {
  const ops = rationalMatrices;
  const cov = makeCover(ds);
  const skel = skeleton(cov);
  const pos = chamberPositions(cov, skel);

  for (const D of cov.elements()) {
    const t = pos[D];
    const M = [ops.minus(t[1], t[0]), ops.minus(t[2], t[0])];
    const det = ops.minus(
      ops.times(M[0][0], M[1][1]),
      ops.times(M[0][1], M[1][0])
    );

    if (ops.eq(det, 0))
      return false;
  }

  return true;
};


const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

let count = 0;

for (const ds of parseSymbols(text)) {
  if (isEuclidean(ds)) {
    count += 1;
    if (count % 100 == 0)
      console.log(`# ${count} symbols checked`);

    const claim = isPseudoConvex(ds);
    const verification = hasNonDegenerateBarycentricPlacement(ds);

    if (claim != verification)
      console.log(`${ds}`);
  }
}
