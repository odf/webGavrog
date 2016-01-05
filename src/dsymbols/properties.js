import * as I from 'immutable';
import * as DS from './delaney';
import Partition from '../common/partition';


const _assert = function _assert(condition, message) {
  if (!condition)
    throw new Error(message || 'assertion error');
};


const _fold = function _fold(partition, a, b, matchP, spreadFn) {
  let p = partition;
  let q = I.List().push(I.List([a, b]));

  while (!q.isEmpty()) {
    const _tmp = q.first();
    const x = _tmp.get(0);
    const y = _tmp.get(1);

    q = q.rest();

    if (!matchP(x, y))
      return;
    else if (p.get(x) == p.get(y))
      continue;
    else {
      p = p.union(x, y);
      q = q.concat(I.List(spreadFn(x, y)).map(I.List));
    }
  }

  return p;
};


const _typeMap = function _typeMap(ds) {
  const base = I.Map(ds.elements().map(D => [D, I.List()]));
  const idcs = DS.indices(ds);

  return base.withMutations(function(map) {
    idcs.zip(idcs.rest()).forEach(function(p) {
      const i = p[0];
      const j = p[1];

      DS.orbitReps2(ds, i, j).forEach(function(D) {
        const m = DS.m(ds, i, j, D);
        DS.orbit2(ds, i, j, D).forEach(E => {
          map.set(E, map.get(E).push(m));
        });
      });
    });
  });
};


export function isMinimal(ds) {
  const D0 = ds.elements().first();
  const tm = _typeMap(ds);

  const match  = (D, E) => tm.get(D).equals(tm.get(E));
  const spread = (D, E) => ds.indices().map(i => [ds.s(i, D), ds.s(i, E)]);

  return ds.elements().rest()
    .every(D => _fold(Partition(), D0, D, match, spread) === undefined);
};


export function typePartition(ds) {
  const D0 = ds.elements().first();
  const tm = _typeMap(ds);

  const match  = (D, E) => tm.get(D).equals(tm.get(E));
  const spread = (D, E) => ds.indices().map(i => [ds.s(i, D), ds.s(i, E)]);

  return ds.elements().rest().reduce(
    (p, D) => _fold(p, D0, D, match, spread) || p,
    Partition()
  );
};


const Traversal = function Traversal(ds, indices, seeds) {
  const seedsLeft = (seeds.constructor == Array) ? seeds.slice() : seeds.toJS();
  const todo = {};
  const seen = {};
  indices = (indices.constructor == Array) ? indices : indices.toJS();
  indices.forEach(i => { seen[i] = {}; todo[i] = [] });
  seen[root] = {};

  return {
    next() {
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
          return { done: true };

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

          return { done: false, value: [D, i, Di] };
        }
      }
    }
  };
};

export function traversal(ds, indices, seeds) {
  return I.Seq(Traversal(ds, indices, seeds));
};

const root = traversal.root = null;


export function orbitReps(ds, indices, seeds) {
  return traversal(ds, indices, seeds || ds.elements())
    .filter(e => e[1] == root)
    .map(e => e[2]);
};


export function isConnected(ds) {
  return orbitReps(ds, ds.indices()).count() < 2;
};


export function orbit(ds, indices, seed) {
  const seen = I.Set().asMutable();
  const result = I.List().asMutable();

  traversal(ds, indices, [seed]).forEach(function(e) {
    const D = e[2];
    if (D && !seen.contains(D)) {
      seen.add(D);
      result.push(D);
    }
  });

  return result.asImmutable();
};


export function partialOrientation(ds) {
  const ori = I.Map().asMutable();

  traversal(ds, ds.indices(), ds.elements()).forEach(function(e) {
    const Di = e[0];
    const i = e[1];
    const D = e[2];

    if (D && !ori.get(D))
      ori.set(D, i == root ? 1 : -ori.get(Di));
  });

  return ori.asImmutable();
};


export function _forAllEdges(ds, test) {
  return ds.elements().every(D => ds.indices().every(i => test(D, i)));
};


export function isLoopless(ds) {
  return _forAllEdges(ds, (D, i) => D != ds.s(i, D));
};


export function isOriented(ds) {
  const ori = partialOrientation(ds);
  return _forAllEdges(ds, (D, i) => ori.get(D) != ori.get(ds.s(i, D)));
};


export function isWeaklyOriented(ds) {
  const ori = partialOrientation(ds);
  const test = (D, Di) => D == Di || ori.get(D) != ori.get(Di);
  return _forAllEdges(ds, (D, i) => test(D, ds.s(i, D)));
};


const _protocol = function _protocol(ds, idcs, gen) {
  const buffer = [];
  const emap = {};
  let n = 1;

  const _advance = function _advance() {
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


export function invariant(ds) {
  const idcs = DS.indices(ds).toJS();
  let best = null;

  ds.elements().forEach(function(D0) {
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

  return I.List(best.content());
};


export const morphism = (src, srcD0, img, imgD0) => {
  _assert(isConnected(src), 'source symbol must be connected');
  _assert(src.indices().equals(img.indices()), 'index lists must be equal');

  const idcs = src.indices();
  const tSrc = _typeMap(src);
  const tImg = _typeMap(img);
  const match = (m, D, E) =>
    E == m.get(D) || (m.get(D) == null && tSrc.get(D).equals(tImg.get(E)));

  const m = I.Map([[srcD0, imgD0]]).asMutable();
  const q = [[srcD0, imgD0]];

  while (q.length) {
    const [D, E] = q.shift();
    const pairs = idcs
      .map(i => [DS.s(src, i, D), DS.s(img, i, E)])
      .filter(([D, E]) => D != null || E != null);

    if (pairs.every(([D, E]) => match(m, D, E))) {
      pairs.filter(([D]) => m.get(D) == null).forEach(p => { q.push(p) });
      pairs.forEach(([D, E]) => m.set(D, E));
    }
    else
      return null;
  }

  return m.asImmutable();
};


export const automorphisms = ds => {
  _assert(isConnected(ds), 'symbol must be connected');
  const elms = ds.elements();
  if (elms.size) {
    const D = elms.first();
    return elms.map(E => morphism(ds, D, ds, E)).filter(m => m != null);
  }
};


if (require.main == module) {
  const test = function test(ds) {
    console.log('ds = '+ds);
    console.log();

    console.log('    symbol is '+(isConnected(ds) ? '' : 'not ')+'connected.');
    console.log('    symbol is '+(isMinimal(ds) ? '' : 'not ')+'minimal.');
    console.log('    symbol is '+(isLoopless(ds) ? '' : 'not ')+'loopless.');
    console.log('    symbol is '+(isOriented(ds) ? '' : 'not ')+'oriented.');
    console.log('    symbol is '+(isWeaklyOriented(ds) ? '' : 'not ')
                +'weakly oriented.');
    console.log('    type partition: '+typePartition(ds));
    const trav = traversal(ds, ds.indices(), ds.elements());
    console.log('    traversal: ' + trav);
    console.log('    invariant: ' + invariant(ds));
    console.log();

    console.log('    0,1 orbit reps: '+orbitReps(ds, [0, 1]));
    console.log('    1,2 orbit reps: '+orbitReps(ds, [1, 2]));
    console.log('    0,2 orbit reps: '+orbitReps(ds, [0, 2]));
    console.log();

    console.log('    0,1 orbit of 1: '+orbit(ds, [0, 1], 1));
    console.log('    1,2 orbit of 1: '+orbit(ds, [1, 2], 1));
    console.log('    0,2 orbit of 1: '+orbit(ds, [0, 2], 1));
    console.log();

    console.log('    partial orientation: '+partialOrientation(ds));
    console.log();

    console.log('    automorphisms: '+automorphisms(ds));
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
  test(DS.parse('<1.1:6:4 6 5,5 4 6,4 6 5:3,6>'));
}
