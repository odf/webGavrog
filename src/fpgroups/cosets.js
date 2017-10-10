import * as I          from 'immutable';
import * as fw         from './freeWords';
import * as generators from '../common/generators';

import { Partition } from '../common/unionFind';


const _joinInTable = (t, a, b, g) => t.setIn([a, g], b).setIn([b, -g], a);


const identify = (table, part, a, b) => {
  part = part.clone();
  table = table.asMutable();

  const queue = [[a, b]];

  while (queue.length) {
    const [a, b] = queue.shift().map(x => part.find(x));

    if (a != b) {
      part.union(a, b);

      for (const [g, bg] of table.get(b)) {
        const ag = table.getIn([a, g]);
        if (ag == null)
          table.setIn([a, g], bg);
        else if (part.find(ag) != part.find(bg))
          queue.push([ag, bg]);
      }
      table.set(b, table.get(a));
    }
  }

  return { table: table.asImmutable(), part };
};


const scan = (table, w, start, limit) => {
  let row = start;
  let i = 0;

  while (i < limit) {
    const next = table.getIn([row, w.get(i)]);
    if (next == null)
      break;
    else {
      ++i;
      row = next;
    }
  }

  return { row, index: i };
};


const scanAndIdentify = (table, part, w, start) => {
  const n = w.size;
  const { row: head, index: i } = scan(table, w, start, n);
  const { row: tail, index: j } = scan(table, fw.inverse(w), start, n - i);

  if (i + j == n - 1) {
    table = _joinInTable(table, head, tail, w.get(i));
    return { table, part, next: head };
  }
  else if (i + j == n && head != tail)
    return identify(table, part, head, tail);
  else
    return { table, part };
};


const compressed = (table, part) => {
  const toIdx = {};
  let i = 0;
  for (const k of table.keySeq()) {
    if (part.find(k) == k) {
      toIdx[k] = i;
      ++i;
    }
  }

  const canon = a => toIdx[part.find(a)];

  return table.toMap()
    .filter((r, k) => toIdx[k] != null)
    .mapKeys(canon)
    .map(row => row.map(canon));
};


const _expandGenerators = nrGens =>
  I.Range(1, nrGens+1).concat(I.Range(-1, -(nrGens+1)));


const _expandRelators = relators =>
  I.Set(I.List(relators).flatMap(fw.relatorPermutations));


export const cosetTable = (nrGens, relators, subgroupGens) => {
  const gens = _expandGenerators(nrGens);
  const rels = _expandRelators(relators);

  let table = I.List([I.Map()]);
  let part = new Partition();

  for (let i = 0; i < table.size; ++i) {
    if (i != part.find(i))
      continue;

    for (const g of gens) {
      if (table.getIn([i, g]) == null) {
        const n = table.size;
        if (n >= 10000)
          throw new Error('maximum coset table size reached');

        let t = { table: _joinInTable(table, i, n, g), part };
        for (const w of rels)
          t = scanAndIdentify(t.table, t.part, w, n);
        for (const w of subgroupGens)
          t = scanAndIdentify(t.table, t.part, fw.word(w), part.find(0));

        table = t.table;
        part = t.part;
      }
    }
  }

  return compressed(table, part);
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


const _isCanonical = (table, gens) => I.Range(1, table.size)
  .every(start => _compareRenumberedFom(table, gens, start) >= 0);


export const tables = (nrGens, relators, maxCosets) => {
  const gens = _expandGenerators(nrGens);
  const rels = _expandRelators(relators);
  const isFull = t => _firstFreeInTable(t, gens) == null;

  return generators.backtracker({
    root: I.List([I.Map()]),
    extract(table) { return isFull(table) ? table : null },
    children(table) {
      return _potentialChildren(table, gens, rels, maxCosets)
        .filter(t => !t.isEmpty() && _isCanonical(t, gens));
    }
  });
};


const _inducedTable = (gens, img, img0) => {
  const table = I.List([I.Map()]).asMutable();
  const o2n = I.Map([[img0, 0]]).asMutable();
  const n2o = I.Map([[0, img0]]).asMutable();
  let i = 0;

  while (i < table.size) {
    gens.forEach(g => {
      const k = img(n2o.get(i), g);
      const n = o2n.has(k) ? o2n.get(k) : table.size;
      o2n.set(k, n);
      n2o.set(n, k);
      _joinInTable(table, i, n, g);
    });
    ++i;
  }

  return table.asImmutable();
};


export const intersectionTable = (tableA, tableB) => {
  return _inducedTable(
    (tableA.first() || I.Map()).keySeq(),
    (es, g) => I.List([tableA.getIn([es.get(0), g]),
                       tableB.getIn([es.get(1), g])]),
    I.List([0, 0])
  );
};


export const coreTable = base =>
  _inducedTable(
    (base.first() || I.Map()).keySeq(),
    (es, g) => es.map(e => base.getIn([e, g])),
    base.keySeq()
  );


const _sgn = x => (x > 0) - (x < 0);
const _sum = a => a.reduce((x, y) => x + y, 0);


export const relatorAsVector = (rel, nrgens) => {
  const counts = rel.groupBy(Math.abs).map(a => _sum(a.map(_sgn)));
  return I.List(I.Range(1, nrgens+1).map(i => counts.get(i) || 0));
};


export const relatorMatrix = (nrgens, relators) =>
  I.List(relators).map(rel => relatorAsVector(rel, nrgens));


if (require.main == module) {
  const test = table => {
    const reps = cosetRepresentatives(table);
    console.log(I.fromJS(reps), Object.keys(reps).length);
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
