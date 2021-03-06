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


export const subsymbol = (ds, indices, seed) => {
  const elements = props.orbit(ds, indices, seed);

  const src2img = {};
  const img2src = {};
  for (let D = 1; D <= elements.length; ++D) {
    src2img[elements[D - 1]] = D;
    img2src[D] = elements[D - 1];
  }

  return DS.buildDSymbol({
    dim: indices.length - 1,
    size: elements.length,
    getS: (i, D) => src2img[ds.s(indices[i], img2src[D])],
    getV: (i, D) => ds.v(indices[i], indices[i+1], img2src[D]) || 0
  });
};


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

    const src2img = {};
    const img2src = [0];

    for (const D of ds.elements()) {
      const E = p.find(D);
      if (!src2img[E]) {
        src2img[E] = img2src.length;
        img2src.push(E);
      }
      src2img[D] = src2img[E];
    }

    return DS.buildDSymbol({
      dim: ds.dim,
      size: img2src.length - 1,
      getS: (i, D) => src2img[ds.s(i, img2src[D])],
      getM: (i, D) => ds.m(i, i+1, img2src[D]) || 0
    });
  }
};


export const barycentricSubdivision = (ds, splitDim=ds.dim) => {
  if (splitDim == 0)
    return ds;
  else {
    const src = D => (D - 1) % ds.size + 1;
    const sheet = D => (D - src(D)) / ds.size;
    const perms = [...comb.permutations(splitDim + 1)];
    const apply = (D, i) => (perms[sheet(D)][i] || i + 1) - 1;

    const sigma = (D, i) => {
      const p = perms[sheet(D)];
      const q = p.slice();
      [q[i], q[i+1]] = [p[i+1], p[i]];
      return perms.findIndex(p => p <= q && p >= q);
    };

    const getS = (i, D) => (
      i < splitDim ?
        ds.size * sigma(D, i) + src(D) :
        ds.size * sheet(D) + ds.s(apply(D, i), src(D))
    );

    const getV = (i, D) => (
      i < splitDim - 1 ?
        1 :
        ds.v(apply(D, i), apply(D, i + 1), src(D))
    );

    return DS.buildDSymbol({
      dim: ds.dim,
      size: ds.size * perms.length,
      getS,
      getV
    });
  }
};


export const tAnalog = ds => dual(barycentricSubdivision(ds));


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
