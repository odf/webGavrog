import { covers } from '../dsymbols/covers';
import * as delaney from '../dsymbols/delaney';
import * as delaney2d from '../dsymbols/delaney2d';
import * as props from '../dsymbols/properties';
import { branchings } from './branchings2d';


export function* twoDimensionalZeolites(nrVertices) {
  const base = delaney.parse('<1.1:1:1,1,1:0,3>');

  for (const dset of covers(base, nrVertices * 6)) {
    if (dset.orbitReps2(1, 2).length != nrVertices)
      continue;

    if (!delaney2d.isProtoEuclidean(dset))
      continue;

    for (const ds of branchings(dset, 4)) {
      const reps = ds.orbitReps2(0, 2);

      if (reps.some(D => ds.m(0, 1, D) == 4 && ds.m(0, 1, ds.s(2, D)) == 4))
        continue;

      if (props.isMinimal(ds) && delaney2d.isEuclidean(ds))
        yield ds;
    }
  }
}


if (require.main == module) {
  const n = parseInt(process.argv[2])

  for (const ds of twoDimensionalZeolites(n))
    console.log(`${ds}`);
}
