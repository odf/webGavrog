import * as generators from '../common/generators';

import * as branch from '../dsymbols/branchings2d';
import * as covers from '../dsymbols/covers';
import * as DS from '../dsymbols/delaney';
import * as DS2D from '../dsymbols/delaney2d';
import * as props from '../dsymbols/properties';


const noEdgeSharingQuads = ds => DS.orbitReps2(ds, 0, 2)
  .every(D => DS.m(ds, 0, 1, D) > 4 || DS.m(ds, 0, 1, ds.s(2, D)) > 4);


if (require.main == module) {
  const n = parseInt(process.argv[2])

  covers.covers(DS.parse('<1.1:1:1,1,1:0,3>'), n * 6)
    .filter(ds => DS.orbitReps2(ds, 1, 2).size == n)
    .filter(DS2D.isProtoEuclidean)
    .flatMap(ds => generators.results(branch.branchings(ds, 4)))
    .filter(noEdgeSharingQuads)
    .filter(props.isMinimal)
    .filter(DS2D.isEuclidean)
    .forEach(ds => console.log(`${ds}`));
}
