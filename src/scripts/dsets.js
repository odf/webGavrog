import * as covers from '../dsymbols/covers';
import * as derived from '../dsymbols/derived';
import * as DS from '../dsymbols/delaney';


const _withMinimalBranchings = ds => {
  const branchings = (i, j) =>
    DS.orbitReps2(ds, i, j)
    .filter(D => !ds.v(i, j, D))
    .map(D => [D, Math.ceil(3 / DS.r(ds, i, j, D))]);

  return DS.withBranchings(
    DS.withBranchings(ds, 0, branchings(0, 1)),
    1,
    branchings(1, 2)
  );
};


if (require.main == module) {
  const maxDsSize = parseInt(process.argv[2]);

  covers.covers(DS.parse('<1.1:1:1,1,1:0,0>'), maxDsSize)
    .forEach(
      ds => console.log(`${derived.canonical(_withMinimalBranchings(ds))}`)
    );
}
