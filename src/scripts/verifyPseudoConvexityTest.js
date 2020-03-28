import * as fs from 'fs';

import { rationalMatrices as ops } from '../arithmetic/types';
import * as timing from '../common/timing';
import { finiteUniversalCover } from '../dsymbols/covers';
import { orbitReps2, orbit2 } from '../dsymbols/delaney';
import { makeCover, skeleton, chamberPositions } from '../dsymbols/tilings';
import { isEuclidean, isSpherical, isPseudoConvex } from '../dsymbols/delaney2d';
import symbols from '../io/ds';


const hasNonDegenerateBarycentricPlacement = ds => {
  const cov = makeCover(ds);
  const pos = chamberPositions(cov, skeleton(cov));

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


const isThreeConnectedSpherical = ds => {
  const cov = finiteUniversalCover(ds);
  const vertexRep = [];
  const neighbors = [];

  for (const D of orbitReps2(cov, 1, 2)) {
    neighbors[D] = [];
    for (const E of orbit2(cov, 1, 2, D))
      vertexRep[E] = D;
  }

  for (const D of orbitReps2(cov, 0, 2)) {
    const v = vertexRep[D];
    const w = vertexRep[cov.s(2, cov.s(0, D))];

    if (w == v || neighbors[v].includes(w))
      return false;

    neighbors[v].push(w);
    neighbors[w].push(v);
  }

  const faces = [];
  for (const D of orbitReps2(cov, 0, 1)) {
    const f = [];
    let E = D;
    do {
      E = cov.s(1, cov.s(0, E));
      f.push(vertexRep[E]);
    }
    while (E != D);

    faces.push(f);
  }

  for (const fa of faces) {
    for (const fb of faces) {
      let count = 0;
      for (let k = 0; k < fa.length; ++k) {
        if (!fb.includes(fa[k]) && fb.includes(fa[(k + 1) % fa.length])) {
          ++count;
          if (count > 1)
            return false;
        }
      }
    }
  }

  return true;
};


const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

let count = 0;
const timers = timing.timers();

for (const { symbol: ds } of symbols(text)) {
  const euclidean = isEuclidean(ds);
  const spherical = !euclidean && isSpherical(ds);

  if (euclidean || spherical) {
    count += 1;
    if (count % 100 == 0)
      console.log(`# ${count} symbols checked`);

    try {
      timers.start('claim');
      const claim = isPseudoConvex(ds);
      timers.stop('claim');

      timers.start('verification');
      const verification = (
        euclidean ?
          hasNonDegenerateBarycentricPlacement(ds) :
          isThreeConnectedSpherical(ds)
      );
      timers.stop('verification');

      if (claim != verification)
        console.log(`${ds}`);
    } catch(ex) {
      console.log(ex);
      console.log(`${ds}`);
    }
  }
}

console.log(`${JSON.stringify(timers.current(), null, 2)}`);
