import * as DS    from './delaney';
import * as props from './properties';
import * as comb  from '../common/combinatorics';


export const canonical = ds => {
  const { mapping: src2img } = props.invariantWithMapping(ds);

  const img2src = {};
  for (const D of ds.elements())
    img2src[src2img[D]] = D;

  return DS.buildDSymbol({
    dim: ds.dim,
    size: ds.size,
    getS: (i, D) => src2img[ds.s(i, img2src[D])],
    getV: (i, D) => ds.v(i, i+1, img2src[D]) || 0
  });
};


export const dual = ds => DS.buildDSymbol({
  dim: ds.dim,
  size: ds.size,
  getS: (i, D) => ds.s(ds.dim - i, D),
  getV: (i, D) => ds.v(ds.dim - i - 1, ds.dim - i, D)
});


export const cover = (ds, nrSheets, fn) => {
  const src = D => (D - 1) % ds.size + 1;
  const sheet = D => (D - src(D)) / ds.size;

  return DS.buildDSymbol({
    dim: ds.dim,
    size: ds.size * nrSheets,
    getS: (i, D) => ds.size * fn(sheet(D), i, src(D)) + ds.s(i, src(D)),
    getM: (i, D) => ds.m(i, i+1, src(D)) || 0
  });
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

    const reps = [0];
    const seen = {};
    for (const D of ds.elements()) {
      const r = p.find(D);
      if (seen[r] == null) {
        seen[r] = true;
        reps.push(r);
      }
    }

    return DS.buildDSymbol({
      dim: ds.dim,
      size: reps.length - 1,
      getS: (i, D) => reps.indexOf(p.find(ds.s(i, reps[D]))),
      getM: (i, D) => ds.m(i, i+1, reps[D]) || 0
    });
  }
};


const _apply = (p, i) => (i < 0 || i >= p.length) ? i : p[i] - 1;


export const barycentricSubdivision = (ds, splitDim) => {
  if (splitDim == null)
    splitDim = DS.dim(ds);

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


export const tAnalog = ds => dual(barycentricSubdivision(ds));


export const subsymbol = (ds, indices, seed) => {
  const elements = props.orbit(ds, indices, seed);
  const dim = indices.length - 1;
  const size = elements.length;

  const mappedElement = {};
  for (let D = 1; D <= size; ++D)
    mappedElement[elements[D - 1]] = D;

  const ops = new Array(dim + 1).fill(0).map(_ => []);
  const brs = new Array(dim).fill(0).map(_ => []);

  for (const D of elements) {
    for (let i = 0; i <= dim; ++i)
      ops[i].push([mappedElement[D], mappedElement[ds.s(indices[i], D)]]);

    for (let i = 0; i < dim; ++i)
      brs[i].push([mappedElement[D], ds.v(indices[i], indices[i + 1], D)])
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

    for (const i of ds.indices()) {
      const idcs = ds.indices().filter(k => k != i);
      const sub = subsymbol(ds, idcs, 1);
      console.log(`    ${JSON.stringify(idcs)}-subsymbol at 1: ${sub}`);
    }
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
