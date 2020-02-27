import { seq } from '../common/lazyseq';
import * as covers from '../dsymbols/covers';
import * as DS from '../dsymbols/delaney';
import * as DS2D from '../dsymbols/delaney2d';
import * as props from '../dsymbols/properties';
import * as branch from './branchings2d';


export function* twoDimensionalZeolites(nrVertices) {
  const base = DS.parse('<1.1:1:1,1,1:0,3>');

  for (const dset of covers.covers(base, nrVertices * 6)) {
    if (dset.orbitReps2(1, 2).length != nrVertices)
      continue;

    if (!DS2D.isProtoEuclidean(dset))
      continue;

    for (const ds of branch.branchings(dset, 4)) {
      const reps = ds.orbitReps2(0, 2);

      if (reps.some(D => ds.m(0, 1, D) == 4 && ds.m(0, 1, ds.s(2, D)) == 4))
        continue;

      if (props.isMinimal(ds) && DS2D.isEuclidean(ds))
        yield ds;
    }
  }
}


if (require.main == module) {
  const n = parseInt(process.argv[2])

  for (const ds of twoDimensionalZeolites(n))
    console.log(`${ds}`);
}
