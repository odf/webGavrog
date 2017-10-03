import * as DS    from './delaney';
import * as props from './properties';
import * as comb  from '../common/combinatorics';


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

  const pairingsFn = (_, i) => {
    const out = [];
    for (const D of ds.elements()) {
      for (let k = 0; k < nrSheets; ++k)
        out.push([k * n + D, fn(k, i, D) * n + ds.s(i, D)]);
    }
    return out;
  };

  const branchingsFn = (tmp, i) => {
    const out = [];
    for (const D of DS.orbitReps2(tmp, i, i+1)) {
      const m = DS.m(ds, i, i+1, (D - 1) % n + 1) || 0;
      out.push([D, m / DS.r(tmp, i, i+1, D)]);
    }
    return out;
  };

  return DS.build(d, n * nrSheets, pairingsFn, branchingsFn);
};


export const orientedCover = ds => {
  if (props.isOriented(ds))
    return ds;
  else {
    const ori = props.partialOrientation(ds);
    return cover(ds, 2, (k, i, D) => ori[D] == ori[ds.s(i, D)] ? 1 - k : k);
  }
};


export const minimal = ds => {
  if (props.isMinimal(ds))
    return ds;
  else {
    const p = props.typePartition(ds);
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
    const n = DS.size(ds);

    const perms = [];
    const elements = [];
    let j = 0;
    for (const p of comb.permutations(splitDim + 1)) {
      perms.push(p);
      for (const D of ds.elements())
        elements.push([p, j, D]);
      ++j;
    }

    const sigma = (p, i) => {
      const q = p.slice();
      [q[i], q[i+1]] = [p[i+1], p[i]];
      return perms.findIndex(p => p <= q && p >= q);
    };

    const pairingsFn = (_, i) => elements.map(([p, j, D]) => [
      n * j + D,
      (i < splitDim) ?
        n * sigma(p, i) + D :
        n * j + ds.s(_apply(p, i), D)
    ]);

    const branchingsFn = (tmp, i) => elements.map(([p, j, D]) => [
      n * j + D,
      (i < splitDim - 1) ?
        1 :
        ds.v(_apply(p, i), _apply(p, i+1), D)
    ]);

    return DS.build(DS.dim(ds), n * perms.length, pairingsFn, branchingsFn);
  }
};


export const canonical = ds => {
  const inv = props.invariant(ds);
  const dim = DS.dim(ds);
  const size = DS.size(ds);

  const ops = new Array(dim + 1).fill(0).map(_ => []);
  const brs = new Array(dim).fill(0).map(_ => []);

  let n = 0;
  let k = -1;

  while (k+1 < inv.length) {
    const i = inv[++k];
    const D = inv[++k];
    const E = (i >= 0) ? inv[++k] : D;
    if (E > n) {
      for (let j = 0; j < dim; ++j)
        brs[j].push([E, inv[++k]]);
      n = E;
    }
    if (i >= 0)
      ops[i].push([D, E]);
  }

  return DS.build(dim, size, (_, i) => ops[i], (_, i) => brs[i]);
};


if (require.main == module) {
  const test = ds => {
    console.log(`ds = ${ds}`);
    console.log();

    console.log(`    dual          : ${dual(ds)}`);
    console.log(`    minimal image : ${minimal(ds)}`);
    console.log(`    oriented cover: ${orientedCover(ds)}`);
    console.log(`    canonical     : ${canonical(ds)}`);
    console.log();

    for (const i of ds.indices())
      console.log(`    ${i}-subdivision : ${barycentricSubdivision(ds, i)}`);
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
