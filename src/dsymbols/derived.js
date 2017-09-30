import * as DS         from './delaney';
import * as properties from './properties';
import * as comb       from '../common/combinatorics';
import * as seq        from '../common/lazyseq';


export const dual = ds => {
  const d = DS.dim(ds);
  const n = DS.size(ds);

  return DS.build(
    d, n,
    (_, i) => ds.elements().map(D => [D, ds.s(d - i, D)]),
    (_, i) => ds.elements().map(D => [D, ds.v(d-i-1, d-i, D)]));
};


export const cover = (ds, nrSheets, fn) => {
  const d = DS.dim(ds);
  const n = DS.size(ds);

  const pairingsFn = (_, i) => seq.seq(ds.elements())
    .flatMap(D => seq.range(0, nrSheets).map(
      k => [k * n + D, fn(k, i, D) * n + ds.s(i, D)]));

  const branchingsFn = (tmp, i) => DS.orbitReps2(tmp, i, i+1)
    .map(D => [
      D,
      (DS.m(ds, i, i+1, (D - 1) % n + 1) || 0) / DS.r(tmp, i, i+1, D)
    ]);

  return DS.build(d, n * nrSheets, pairingsFn, branchingsFn);
};


export const orientedCover = ds => {
  if (properties.isOriented(ds))
    return ds;
  else {
    const ori = properties.partialOrientation(ds);
    return cover(
      ds, 2, (k, i, D) => ori.get(D) == ori.get(ds.s(i, D)) ? 1 - k : k);
  }
};


export const minimal = ds => {
  if (properties.isMinimal(ds))
    return ds;
  else {
    const p = properties.typePartition(ds);
    const reps = ds.elements().filter(D => p.get(D) == D);

    return DS.build(
      DS.dim(ds), reps.length,
      (_, i) => reps.map(
        (D, k) => [k+1, reps.indexOf(p.get(ds.s(i, D))) + 1]),
      (tmp, i) => reps.map(
        (D, k) => [k+1, (DS.m(ds, i, i+1, D) || 0) / DS.r(tmp, i, i+1, k+1)]));
  }
};


const _apply = (p, i) => (i < 0 || i >= p.length) ? i : p[i] - 1;


export const barycentricSubdivision = (ds, splitDim) => {
  if (splitDim == 0)
    return ds;
  else {
    const perms = seq.seq(comb.permutations(splitDim + 1)).toArray();
    const n = DS.size(ds);

    return DS.build(
      DS.dim(ds), n * perms.length,
      (_, i) => seq.seq(ds.elements())
        .flatMap(D => perms.map((p, j) => {
          if (i < splitDim) {
            const q = p.slice();
            [q[i], q[i+1]] = [p[i+1], p[i]];
            const k = perms.findIndex(p => p <= q && p >= q);
            return [n * j + D, n * k + D];
          } else {
            const E = ds.s(_apply(p, i), D);
            return [n * j + D, n * j + E];
          }
        })),
      (tmp, i) => seq.seq(ds.elements())
        .flatMap(D => perms.map((p, j) => {
          const v =
            (i < splitDim - 1) ? 1 : ds.v(_apply(p, i), _apply(p, i+1), D);
          return [n * j + D, v];
        }))
    );
  }
};


export const canonical = ds => {
  const inv = properties.invariant(ds);
  const dim = DS.dim(ds);
  const size = DS.size(ds);

  const ops = new Array(dim + 1).fill(0).map(_ => []);
  const brs = new Array(dim).fill(0).map(_ => []);

  let n   = 0;
  let k   = -1;

  while (k+1 < inv.size) {
    const i = inv.get(++k);
    const D = inv.get(++k);
    const E = (i >= 0) ? inv.get(++k) : D;
    if (E > n) {
      for (let j = 0; j < dim; ++j)
        brs[j].push([E, inv.get(++k)]);
      n = E;
    }
    if (i >= 0)
      ops[i].push([D, E]);
  }

  return DS.build(dim, size, (_, i) => ops[i], (_, i) => brs[i]);
};


if (require.main == module) {
  const test = ds => {
    console.log('ds = '+ds);
    console.log();

    console.log('    dual          : '+dual(ds));
    console.log('    minimal image : ' + minimal(ds));
    console.log('    oriented cover: ' + orientedCover(ds));
    console.log('    canonical     : ' + canonical(ds));
    console.log();

    ds.indices().forEach(i => {
      console.log('    '+i+'-subdivision : '+barycentricSubdivision(ds, i));
    });
    console.log();
    console.log();
  };

  test(DS.parse(
    '<1.1:24:' +
      '2 4 6 8 10 12 14 16 18 20 22 24,' +
      '16 3 5 7 9 11 13 15 24 19 21 23,' +
      '10 9 20 19 14 13 22 21 24 23 18 17:' +
      '8 4,3 3 3 3>'));

  test(DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(DS.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
}
