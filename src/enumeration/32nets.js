import * as branch from './branchings2d';
import * as covers from '../dsymbols/covers';
import * as DS from '../dsymbols/delaney';
import * as DS2D from '../dsymbols/delaney2d';
import * as props from '../dsymbols/properties';


export function* netsOfTransitivity32() {
  const base = DS.parse('<1.1:1:1,1,1:0,0>');

  for (const dset of covers.covers(base, 8)) {
    if (dset.orbitReps2(1, 2).length != 3 || dset.orbitReps2(0, 2).length != 2)
      continue;

    if (!DS2D.isProtoEuclidean(dset))
      continue;

    for (const ds of branch.branchings(dset, 3, 3, 0, [1, 2, 3, 4, 5, 6])) {
      if (props.isMinimal(ds))
        yield ds;
    }
  }
}


if (require.main == module) {
  for (const ds of netsOfTransitivity32())
    console.log(`${ds}`);
}
