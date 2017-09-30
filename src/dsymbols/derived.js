import * as I          from 'immutable';
import * as DS         from './delaney';
import * as properties from './properties';
import * as comb       from '../common/combinatorics';


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

  return DS.build(
    d, n * nrSheets,
    (_, i) => I.List(ds.elements()).flatMap(D => (
      I.Range(0, nrSheets).map(k => [k * n + D, fn(k, i, D) * n + ds.s(i, D)]))),
    (tmp, i) => DS.orbitReps2(tmp, i, i+1).map(D => (
      [D, (DS.m(ds, i, i+1, (D - 1) % n + 1) || 0) / DS.r(tmp, i, i+1, D)])));
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
    const reps = I.List(p.classes(ds.elements()))
      .map(cl => cl.find(D => p.get(D) == D));
    const emap = I.Map(reps.zip(I.Range(1)));
    const imap = I.Map(I.Range().zip(ds.indices()));

    return DS.build(
      DS.dim(ds), reps.count(),
      (_, i) => reps.map(D => (
        [emap.get(D), emap.get(p.get(ds.s(imap.get(i), D)))])),
      (tmp, i) => reps.map(D => (
        [emap.get(D), 
         (DS.m(ds, imap.get(i), imap.get(i+1), D) || 0)
         /
         DS.r(tmp, i, i+1, emap.get(D))])));
  }
};


const _applyPerm = (p, i) => (i < 0 || i >= p.size) ? i : p.get(i) - 1;


export const barycentricSubdivision = (ds, splitDim) => {
  if (splitDim == 0)
    return ds;
  else {
    const dim = DS.dim(ds);
    const perms = I.List(comb.permutations(splitDim + 1)).map(I.List);
    const pidx = I.Map(I.List(perms).zip(I.Range()));
    const n = DS.size(ds);
    const m = perms.size;

    return DS.build(
      DS.dim(ds), n * m,
      (_, i) => {
        return I.List(ds.elements()).flatMap(D => {
          return I.Range(0, m).map(j => {
            const p = perms.get(j);
            if (i < splitDim) {
              const pi = p.set(i, p.get(i+1)).set(i+1, p.get(i));
              const k = pidx.get(pi);
              return [n * j + D, n * k + D];
            } else {
              const E = ds.s(_applyPerm(p, i), D);
              return [n * j + D, n * j + E];
            }
          });
        });
      },
      (tmp, i) => {
        return I.List(ds.elements()).flatMap(D => {
          return I.Range(0, m).map(j => {
            const p = perms.get(j);
            let v;
            if (i < splitDim - 1)
              v = 1;
            else
              v = ds.v(_applyPerm(p, i), _applyPerm(p, i+1), D);
            return [n * j + D, v];
          });
        });
      }
    );
  }
};


export const canonical = ds => {
  const inv = properties.invariant(ds);
  const dim = DS.dim(ds);
  const size = DS.size(ds);

  let ops = I.Map(I.Range(0, dim+1).zip(I.Repeat(I.List())));
  let brs = I.Map(I.Range(0, dim).zip(I.Repeat(I.List())));
  let n   = 0;
  let k   = -1;

  while (k+1 < inv.size) {
    const i = inv.get(++k);
    const D = inv.get(++k);
    const E = (i >= 0) ? inv.get(++k) : D;
    if (E > n) {
      for (let j = 0; j < dim; ++j)
        brs = brs.set(j, brs.get(j).push([E, inv.get(++k)]));
      n = E;
    }
    if (i >= 0)
      ops = ops.set(i, ops.get(i).push([D, E]));
  }

  return DS.build(dim, size, (_, i) => ops.get(i), (_, i) => brs.get(i));
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
