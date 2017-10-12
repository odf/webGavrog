import * as I          from 'immutable';
import * as fw         from './freeWords';
import * as generators from '../common/generators';

import { Partition } from '../common/unionFind';


const range = (from, to) => {
  if (to < from)
    return new Array(from - to).fill(0).map((_, i) => from - i);
  else
    return new Array(to - from).fill(0).map((_, i) => from + i);
};


class CosetTable {
  constructor(nrGens) {
    this.nrGens = nrGens;
    this.table = [new Array(2 * nrGens + 1)];
    this.part = new Partition();
  }

  clone() {
    const t = new CosetTable(this.nrGens);
    t.table = this.table.slice().map(row => row.slice());
    t.part = this.part.clone();
    return t;
  }

  get size() {
    return this.table.length;
  }

  get(c, g) {
    return (this.table[c] || [])[g + this.nrGens];
  }

  set(c, g, d) {
    if (c == null)
      throw new Error('oops!');
    if (this.table[c] == null)
      this.table[c] = new Array(2 * this.nrGens + 1);
    this.table[c][g + this.nrGens] = d;
  }

  join(c, d, g) {
    this.set(c, g, d);
    this.set(d, -g, c);
  }

  canon(c) {
    return this.part.find(c);
  }

  identify(a, b) {
    const queue = [[a, b]];

    while (queue.length) {
      const [a, b] = queue.shift().map(x => this.canon(x));

      if (a != b) {
        this.part.union(a, b);

        for (const g of this.allGens()) {
          const ag = this.get(a, g);
          const bg = this.get(b, g);
          if (ag == null)
            this.set(a, g, bg);
          else {
            if (bg != null && this.canon(ag) != this.canon(bg))
              queue.push([ag, bg]);
            this.set(b, g, ag);
          }
        }
      }
    }
  }

  asCompactMatrix() {
    const toIdx = {};
    let i = 0;
    for (const k of range(0, this.table.length)) {
      if (this.canon(k) == k) {
        toIdx[k] = i;
        ++i;
      }
    }

    const result = [];
    for (const k of range(0, this.table.length)) {
      if (toIdx[k] != null) {
        const row = [];
        for (const g of this.allGens())
          row.push(toIdx[this.canon(this.get(k, g))]);
        result.push(row);
      }
    }

    return result;
  }
}


CosetTable.prototype.allGens = function*() {
  for (let i = 1; i <= this.nrGens; ++i)
    yield i;
  for (let i = 1; i <= this.nrGens; ++i)
    yield -i;
}


const scan = (table, w, start, limit) => {
  let row = start;
  let i = 0;

  while (i < limit) {
    const next = table.get(row, w.get(i));
    if (next == null)
      break;
    else {
      ++i;
      row = next;
    }
  }

  return { row, index: i };
};


const scanAndIdentify = (table, w, start) => {
  const n = w.size;
  const { row: head, index: i } = scan(table, w, start, n);
  const { row: tail, index: j } = scan(table, fw.inverse(w), start, n - i);

  if (i + j == n - 1) {
    table.join(head, tail, w.get(i));
    return head;
  }
  else if (i + j == n && head != tail)
    table.identify(head, tail);
};


const _insertInOrderedSet = (elm, set, cmp) => {
  let i = 0;
  while (i < set.length && cmp(elm, set[i]) < 0)
    ++i;
  if (i >= set.length || cmp(elm, set[i]) != 0)
    set.splice(i, 0, elm);
};


const _expandRelators = relators => {
  const out = [];
  for (const rel of relators) {
    for (const w of fw.relatorPermutations(rel))
      _insertInOrderedSet(w, out, fw.compare);
  }
  return out;
};


export const cosetTable = (nrGens, relators, subgroupGens) => {
  const rels = _expandRelators(relators);
  const table = new CosetTable(nrGens);

  for (let i = 0; i < table.size; ++i) {
    if (i != table.canon(i))
      continue;

    for (const g of table.allGens()) {
      if (table.get(i, g) == null) {
        const n = table.size;
        if (n >= 10000)
          throw new Error('maximum coset table size reached');

        table.join(i, n, g);
        for (const w of rels)
          scanAndIdentify(table, w, n);
        for (const w of subgroupGens)
          scanAndIdentify(table, fw.word(w), table.canon(0));
      }
    }
  }

  return table.asCompactMatrix();
};


export const cosetRepresentatives = table => {
  const queue = [0];
  const reps = [fw.empty];

  while (queue.length) {
    const i = queue.shift();
    const w = reps[i];

    for (const [g, k] of table.get(i).filter(g => reps[g] == null)) {
      reps[k] = fw.product([w, [g]]);
      queue.push(k);
    }
  }

  return reps;
};


const _firstFreeInTable = (table, gens) => {
  for (let k = 0; k < table.size; ++k) {
    for (const g of gens) {
      if (table.getIn([k, g]) == null)
        return [k, g];
    }
  }
};


const _scanRecursively = (rels, table, index) => {
  const p = () => new Partition();
  const q = [index];

  while (q.length) {
    const row = q.shift();

    for (const rel of rels) {
      const { table: t, part, next } = scanAndIdentify(table, p(), rel, row);

      if (part.isTrivial()) {
        table = t;
        if (next != null)
          q.push(next);
      }
      else
        return;
    }
  }

  return table;
};


const _potentialChildren = (table, gens, rels, maxCosets) => {
  const [k, g] = _firstFreeInTable(table, gens) || [];
  const result = [];

  if (k != null) {
    const ginv = -g;
    const limit = Math.min(table.size + 1, maxCosets);

    for (let pos = k; pos < limit; ++pos) {
      if (table.getIn([pos, ginv]) == null) {
        const t = _scanRecursively(rels, _joinInTable(table, k, pos, g), k);
        if (t != null)
          result.push(t);
      }
    }
  }

  return result;
};


const _compareRenumberedFom = (table, gens, start) => {
  const n2o = [start];
  const o2n = { [start]: 0 };

  for (let row = 0; row < table.size; ++row) {
    if (row >= n2o.length)
      throw new Error("coset table is not transitive");

    for (const g of gens) {
      const t = table.getIn([n2o[row], g]);
      if (t != null && o2n[t] == null) {
        o2n[t] = n2o.length;
        n2o.push(t);
      }

      const nval = o2n[t];
      const oval = table.getIn([row, g]);
      if (oval != nval)
        return oval == null ? -1 : nval == null ? 1 : nval - oval;
    }
  }

  return 0;
};


const _isCanonical = (table, gens) => range(1, table.size)
  .every(start => _compareRenumberedFom(table, gens, start) >= 0);


export const tables = (nrGens, relators, maxCosets) => {
  const gens = _expandGenerators(nrGens);
  const rels = _expandRelators(relators);

  return generators.backtracker({
    root: emptyCosetTable(),

    extract(table) {
      return _firstFreeInTable(table, gens) == null ? table : null;
    },

    children(table) {
      return _potentialChildren(table, gens, rels, maxCosets)
        .filter(t => t.size && _isCanonical(t, gens));
    }
  });
};


const _inducedTable = (gens, img, img0) => {
  const table = emptyCosetTable().asMutable();
  const o2n = { [img0]: 0 };
  const n2o = [img0];

  for (let i = 0; i < table.size; ++i) {
    for (const g of gens) {
      const k = img(n2o[i], g);
      if (o2n[k] == null)
        o2n[k] = table.size;
      const n = o2n[k];
      n2o[n] = k;
      _joinInTable(table, i, n, g);
    }
  }

  return table.asImmutable();
};


export const intersectionTable = (tableA, tableB) =>
  _inducedTable(
    tableA.first().keySeq(),
    (es, g) => [tableA.getIn([es[0], g]), tableB.getIn([es[1], g])],
    [0, 0]
  );


export const coreTable = base =>
  _inducedTable(
    base.first().keySeq(),
    (es, g) => es.map(e => base.getIn([e, g])),
    base.keySeq().toArray()
  );


const _sgn = x => (x > 0) - (x < 0);
const _sum = a => a.reduce((x, y) => x + y, 0);


export const relatorAsVector = (rel, nrgens) => {
  const out = new Array(nrgens).fill(0);

  for (const w of rel) {
    if (w < 0)
      --out[-w - 1];
    else if (w > 0)
      ++out[w - 1];
  }

  return out;
};


export const relatorMatrix = (nrgens, relators) =>
  relators.map(rel => relatorAsVector(rel, nrgens));


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x && x.toString()).join(', ') + ' ]';
  };

  const test = table => {
    console.log(table);
    const reps = cosetRepresentatives(table);
    console.log(JSON.stringify(reps), Object.keys(reps).length);
  };

  const base = cosetTable(
    3,
    [[1,1], [2,2], [3,3], [1,2,1,2,1,2], [1,3,1,3], fw.raisedTo(3, [2,3])],
    [[1,2]]);

  test(base);
  test(coreTable(base));

  console.log(_expandGenerators(4));
  console.log(_expandRelators([[1,2,-3]]));

  for (const x of generators.results(tables(2, [[1,1],[2,2],[1,2,1,2]], 8)))
    console.log(JSON.stringify(x));
}
