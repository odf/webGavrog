import * as delaney from './delaney';
import * as delaney2d from './delaney2d';
import * as derived from './derived';
import * as fundamental from './fundamental';
import * as properties from './properties';
import * as tilings from './tilings';


const _assert = (condition, message) => {
  if (!condition)
    throw new Error(message || 'assertion error');
};


export const collapse = (ds, toBeRemoved, connectorIndex) => {
  const dim = delaney.dim(ds);
  const k = connectorIndex;
  const old2new = {};
  let next = 1;

  for (const D of ds.elements()) {
    if (toBeRemoved.indexOf(D) < 0) {
      old2new[D] = next;
      ++next;
    }
    else {
      const Dk = ds.s(k, D);

      _assert(
        old2new[Dk] == null,
        `${k}-neighbor ${Dk} of removed element ${D} must also be removed`
      );
    }
  }

  const size = next - 1;
  const ops = new Array(dim + 1).fill(0).map(_ => []);
  const brs = new Array(dim).fill(0).map(_ => []);

  for (const D of ds.elements()) {
    if (old2new[D]) {
      for (const i of ds.indices()) {
        const Di = ds.s(i, D);

        if (i != connectorIndex) {
          while (!old2new[Di])
            Di = ds.s(i, ds.s(connectorIndex, Di));
        }

        ops[i].push([old2new[D], old2new[Di]]);

        if (i < dim)
          brs[i].push([old2new[D], ds.v(i, i + 1, D)]);
      }
    }
  }

  return delaney.build(dim, size, (_, i) => ops[i], (_, i) => brs[i]);
};


const isFundamentalTile = (ds, D) => {
  const idcs = ds.indices().filter(i => i < ds.dim);
  const sub = derived.subsymbol(ds, idcs, D);

  if (ds.dim == 3) {
    return delaney2d.curvature(sub) == 4;
  }
  else if (ds.dim == 2) {
    return properties.isLoopless(sub) && ds.v(0, 1, D) == 1;
  }
};


const mergeTiles = (ds, seeds) => {
  const idcs = ds.indices().filter(i => i != ds.dim - 1);
  const removed = [].concat(...properties.orbits(ds, idcs, seeds));

  return collapse(ds, removed, ds.dim);
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
  const idcsTile = ds.indices().filter(i => i < ds.dim);
  const idcsFacet = ds.indices().filter(i => i < ds.dim - 1);

  const seeds = [];

  for (const orbit of properties.orbits(ds, idcsTile, ds.elements())) {
    if (!isFundamentalTile(ds, orbit[0]))
      continue;

    for (const E of properties.orbitReps(ds, idcsFacet, orbit)) {
      if (!isFundamentalTile(ds, ds.s(ds.dim, E))) {
        seeds.push(E);
        break;
      }
    }
  }

  return mergeTiles(ds, seeds);
};


const mergeFacets = ds => {
  const dim = delaney.dim(ds);
  const seeds = ds.elements().filter(D => delaney.m(ds, dim, dim - 1, D) == 2);
  const idcs = ds.indices().filter(i => i != dim - 2);
  const removed = [].concat(...properties.orbits(ds, idcs, seeds));

  return collapse(ds, removed, dim - 1);
};


const mergeEdges = ds => {
  const idcs = ds.indices().filter(i => i > 0);

  const seeds = [];

  for (const orbit of properties.orbits(ds, idcs, ds.elements())) {
    if (orbit.every(D => delaney.m(ds, 1, 2, D) == 2))
      seeds.push(orbit[0]);
  }

  const removed = [].concat(...properties.orbits(ds, idcs, seeds));
  return collapse(ds, removed, 1);
};


const chain = (ds, ...fns) => {
  for (const fn of fns)
    ds = fn(ds);

  return ds;
};


export const simplify = ds => chain(
  ds,
  mergeFundamentalTiles, mergeFacets,
  mergeNonFundamentalTiles, mergeFacets,
  mergeEdges,
  derived.dual,
  //mergeFundamentalTiles, mergeFacets,
  //mergeNonFundamentalTiles, mergeFacets,
  derived.dual
);


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
    delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>')
  ];

  for (const ds of symbols) {
    test(tilings.makeCover(ds));
    test(derived.barycentricSubdivision(ds));
  }
}
