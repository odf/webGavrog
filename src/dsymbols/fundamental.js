import * as I from 'immutable';

import * as util       from '../common/util';
import * as freeWords  from '../fpgroups/freeWords';
import * as DS         from './delaney';
import * as properties from './properties';


let _timers = null;

export function useTimers(timers) {
  _timers = timers;
};


const _other = (a, b, c) => a == c ? b : a;


const _glue = function _glue(ds, bnd, D, i) {
  const E = ds.s(i, D);

  return bnd.withMutations(function(map) {
    ds.indices()
      .filter(j => j != i && bnd.getIn([D, i, j]))
      .forEach(function(j) {
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


const _todoAfterGluing = function _todoAfterGluing(ds, bnd, D, i) {
  const onMirror = ds.s(i, D) == D;

  return I.List().withMutations(function(list) {
    ds.indices().forEach(function(j) {
      const opp = bnd.getIn([D, i, j]);

      if (opp) {
        const E = opp.chamber;
        const k = opp.index;
        if (onMirror == (ds.s(k, E) == E))
          list.push(I.List([E, k, _other(i, j, k)]));
      }
    });
  });
};


const _glueRecursively = function _glueRecursively(ds, bnd, facets) {
  _timers && _timers.start('_glueRecursively');

  let boundary = bnd;
  let todo = I.List(facets).map(I.List).asMutable();
  let glued = I.List();

  while (!todo.isEmpty()) {
    const next = todo.first();
    todo.shift();

    const D = next.get(0);
    const i = next.get(1);
    const j = next.get(2);
    const m = DS.m(ds, i, j, D) * (ds.s(i, D) == D ? 1 : 2);

    const opp = boundary.getIn(next);

    if (opp && (j == null || opp.count == m)) {
      _timers && _timers.start('_glueRecursively: new todos after gluing');
      const newTodos = _todoAfterGluing(ds, boundary, D, i);
      _timers && _timers.stop('_glueRecursively: new todos after gluing');

      _timers && _timers.start('_glueRecursively: update todo');
      for (const t of newTodos)
        todo.push(t);
      _timers && _timers.stop('_glueRecursively: update todo');

      _timers && _timers.start('_glueRecursively: glue');
      boundary = _glue(ds, boundary, D, i);
      _timers && _timers.stop('_glueRecursively: glue');

      _timers && _timers.start('_glueRecursively: update list of glued facets');
      glued = glued.push(next);
      _timers && _timers.stop('_glueRecursively: update list of glued facets');
    }
  }

  _timers && _timers.stop('_glueRecursively');

  return I.Map({ boundary: boundary, glued: glued });
};


const _spanningTree = function _spanningTree(ds) {
  const root = properties.traversal.root;
  let seen = I.Set();
  let todo = I.List();

  properties.traversal(ds, ds.indices(), ds.elements()).forEach(function(e) {
    const D = e[0];
    const i = e[1];
    const E = e[2];

    if (i != root && !seen.contains(E))
      todo = todo.push(I.List([D, i]));
    seen = seen.add(E);
  });

  return todo;
};


const _initialBoundary = function _initialBoundary(ds) {
  return I.Map().withMutations(map => {
    ds.elements().forEach(D => {
      ds.indices().forEach(i => {
        ds.indices().forEach(j => {
          if (i != j)
            map.setIn([D, i, j], { chamber: D, index: j, count: 1 });
        });
      });
    });
  });
};


const _traceWord = function _traceWord(ds, edge2word, i, j, D) {
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


const _updatedWordMap = function _updatedWordMap(ds, edge2word, D, i, gen, glued) {
  return edge2word.withMutations(function(e2w) {
    e2w.setIn([D, i], freeWords.word([gen]));
    e2w.setIn([ds.s(i, D), i], freeWords.inverse([gen]));
    glued.rest().forEach(function(e) {
      const D = e.get(0);
      const i = e.get(1);
      const j = e.get(2);
      const w = _traceWord(ds, e2w, i, j, D);

      if (!freeWords.empty.equals(w)) {
        e2w.setIn([D, i], freeWords.inverse(w));
        e2w.setIn([ds.s(i, D), i], w);
      }
    });
  });
};


const _findGenerators = function _findGenerators(ds) {
  _timers && _timers.start('_findGenerators');

  _timers && _timers.start('_findGenerators: initial boundary');
  let boundary = _initialBoundary(ds);
  _timers && _timers.stop('_findGenerators: initial boundary');

  _timers && _timers.start('_findGenerators: spanning tree');
  const tree = _spanningTree(ds);
  _timers && _timers.stop('_findGenerators: spanning tree');

  _timers && _timers.start('_findGenerators: spanning tree gluing');
  boundary = _glueRecursively(ds, boundary, tree).get('boundary');
  _timers && _timers.stop('_findGenerators: spanning tree gluing');

  let edge2word = I.Map();
  let gen2edge = I.Map();

  ds.elements().forEach(function(D) {
    ds.indices().forEach(function(i) {
      if (boundary.getIn([D, i])) {
        _timers && _timers.start('_findGenerators: further gluing');
        const tmp = _glueRecursively(ds, boundary, [[D, i]]);
        _timers && _timers.stop('_findGenerators: further gluing');
        const glued = tmp.get('glued');
        const gen = gen2edge.size+1;

        boundary = tmp.get('boundary');
        gen2edge = gen2edge.set(gen, I.Map({ chamber: D, index: i }));
        _timers && _timers.start('_findGenerators: update word map');
        edge2word = _updatedWordMap(ds, edge2word, D, i, gen, glued);
        _timers && _timers.stop('_findGenerators: update word map');
      }
    })
  });

  _timers && _timers.stop('_findGenerators');

  return I.Map({ edge2word: edge2word, gen2edge: gen2edge });
};


const FundamentalGroup = I.Record({
  nrGenerators: undefined,
  relators    : undefined,
  cones       : undefined,
  gen2edge    : undefined,
  edge2word   : undefined
});


export function innerEdges(ds) {
  return _glueRecursively(ds, _initialBoundary(ds), _spanningTree(ds))
    .get('glued')
    .map(a => a.slice(0, 2));
};


export function fundamentalGroup(ds) {
  _timers && _timers.start('fundamentalGroup');

  _timers && _timers.start('fundamentalGroup: find generators');
  const tmp = _findGenerators(ds);
  const edge2word = tmp.get('edge2word');
  const gen2edge = tmp.get('gen2edge');
  _timers && _timers.stop('fundamentalGroup: find generators');

  _timers && _timers.start('fundamentalGroup: orbits');
  const orbits = ds.indices().flatMap(function(i) {
    return ds.indices().flatMap(function(j) {
      if (j > i)
        return properties.orbitReps(ds, [i, j]).flatMap(function(D) {
          const w = _traceWord(ds, edge2word, i, j, D);
          const v = ds.v(i, j, D);
          if (v && w.size > 0)
            return [[D, i, j, w, v]];
        });
    });
  });
  _timers && _timers.stop('fundamentalGroup: orbits');

  _timers && _timers.start('fundamentalGroup: orbit relators');
  const orbitRelators = orbits.map(orb => freeWords.raisedTo(orb[4], orb[3]));
  _timers && _timers.stop('fundamentalGroup: orbit relators');

  _timers && _timers.start('fundamentalGroup: mirrors');
  const mirrors = gen2edge.entrySeq()
    .filter(function(e) {
      const D = e[1].get('chamber');
      const i = e[1].get('index');
      return ds.s(i, D) == D;
    })
    .map(e => freeWords.word([e[0], e[0]]));
  _timers && _timers.stop('fundamentalGroup: mirrors');

  _timers && _timers.start('fundamentalGroup: cones');
  const cones = orbits
    .filter(orb => orb[4] > 1)
    .map(orb => orb.slice(3))
    .sort();
  _timers && _timers.stop('fundamentalGroup: cones');

  _timers && _timers.start('fundamentalGroup: relators');
  const nGens = gen2edge.size;
  const rels  = orbitRelators.concat(mirrors)
    .map(freeWords.relatorRepresentative)
    .toSet()
    .sort();
  _timers && _timers.stop('fundamentalGroup: relators');

  _timers && _timers.stop('fundamentalGroup');

  return FundamentalGroup({
    nrGenerators: nGens,
    relators    : rels,
    cones       : cones,
    gen2edge    : gen2edge,
    edge2word   : edge2word
  });
};


if (require.main == module) {
  const test = function test(ds) {
    console.log('ds = '+ds);
    console.log();

    console.log('    spanning tree: '+JSON.stringify(_spanningTree(ds)));
    console.log('    inner edges: '+JSON.stringify(innerEdges(ds)));
    console.log();

    const gens = _findGenerators(ds);

    console.log('    generators: '+gens.get('gen2edge'));
    console.log();

    console.log('    edge words: '+gens.get('edge2word'));
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
