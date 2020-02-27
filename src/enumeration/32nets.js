import { covers } from '../dsymbols/covers';
import * as delaney from '../dsymbols/delaney';
import * as delaney2d from '../dsymbols/delaney2d';
import * as props from '../dsymbols/properties';
import { branchings } from './branchings2d';


export function* netsOfTransitivity32() {
  const base = delaney.parse('<1.1:1:1,1,1:0,0>');

  for (const dset of covers(base, 8)) {
    if (dset.orbitReps2(1, 2).length != 3 || dset.orbitReps2(0, 2).length != 2)
      continue;

    if (!delaney2d.isProtoEuclidean(dset))
      continue;

    for (const ds of branchings(dset, 3, 3, 0, [1, 2, 3, 4, 5, 6])) {
      if (props.isMinimal(ds))
        yield ds;
    }
  }
}


if (require.main == module) {
  for (const ds of netsOfTransitivity32())
    console.log(`${ds}`);
}
