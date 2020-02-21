import * as delaney from './delaney';
import * as delaney2d from './delaney2d';
import * as derived from './derived';
import * as fundamental from './fundamental';
import * as props from './properties';


const indicesExcept =
  (ds, ...idcs) => ds.indices().filter(i => !idcs.includes(i));


export const collapse = (ds, setsToSquash, connector) => {
  const remove = {};
  for (const set of setsToSquash) {
    for (const D of set)
      remove[D] = true;
  }

  const k = connector;
  const src2img = {};
  const img2src = {};
  let size = 0;

  for (const D of ds.elements()) {
    if (!remove[D]) {
      src2img[D] = ++size;
      img2src[size] = D;
    }
    else if (!remove[ds.s(k, D)])
      throw new Error(
        `must also remove ${k}-neighbor ${ds.s(k, D)} of removed element ${D}`
      );
  }

  const getS = (i, D) => {
    let E = ds.s(i, img2src[D]);
    if (i != k) {
      while (!src2img[E])
        E = ds.s(i, ds.s(k, E));
    }
    return src2img[E];
  };

  const getV = (i, D) => ds.v(i, i+1, img2src[D]) || 0;

  return delaney.buildDSymbol({ dim: ds.dim, size, getS, getV });
};


const mergeTiles = (ds, seeds) => {
  const orbits = props.orbits(ds, indicesExcept(ds, ds.dim - 1), seeds);

  return collapse(ds, orbits, ds.dim);
};


const mergeFacets = ds => {
  const orbits = props.orbits(ds, indicesExcept(ds, ds.dim - 2))
    .filter(orb => orb.some(D => ds.m(ds.dim - 1, ds.dim, D) == 2));

  return collapse(ds, orbits, ds.dim - 1);
};


const mergeEdges = ds => {
  const orbits = props.orbits(ds, indicesExcept(ds, 0))
    .filter(orb => orb.every(D => ds.m(1, 2, D) == 2));

  return collapse(ds, orbits, 1);
};


const isFundamentalTile = (ds, D) => {
  const sub = derived.subsymbol(ds, indicesExcept(ds, ds.dim), D);

  if (ds.dim == 3)
    return delaney2d.curvature(sub) == 4;
  else if (ds.dim == 2)
    return props.isLoopless(sub) && ds.v(0, 1, D) == 1;
};


const mergeFundamentalTiles = ds => {
  const seeds = [];

  for (const [D, i] of fundamental.innerEdges(ds)) {
    if (i < ds.dim)
      continue;

    if (isFundamentalTile(ds, D) && isFundamentalTile(ds, ds.s(i, D)))
      seeds.push(D);
  }

  return mergeTiles(ds, seeds);
};


const mergeNonFundamentalTiles = ds => {
  const idcsTile = indicesExcept(ds, ds.dim);
  const idcsFacet = indicesExcept(ds, ds.dim, ds.dim - 1);

  const seeds = [];

  for (const orbit of props.orbits(ds, idcsTile, ds.elements())) {
    if (!isFundamentalTile(ds, orbit[0]))
      continue;

    for (const E of props.orbitReps(ds, idcsFacet, orbit)) {
      if (!isFundamentalTile(ds, ds.s(ds.dim, E))) {
        seeds.push(E);
        break;
      }
    }
  }

  return mergeTiles(ds, seeds);
};


export const simplify = ds => {
  const chain = (ds, ...fns) => fns.reduce((ds, fn) => fn(ds), ds);

  ds = chain(
    ds, mergeFundamentalTiles, mergeFacets, mergeNonFundamentalTiles
  );

  let dsOld;

  do {
    dsOld = ds;
    ds = chain(
      ds, mergeFacets, mergeEdges, derived.dual, mergeFacets, derived.dual
    );
  }
  while (ds.size < dsOld.size);

  return ds;
};


if (require.main == module) {
  const test = ds => {
    console.log(`#input D-symbol`);
    console.log(`${ds}`);

    const dsx = derived.canonical(simplify(ds));
    console.log(`#output D-symbol`);
    console.log(`${dsx}`);
    console.log();
  }

  const symbols = [
    delaney.parse('<1.1:1:1,1,1:3,6>'),
    delaney.parse('<1.1:2:1 2,1 2,2:3 6,4>'),
    delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'),
    delaney.parse('<003.1:72 3:2 4 6 8 10 12 14 16 18 20 22 24 26 28 30 32 34 36 38 40 42 44 46 48 50 52 54 56 58 60 62 64 66 68 70 72,71 3 34 69 7 46 14 11 13 54 17 40 56 21 52 28 25 27 43 31 42 72 49 37 48 53 44 70 50 55 62 59 61 68 65 67,5 6 9 10 14 13 31 32 19 20 23 24 28 27 37 38 33 34 39 40 45 46 64 63 51 52 59 60 58 57 61 62 72 71 69 70,15 16 17 18 45 46 8 66 65 64 63 68 67 51 52 22 57 58 59 60 61 62 41 42 32 39 40 47 48 38 44 50 72 71 56 70:4 4 3 4 4 3 4 4 3 3,3 3 3 3 3 3 3 3 3 3 3 3,6 6 4 4 4 4 4 4>')
  ];

  for (const ds of symbols) {
    test(derived.barycentricSubdivision(ds));
  }
}
