import * as generators from '../common/generators';

import * as branch from '../dsymbols/branchings2d';
import * as covers from '../dsymbols/covers';
import * as DS from '../dsymbols/delaney';
import * as DS2D from '../dsymbols/delaney2d';
import * as props from '../dsymbols/properties';


const allRs = (ds, i, j) =>
  DS.orbitReps2(ds, i, j).map(D => DS.r(ds, i, j, D));

const allMs = (ds, i, j) =>
  DS.orbitReps2(ds, i, j).map(D => DS.m(ds, i, j, D));

const withAllTrivalentVertices = ds => DS.withBranchings(
  ds, 1,
  DS.orbitReps2(ds, 1, 2).toArray().map(D => [D, 3 / DS.r(ds, 1, 2, D)])
);


if (require.main == module) {
  const n = parseInt(process.argv[2])

  covers.covers(DS.parse('<1.1:1:1,1,1:0,0>'), n * 6)
    .filter(ds => DS.orbitReps2(ds, 1, 2).size == n)
    .filter(ds => allRs(ds, 1, 2).every(r => r == 1 || r == 3))
    .map(withAllTrivalentVertices)
    .filter(DS2D.isProtoEuclidean)
    .flatMap(ds => generators.results(branch.branchings(ds)))
    .filter(ds => allMs(ds, 1, 2).every(r => r == 3))
    .filter(ds => allMs(ds, 0, 1).every(r => r > 3))
    .filter(props.isMinimal)
    .forEach(ds => console.log(`${ds}`));
}
