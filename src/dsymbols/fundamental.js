import * as I from 'immutable';

import * as freeWords from '../fpgroups/freeWords';
import * as DS        from './delaney';
import * as props     from './properties';


const _other = (a, b, c) => a == c ? b : a;


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


class Boundary {
  constructor(ds) {
    const m = ds.dim + 1;

    this._ds = ds;
    this._pos = (D, i, j) => ((D - 1) * m + i) * m + j;
    this._data = new Array(ds.size * m * m);

    for (const D of ds.elements()) {
      for (const i of ds.indices()) {
        for (const j of ds.indices()) {
          if (i != j)
            this.setOpposite([D, i, j], [D, j, 1]);
        }
      }
    }
  }

  opposite([D, i, j]) {
    return this._data[this._pos(D, i, j)];
  }

  setOpposite([D, i, j], val) {
    this._data[this._pos(D, i, j)] = val;
  }

  glue(D, i) {
    const todo = [];
    const E = this._ds.s(i, D);

    for (const j of this._ds.indices()) {
      if (j != i && this.opposite([D, i, j])) {
        const [chD, kD, nD] = this.opposite([D, i, j]);
        const [chE, kE, nE] = this.opposite([E, i, j]);
        const count = D == E ? nD : nD + nE;

        this.setOpposite([chD, kD, _other(i, j, kD)], [chE, kE, count]);
        this.setOpposite([chE, kE, _other(i, j, kE)], [chD, kD, count]);
        this.setOpposite([D, i, j], null);
        this.setOpposite([E, i, j], null);

        if ((this._ds.s(i, D) == D) == (this._ds.s(kD, chD) == chD))
          todo.push([chD, kD, _other(i, j, kD)]);
      }
    }

    return todo;
  }

  glueRecursively(facets) {
    const todo = facets.slice();
    const glued = [];

    while (todo.length) {
      const next = todo.shift();
      const [D, i, j] = next;
      const m = DS.m(this._ds, i, j, D) * (this._ds.s(i, D) == D ? 1 : 2);

      if (j == null || (this.opposite(next) || [])[2] == m) {
        const newTodo = this.glue(D, i);
        for (const e of newTodo)
          todo.push(e);

        glued.push(next);
      }
    }

    return glued;
  }
}


const _findGenerators = ds => {
  const edge2word = I.Map().asMutable();
  const gen2edge = [[]];

  const bnd = new Boundary(ds);
  bnd.glueRecursively(_spanningTree(ds));

  for (const D of ds.elements()) {
    for (const i of ds.indices()) {
      if (ds.indices().some(j => bnd.opposite([D, i, j]))) {
        const gen = gen2edge.length;
        const glued = bnd.glueRecursively([[D, i]]);

        gen2edge.push([D, i]);

        edge2word.setIn([D, i], freeWords.word([gen]));
        edge2word.setIn([ds.s(i, D), i], freeWords.inverse([gen]));

        for (const [D, i, j] of glued) {
          const w = _traceWord(ds, edge2word, i, j, D);
          if (!freeWords.empty.equals(w)) {
            edge2word.setIn([D, i], freeWords.inverse(w));
            edge2word.setIn([ds.s(i, D), i], w);
          }
        }
      }
    }
  }

  return { edge2word: edge2word.asImmutable(), gen2edge };
};


const innerEdges = ds => {
  const bnd = new Boundary(ds);
  return bnd.glueRecursively(_spanningTree(ds)).map(a => a.slice(0, 2));
}


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

    console.log(`    spanning tree: ${JSON.stringify(_spanningTree(ds))}`);
    console.log(`    inner edges: ${JSON.stringify(innerEdges(ds))}`);
    console.log();

    const { gen2edge, edge2word } = _findGenerators(ds);

    console.log(`    generators: ${JSON.stringify(gen2edge)}`);
    console.log();

    console.log(`    edge words: ${edge2word}`);
    console.log();

    const group = fundamentalGroup(ds);

    console.log(`    relators: ${group.relators}`);
    console.log();

    console.log(`    cones: ${group.cones}`);
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
}
