import * as fs from 'fs';

import { rationalMatrices } from '../arithmetic/types';
import { finiteUniversalCover } from '../dsymbols/covers';
import { orbitReps2, orbit2, parseSymbols } from '../dsymbols/delaney';
import { makeCover, skeleton, chamberPositions } from '../dsymbols/tilings';
import { isEuclidean, isSpherical, isPseudoConvex } from '../dsymbols/delaney2d';


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


const isThreeConnectedSpherical = ds => {
  const cov = finiteUniversalCover(ds);
  const vertexReps = orbitReps2(cov, 1, 2);
  const vertexNumber = Array(cov.size + 1);

  for (let i = 0; i < vertexReps.length; ++i) {
    for (const D of orbit2(cov, 1, 2, vertexReps[i])) {
      vertexNumber[D] = i;
    }
  }

  const neigbors = Array(vertexReps.length).fill(0).map(() => []);

  for (const D of orbitReps2(cov, 0, 2)) {
    const E = cov.s(2, cov.s(0, D));
    const v = vertexNumber[D];
    const w = vertexNumber[E];

    if (w == v || neigbors[v].includes(w))
      return false;

    neigbors[v].push(w);
    neigbors[w].push(v);
  }

  const faces = [];
  for (const D of orbitReps2(cov, 0, 1)) {
    const f = [];

    let E = D;
    do {
      E = cov.s(1, cov.s(0, E));
      f.push(vertexNumber[E]);
    }
    while (E != D);

    faces.push(f);
  }

  const badFaceIntersection = (i, j) => {
    const matches = faces[i].map(v => faces[j].includes(v));
    matches.push(matches[0]);
    return matches.filter((x, k) => !x && matches[k + 1]).length > 1;
  };

  for (let i = 0; i < faces.length; ++i) {
    for (let j = i + 1; j < faces.length; ++j) {
      if (badFaceIntersection(i, j) || badFaceIntersection(j, i))
        return false;
    }
  }

  return true;
};


const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

let count = 0;

for (const ds of parseSymbols(text)) {
  const euclidean = isEuclidean(ds);
  const spherical = !euclidean && isSpherical(ds);

  if (euclidean || spherical) {
    count += 1;
    if (count % 100 == 0)
      console.log(`# ${count} symbols checked`);

    try {
      const claim = isPseudoConvex(ds);
      const verification = (
        euclidean ?
          hasNonDegenerateBarycentricPlacement(ds) :
          isThreeConnectedSpherical(ds)
      );

      if (claim != verification)
        console.log(`${ds}`);
    } catch(ex) {
      console.log(ex);
      console.log(`${ds}`);
    }
  }
}
