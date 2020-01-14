import * as branch from '../dsymbols/branchings2d';
import * as covers from '../dsymbols/covers';
import * as DS from '../dsymbols/delaney';
import * as DS2D from '../dsymbols/delaney2d';
import * as props from '../dsymbols/properties';


if (require.main == module) {
  const branchings = ds => branch.branchings(ds, 3, 3, 0, [1, 2, 3, 4, 5, 6]);

  covers.covers(DS.parse('<1.1:1:1,1,1:0,0>'), 8)
    .filter(ds => DS.orbitReps2(ds, 1, 2).length == 3
            && DS.orbitReps2(ds, 0, 2).length == 2)
    .filter(DS2D.isProtoEuclidean)
    .flatMap(ds => branchings(ds))
    .filter(props.isMinimal)
    .forEach(ds => console.log(`${ds}`));
}
