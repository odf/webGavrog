import * as freeWords from '../fpgroups/freeWords';
import * as props from './properties';


class Boundary {
  constructor(ds) {
    const m = ds.dim + 1;

    this._ds = ds;
    this._pos = (D, i, j) => (D * m + i) * m + j;
    this._data = new Array((ds.size + 1) * m * m);

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
        const other = k => i + j - k;
        const [chD, kD, nD] = this.opposite([D, i, j]);

        if (D == E) {
          this.setOpposite([chD, kD, other(kD)], [0, 0, nD]);
          this.setOpposite([D, i, j], null);
        }
        else {
          const [chE, kE, nE] = this.opposite([E, i, j]);
          const count = nD + nE;

          this.setOpposite([chD, kD, other(kD)], [chE, kE, count]);
          this.setOpposite([chE, kE, other(kE)], [chD, kD, count]);
          this.setOpposite([D, i, j], null);
          this.setOpposite([E, i, j], null);
        }

        if ((this._ds.s(i, D) == D) == (this._ds.s(kD, chD) == chD))
          todo.push([chD, kD, other(kD)]);
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
      const m = this._ds.m(i, j, D) * (this._ds.s(i, D) == D ? 1 : 2);

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


const spanningTree = ds => {
  const seen = {};
  const todo = [];

  for (const [D, i, E] of props.traversal(ds, ds.indices(), ds.elements())) {
    if (i != null && !seen[E])
      todo.push([D, i]);
    seen[E] = true;
  }

  return todo;
};


const traceWord = (ds, edge2word, i, j, D) => {
  let E = ds.s(i, D);
  let k = j;
  const factors = [];

  while (true) {
    factors.push(edge2word[E][k] || freeWords.empty);
    if (E == D && k == i)
      break;

    E = ds.s(k, E) || E;
    k = k == i ? j : i;
  }

  return freeWords.product(factors);
};


const findGenerators = ds => {
  const edge2word = new Array(ds.size + 1).fill(0).map(_ => []);
  const gen2edge = [[]];

  const bnd = new Boundary(ds);
  bnd.glueRecursively(spanningTree(ds));

  for (const D of ds.elements()) {
    for (const i of ds.indices()) {
      if (ds.indices().some(j => bnd.opposite([D, i, j]))) {
        const gen = gen2edge.length;
        gen2edge.push([D, i]);

        edge2word[D][i] = freeWords.word([gen]);
        edge2word[ds.s(i, D)][i] = freeWords.inverse([gen]);

        for (const [D, i, j] of bnd.glueRecursively([[D, i]])) {
          const w = traceWord(ds, edge2word, i, j, D);
          if (w.length > 0) {
            edge2word[D][i] = freeWords.inverse(w);
            edge2word[ds.s(i, D)][i] = w;
          }
        }
      }
    }
  }

  return { edge2word, gen2edge };
};


export const innerEdges = ds => {
  const glued = (new Boundary(ds)).glueRecursively(spanningTree(ds));
  return glued.map(a => a.slice(0, 2));
}


export const fundamentalGroup = ds => {
  const { edge2word, gen2edge } = findGenerators(ds);

  const nrGenerators = gen2edge.length - 1;
  const cones = [];
  const relators = [];
  const addRelator = wd => relators.push(freeWords.relatorRepresentative(wd));

  for (let g = 1; g <= nrGenerators; ++g) {
    const [D, i] = gen2edge[g];
    if (ds.s(i, D) == D)
      addRelator(freeWords.word([g, g]));
  }

  for (let i = 0; i < ds.dim; ++i) {
    for (let j =  i + 1; j <= ds.dim; ++j) {
      for (const D of props.orbitReps(ds, [i, j])) {
        const word = traceWord(ds, edge2word, i, j, D);
        const degree = ds.v(i, j, D);

        if (degree > 0 && word.length > 0) {
          addRelator(freeWords.raisedTo(degree, word));

          if (degree > 1)
            cones.push([word, degree]);
        }
      }
    }
  }

  cones.sort();
  relators.sort();

  return { nrGenerators, relators, cones, gen2edge, edge2word };
};


if (require.main == module) {
  const delaney = require('./delaney');

  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x && x.toString()).join(', ') + ' ]';
  };

  const test = ds => {
    console.log('ds = '+ds);
    console.log();

    console.log(`    spanning tree: ${JSON.stringify(spanningTree(ds))}`);
    console.log(`    inner edges: ${JSON.stringify(innerEdges(ds))}`);
    console.log();

    const { gen2edge, edge2word } = findGenerators(ds);

    console.log(`    generators: ${JSON.stringify(gen2edge)}`);
    console.log();

    console.log(`    edge words: ${JSON.stringify(edge2word)}`);
    console.log();

    const group = fundamentalGroup(ds);

    console.log(`    relators: ${group.relators}`);
    console.log();

    console.log(`    cones: ${group.cones}`);
    console.log();
    console.log();
  };

  test(delaney.parse(
    `<1.1:24:
    2 4 6 8 10 12 14 16 18 20 22 24,
    16 3 5 7 9 11 13 15 24 19 21 23,
    10 9 20 19 14 13 22 21 24 23 18 17:
    8 4,3 3 3 3>`
  ));

  test(delaney.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));

  test(delaney.parse(
    '<1.1:12:2 5 7 10 11 12,1 4 6 9 7 12 11,3 5 8 6 11 12 10:4 4,6 3 3>'
  ));
}
