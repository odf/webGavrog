import * as I from 'immutable';

import * as freeWords from '../fpgroups/freeWords';
import * as DS        from './delaney';
import * as props     from './properties';


const _other = (a, b, c) => a == c ? b : a;


const _glue = (ds, bnd, D, i) => {
  const E = ds.s(i, D);

  return bnd.withMutations(map => {
    ds.indices()
      .filter(j => j != i && bnd.getIn([D, i, j]))
      .forEach(j => {
        const oppD = bnd.getIn([D, i, j]);
        const oppE = bnd.getIn([E, i, j]);
        const count = D == E ? oppD.count : oppD.count + oppE.count;
        map.setIn([oppD.chamber, oppD.index, _other(i, j, oppD.index)],
                  { chamber: oppE.chamber, index: oppE.index, count: count });
        map.setIn([oppE.chamber, oppE.index, _other(i, j, oppE.index)],
                  { chamber: oppD.chamber, index: oppD.index, count: count });
      });
    map.deleteIn([D, i]).deleteIn([E, i]);
  });
};


const _todoAfterGluing = function*(ds, bnd, D, i) {
  const onMirror = ds.s(i, D) == D;

  for (const j of ds.indices()) {
    const { chamber: E, index: k } = bnd.getIn([D, i, j]) || {};

    if (E != null && onMirror == (ds.s(k, E) == E))
      yield [E, k, _other(i, j, k)];
  }
};


const _glueRecursively = (ds, bnd, facets) => {
  const todo = facets.slice();
  const glued = [];
  let boundary = bnd;

  while (todo.length) {
    const next = todo.shift();
    const [D, i, j] = next;
    const m = DS.m(ds, i, j, D) * (ds.s(i, D) == D ? 1 : 2);

    const opp = boundary.getIn(next);

    if (opp && (j == null || opp.count == m)) {
      for (const t of _todoAfterGluing(ds, boundary, D, i))
        todo.push(t);

      boundary = _glue(ds, boundary, D, i);
      glued.push(next);
    }
  }

  return { boundary, glued };
};


const _spanningTree = ds => {
  const seen = {};
  const todo = [];

  for (const [D, i, E] of props.traversal(ds, ds.indices(), ds.elements())) {
    if (i != props.traversal.root && !seen[E])
      todo.push([D, i]);
    seen[E] = true;
  }

  return todo;
};


const _initialBoundary = ds => {
  const bnd = I.Map().asMutable();

  for (const D of ds.elements()) {
    for (const i of ds.indices()) {
      for (const j of ds.indices()) {
        if (i != j)
          bnd.setIn([D, i, j], { chamber: D, index: j, count: 1 });
      }
    }
  }

  return bnd.asImmutable();
};


const _traceWord = (ds, edge2word, i, j, D) => {
  let E = ds.s(i, D);
  let k = j;
  const factors = [];

  while(true) {
    factors.push(edge2word.getIn([E, k]) || freeWords.empty);
    if (E == D && k ==i)
      break;

    E = ds.s(k, E) || E;
    k = _other(i, j, k);
  }

  return freeWords.product(factors);
};


const _findGenerators = ds => {
  const tree = _spanningTree(ds);

  const edge2word = I.Map().asMutable();
  const gen2edge = [[]];

  let boundary = _glueRecursively(ds, _initialBoundary(ds), tree).boundary;

  ds.elements().forEach(D => {
    ds.indices().forEach(i => {
      if (boundary.getIn([D, i])) {
        const gen = gen2edge.length;
        const tmp = _glueRecursively(ds, boundary, [[D, i]]);

        boundary = tmp.boundary;
        gen2edge.push([D, i]);

        edge2word.setIn([D, i], freeWords.word([gen]));
        edge2word.setIn([ds.s(i, D), i], freeWords.inverse([gen]));
        for (const [D, i, j] of tmp.glued) {
          const w = _traceWord(ds, edge2word, i, j, D);

          if (!freeWords.empty.equals(w)) {
            edge2word.setIn([D, i], freeWords.inverse(w));
            edge2word.setIn([ds.s(i, D), i], w);
          }
        }
      }
    })
  });

  return { edge2word: edge2word.asImmutable(), gen2edge };
};


const innerEdges = ds =>
  _glueRecursively(ds, _initialBoundary(ds), _spanningTree(ds)).glued
  .map(a => a.slice(0, 2));


export const fundamentalGroup = ds => {
  const { edge2word, gen2edge } = _findGenerators(ds);

  const orbits = [];
  for (const i of ds.indices()) {
    for (const j of ds.indices()) {
      if (j > i) {
        for (const D of props.orbitReps(ds, [i, j])) {
          const w = _traceWord(ds, edge2word, i, j, D);
          const v = ds.v(i, j, D);
          if (v && w.size > 0)
            orbits.push([D, i, j, w, v]);
        }
      }
    }
  }

  const orbitRelators = orbits.map(orb => freeWords.raisedTo(orb[4], orb[3]));

  const mirrors = gen2edge
    .map(([D, i], g) => [D, i, g])
    .filter(([D, i, g]) => g > 0 && ds.s(i, D) == D)
    .map(([D, _, g]) => freeWords.word([g, g]));

  const cones = orbits
    .filter(orb => orb[4] > 1)
    .map(orb => orb.slice(3))
    .sort();

  const nrGenerators = gen2edge.length - 1;
  const relators =
    I.Set(orbitRelators.concat(mirrors).map(freeWords.relatorRepresentative))
    .sort();

  return { nrGenerators, relators, cones, gen2edge, edge2word };
};


if (require.main == module) {
  const test = ds => {
    console.log('ds = '+ds);
    console.log();

    console.log('    spanning tree: '+JSON.stringify(_spanningTree(ds)));
    console.log('    inner edges: '+JSON.stringify(innerEdges(ds)));
    console.log();

    const { gen2edge, edge2word } = _findGenerators(ds);

    console.log('    generators: '+JSON.stringify(gen2edge));
    console.log();

    console.log('    edge words: '+edge2word);
    console.log();

    const group = fundamentalGroup(ds);

    console.log('    relators: '+group.relators);
    console.log();

    console.log('    cones: '+group.cones);
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
