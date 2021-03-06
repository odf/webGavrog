import { buffered } from '../common/iterators';
import { Partition } from '../common/unionFind';

import * as DS from './delaney';


const typeMap = ds => {
  const result = {};

  for (const D of ds.elements())
    result[D] = [];

  for (let i = 0; i < ds.dim; ++i) {
    for (const D of ds.orbitReps2(i, i+1)) {
      const m = ds.m(i, i+1, D);
      for (const E of ds.orbit2(i, i+1, D))
        result[E].push(m);
    }
  }

  for (const D of ds.elements())
    result[D] = result[D].join(',');

  return result;
};


const typePartitionFolder = ds => {
  const types = typeMap(ds);

  return (p0, D0, E0) => {
    const p = p0.clone();
    let q = [[D0, E0]];

    while (q.length) {
      const [D, E] = q.shift();

      if (types[D] != types[E])
        return;
      else if (p.find(D) == p.find(E))
        continue;
      else if (D != null) {
        p.union(D, E);
        for (const i of ds.indices())
          q.push([ds.s(i, D), ds.s(i, E)]);
      }
    }

    return p;
  };
};


export const isMinimal = ds => {
  const fold = typePartitionFolder(ds);
  const p = new Partition();
  const D0 = ds.elements()[0];

  return ds.elements().slice(1).every(D => fold(p, D0, D) === undefined);
};


export const typePartition = ds => {
  const fold = typePartitionFolder(ds);
  const p = new Partition();
  const D0 = ds.elements()[0];

  return ds.elements().slice(1).reduce((p, D) => fold(p, D0, D) || p, p);
};


export const traversal = function*(ds, indices, seeds) {
  const seedsLeft = Array.from(seeds);
  const seen = {};
  const todo = {};

  for (const i of indices)
    todo[i] = [];

  while (true) {
    const i = indices.find(k => todo[k].length);
    const D = (i == null) ? seedsLeft.pop() : todo[i].shift();

    if (D == null)
      return;

    if (!seen[[D, i]]) {
      const Di = (i == null) ? D : ds.s(i, D);

      for (const k of indices) {
        if (k < 2)
          todo[k].unshift(Di);
        else
          todo[k].push(Di);
      }

      seen[[Di, null]] = seen[[D, i]] = seen[[Di, i]] = true;

      yield [D, i, Di];
    }
  }
};


export const partialOrientation = ds => {
  const ori = new Array(ds.size + 1);

  for (const [Di, i, D] of traversal(ds, ds.indices(), ds.elements())) {
    if (D && !ori[D])
      ori[D] = i == null ? 1 : -ori[Di];
  }

  return ori;
};


const forAllEdges = (ds, test) =>
  ds.elements().every(D => ds.indices().every(i => test(D, i)));


export const isLoopless = ds => forAllEdges(ds, (D, i) => D != ds.s(i, D));


export const isOriented = ds => {
  const ori = partialOrientation(ds);
  return forAllEdges(ds, (D, i) => ori[D] != ori[ds.s(i, D)]);
};


export const isWeaklyOriented = ds => {
  const ori = partialOrientation(ds);
  const test = (D, Di) => D == Di || ori[D] != ori[Di];
  return forAllEdges(ds, (D, i) => test(D, ds.s(i, D)));
};


export const orbitReps = (ds, indices, seeds) => {
  const result = [];
  for (const [_, i, D] of traversal(ds, indices, seeds || ds.elements())) {
    if (i == null)
      result.push(D);
  }
  return result;
};


export const orbits = (ds, indices, seeds) => {
  const seen = {};
  const result = [];

  for (const [_, i, D] of traversal(ds, indices, seeds || ds.elements())) {
    if (i == null)
      result.push([]);

    if (D && !seen[D]) {
      seen[D] = true;
      result[result.length - 1].push(D);
    }
  }

  return result;
};


export const isConnected = ds => orbitReps(ds, ds.indices()).length < 2;
export const orbit = (ds, indices, seed) => orbits(ds, indices, [seed])[0];


function* protocol(ds, gen) {
  const emap = {};
  let n = 1;

  for (const [Di, i, D] of gen) {
    if (emap[D] == null)
      emap[D] = n;

    yield i == null ? -1 : i;
    yield emap[Di];

    if (i != null)
      yield emap[D];

    if (emap[D] == n) {
      ++n;

      for (let i = 0; i < ds.dim; ++i)
        yield ds.v(i, i+1, D);
    }
  }

  return emap;
};


export const invariantWithMapping = ds => {
  let best = null;

  for (const D0 of ds.elements()) {
    const trav = buffered(protocol(ds, traversal(ds, ds.indices(), [D0])));

    if (best == null)
      best = trav;
    else {
      for (let i = 0; ; ++i) {
        const next = trav.get(i);
        if (next == null)
          break;

        const d = next - best.get(i);
        if (d < 0)
          best = trav;
        else if (d > 0)
          break;
      }
    }
  }

  const { generated, returned } = best.result();
  return { invariant: generated, mapping: returned };
};


export const invariant = ds => invariantWithMapping(ds).invariant;


export const morphism = (
  src, img, startSrc, startImg, typesSrc=typeMap(src), typesImg=typeMap(img)
) => {
  if (!isConnected(src))
    throw new Error('source symbol must be connected');

  if (src.dim != img.dim)
    throw new Error('dimensions must be equal');

  const q = [[startSrc, startImg]];
  const m = new Array(src.size + 1);

  while (q.length) {
    const [D, E] = q.shift();

    if (m[D] == E)
      continue;
    else if (m[D] != null || typesSrc[D] != typesImg[E])
      return null;
    else if (D != null) {
      m[D] = E;

      for (let i = 0; i <= src.dim; ++i)
        q.push([src.s(i, D), img.s(i, E)]);
    }
  }

  return m;
};


export const automorphisms = ds => {
  const types = typeMap(ds);
  const result = [];

  for (let D = 1; D <= ds.size; ++D) {
    const phi = morphism(ds, ds, 1, D, types, types);
    if (phi != null)
      result.push(phi);
  }

  return result;
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x && x.toString()).join(', ') + ' ]';
  };

  const test = ds => {
    const is = fn => fn(ds) ? 'is' : 'is not';

    console.log(`ds = ${ds}`);
    console.log();

    console.log(`    symbol ${is(isConnected)} connected.`);
    console.log(`    symbol ${is(isMinimal)} minimal.`);
    console.log(`    symbol ${is(isLoopless)} loopless.`);
    console.log(`    symbol ${is(isOriented)} oriented.`);
    console.log(`    symbol ${is(isWeaklyOriented)} weakly oriented.`);
    console.log(`    type partition: ${typePartition(ds)}`);

    const trav = [...traversal(ds, ds.indices(), ds.elements())];
    console.log(`    traversal: ${trav}`);
    console.log(`    invariant: ${invariant(ds)}`);
    console.log();

    console.log(`    0,1 orbit reps: ${orbitReps(ds, [0, 1])}`);
    console.log(`    1,2 orbit reps: ${orbitReps(ds, [1, 2])}`);
    console.log(`    0,2 orbit reps: ${orbitReps(ds, [0, 2])}`);
    console.log();

    console.log(`    0,1 orbits: ${orbits(ds, [0, 1])}`);
    console.log(`    1,2 orbits: ${orbits(ds, [1, 2])}`);
    console.log(`    0,2 orbits: ${orbits(ds, [0, 2])}`);
    console.log();

    console.log(`    0,1 orbit of 1: ${orbit(ds, [0, 1], 1)}`);
    console.log(`    1,2 orbit of 1: ${orbit(ds, [1, 2], 1)}`);
    console.log(`    0,2 orbit of 1: ${orbit(ds, [0, 2], 1)}`);
    console.log();

    const ori = partialOrientation(ds);
    console.log(`    partial orientation: ${ori}`);
    console.log();

    console.log(`    automorphisms: ${automorphisms(ds)}`);
    console.log();
    console.log();
  };

  test(DS.parse(`<1.1:24:
                2 4 6 8 10 12 14 16 18 20 22 24,
                16 3 5 7 9 11 13 15 24 19 21 23,
                10 9 20 19 14 13 22 21 24 23 18 17:
                8 4,3 3 3 3>`));

  test(DS.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(DS.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(DS.parse('<1.1:6:4 6 5,5 4 6,4 6 5:3,6>'));
}
