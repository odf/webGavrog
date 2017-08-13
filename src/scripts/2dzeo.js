import * as generators from '../common/generators';

import * as branch from '../dsymbols/branchings2d';
import * as covers from '../dsymbols/covers';
import * as DS from '../dsymbols/delaney';
import * as DS2D from '../dsymbols/delaney2d';
import * as props from '../dsymbols/properties';


const allMs = (ds, i, j) =>
  DS.orbitReps2(ds, i, j).map(D => DS.m(ds, i, j, D));


if (require.main == module) {
  const n = parseInt(process.argv[2])

  covers.covers(DS.parse('<1.1:1:1,1,1:0,3>'), n * 6)
    .filter(ds => DS.orbitReps2(ds, 1, 2).size == n)
    .filter(DS2D.isProtoEuclidean)
    .flatMap(ds => generators.results(branch.branchings(ds)))
    .filter(ds => allMs(ds, 0, 1).every(m => m >= 4))
    .filter(props.isMinimal)
    .forEach(ds => console.log(`${ds}`));
}
