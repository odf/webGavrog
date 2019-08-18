import * as DS from './delaney';
import { seq } from '../common/lazyseq';
import { Partition } from '../common/unionFind';


const _assert = (condition, message) => {
  if (!condition)
    throw new Error(message || 'assertion error');
};


const _fold = (partition, a, b, matchP, spreadFn) => {
  const p = partition.clone();
  let q = [[a, b]];

  while (q.length) {
    const [x, y] = q.shift();

    if (!matchP(x, y))
      return;
    else if (p.find(x) == p.find(y))
      continue;
    else {
      p.union(x, y);
      q = q.concat(spreadFn(x, y));
    }
  }

  return p;
};


const _typeMap = ds => {
  const result = {};

  for (const D of ds.elements())
    result[D] = [];

  for (const i of ds.indices()) {
    for (const j of ds.indices()) {
      for (const D of DS.orbitReps2(ds, i, j)) {
        const m = DS.m(ds, i, j, D);
        for (const E of DS.orbit2(ds, i, j, D))
          result[E].push(m);
      }
    }
  }

  return result;
};


const typePartitionFolder = ds => {
  const tm = _typeMap(ds);
  const match  = (D, E) => tm[D] <= tm[E] && tm[D] >= tm[E];
  const spread = (D, E) => ds.indices().map(i => [ds.s(i, D), ds.s(i, E)]);

  return (p, D, E) => _fold(p, D, E, match, spread);
};


export const isMinimal = ds => {
  const folder = typePartitionFolder(ds);
  const p = new Partition();
  const D0 = ds.elements()[0];

  return ds.elements().slice(1).every(D => folder(p, D0, D) === undefined);
};


export const typePartition = ds => {
  const folder = typePartitionFolder(ds);
  const p = new Partition();
  const D0 = ds.elements()[0];

  return ds.elements().slice(1).reduce((p, D) => folder(p, D0, D) || p, p);
};


const Traversal = function*(ds, indices, seeds) {
  const seedsLeft = (seeds.constructor == Array) ? seeds.slice() : seeds.toJS();
  const todo = {};
  const seen = {};
  indices = (indices.constructor == Array) ? indices : indices.toJS();
  indices.forEach(i => { seen[i] = {}; todo[i] = [] });
  seen[root] = {};

  while (true) {
    let i = null;
    let D = null;
    for (const k in indices) {
      if (todo[indices[k]].length > 0) {
        i = indices[k];
        D = todo[i].shift();
        break;
      }
    }

    if (D == null && seedsLeft.length > 0)
      D = seedsLeft.pop();

    if (D == null)
      return;

    if (!seen[i][D]) {
      const Di = (i == root) ? D : ds.s(i, D);

      indices.forEach(i => {
        if (!seen[i][Di]) {
          if (i < 2)
            todo[i].unshift(Di);
          else
            todo[i].push(Di);
        }
      });

      seen[root][Di] = true;
      seen[i][D]     = true;
      seen[i][Di]    = true;

      yield [D, i, Di];
    }
  }
};

export const traversal = (ds, indices, seeds) =>
  seq(Traversal(ds, indices, seeds));


const root = traversal.root = null;


export const orbitReps = (ds, indices, seeds) =>
  traversal(ds, indices, seeds || ds.elements())
  .filter(e => e[1] == root)
  .map(e => e[2]);


export const orbits = (ds, indices, seeds) => {
  const seen = {};
  const result = [];

  for (const [_, i, D] of traversal(ds, indices, seeds || ds.elements())) {
    if (i == root)
      result.push([]);

    if (D && !seen[D]) {
      seen[D] = true;
      result[result.length - 1].push(D);
    }
  }

  return result;
};


export const isConnected = ds => orbitReps(ds, ds.indices()).length < 2;


export const orbit = (ds, indices, seed) => {
  const seen = {};
  const result = [];

  for (const [_, i, D] of traversal(ds, indices, [seed])) {
    if (D && !seen[D]) {
      seen[D] = true;
      result.push(D);
    }
  }

  return result;
};


export const partialOrientation = ds => {
  const ori = new Array(ds.size + 1);

  for (const [Di, i, D] of traversal(ds, ds.indices(), ds.elements())) {
    if (D && !ori[D])
      ori[D] = i == root ? 1 : -ori[Di];
  }

  return ori;
};


const _forAllEdges = (ds, test) =>
  ds.elements().every(D => ds.indices().every(i => test(D, i)));


export const isLoopless = ds => _forAllEdges(ds, (D, i) => D != ds.s(i, D));


export const isOriented = ds => {
  const ori = partialOrientation(ds);
  return _forAllEdges(ds, (D, i) => ori[D] != ori[ds.s(i, D)]);
};


export const isWeaklyOriented = ds => {
  const ori = partialOrientation(ds);
  const test = (D, Di) => D == Di || ori[D] != ori[Di];
  return _forAllEdges(ds, (D, i) => test(D, ds.s(i, D)));
};


const _protocol = (ds, idcs, gen) => {
  const buffer = [];
  const emap = {};
  let n = 1;

  const _advance = () => {
    const next = gen.next();
    if (next.done)
      return false;
    const entry = next.value;

    const Di = entry[0];
    const i = entry[1];
    const D = entry[2];
    const E = emap[D] || n;

    if (E == n)
      emap[D] = E;

    buffer.push(i == root ? -1 : i);
    buffer.push(emap[Di]);

    if (i != root)
      buffer.push(E);

    if (E == n) {
      for (let i = 0; i < idcs.length - 1; ++i)
        buffer.push(ds.v(idcs[i], idcs[i+1], D));
      ++n;
    }

    return true;
  };

  return {
    get(i) {
      while (buffer.length <= i && _advance())
        ;
      return buffer[i];
    },
    content(fn) {
      while (_advance())
        ;
      return buffer;
    }
  };
};


export const invariant = ds => {
  const idcs = DS.indices(ds);
  let best = null;

  ds.elements().forEach(D0 => {
    const trav = _protocol(ds, idcs, Traversal(ds, idcs, [D0]));

    if (best == null)
      best = trav;
    else {
      for (let i = 0; ; ++i) {
        const next = trav.get(i);
        if (next == undefined)
          break;

        const d = next - best.get(i);
        if (d != 0) {
          if (d < 0)
            best = trav;
          break;
        }
      }
    }
  });

  return best.content();
};


export const morphism = (src, srcD0, img, imgD0) => {
  _assert(isConnected(src), 'source symbol must be connected');
  _assert(src.dim == img.dim, 'dimensions must be equal');

  const idcs = src.indices();
  const tSrc = _typeMap(src);
  const tImg = _typeMap(img);
  const eq = (as, bs) => as <= bs && bs <= as;

  const q = [[srcD0, imgD0]];
  const m = new Array(src.size + 1);
  m[srcD0] = imgD0;

  while (q.length) {
    const [D, E] = q.shift();

    for (const i of idcs) {
      const Di = src.s(i, D);
      const Ei = img.s(i, E);

      if (Di != null || Ei != null) {
        if (m[Di] == null) {
          _assert(
            eq(tSrc[Di], tImg[Ei]),
            `expected type[${Ei}] to be ${tSrc[Di]}, got ${tImg[Ei]}`
          )

          q.push([Di, Ei]);
          m[Di] = Ei;
        }
        else
          _assert(
            m[Di] == Ei,
            `expected m[${Di}] to be ${Ei}, got ${m[Di]}`
          )
      }
    }
  }

  return m;
};


export const automorphisms = ds => {
  _assert(isConnected(ds), 'symbol must be connected');
  const elms = ds.elements();
  if (elms.length) {
    const D = elms[0];
    return elms.map(E => morphism(ds, D, ds, E)).filter(m => m != null);
  }
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

    const trav = traversal(ds, ds.indices(), ds.elements());
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
