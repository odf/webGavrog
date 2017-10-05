import * as I          from 'immutable';
import * as fw         from './freeWords';
import * as generators from '../common/generators';
import * as util       from '../common/util';

import { Partition } from '../common/unionFind';


const partition = () => new Partition();


const mergeRows = (part, ra, rb) => {
  const row    = rb.merge(ra);
  const rowAlt = ra.merge(rb);

  const next = row
    .map((ag, g) => [ag, rowAlt.get(g)])
    .filter(([a, b]) => part.find(a) != part.find(b));

  return { row, next };
};


const identify = (table, part, a, b) => {
  const queue = [[a, b]];
  part = part.clone();

  while (queue.length) {
    const [a, b] = queue.shift().map(x => part.find(x));

    if (a != b) {
      part.union(a, b);
      const { row, next } = mergeRows(part, table.get(a), table.get(b));
      table = table.set(a, row).set(b, row);
      next.forEach(x => queue.push(x));
    }
  }

  return { table, part };
};


const scan = (table, w, start, from, to, inverse = false) => {
  const n = w.size - 1;
  let row = start;
  let i = from;

  while (i < to) {
    const c = inverse ? -w.get(n-i) : w.get(i);
    const next = table.getIn([row, c]);
    if (next === undefined)
      break;
    else {
      ++i;
      row = next;
    }
  }

  return {
    row  : row,
    index: i
  };
};


const scanAndIdentify = (table, part, w, start) => {
  const n = w.size;

  let t = scan(table, w, start, 0, n);
  const head = t.row;
  const i = t.index;

  t = scan(table, w, start, 0, n - i, true);
  const tail = t.row;
  const j = n - t.index;

  let result;

  if (j == i+1)
    result =  {
      table: table.setIn([head, w.get(i)], tail).setIn([tail, -w.get(i)], head),
      part : part,
      next : head
    };
  else if (i == j && head != tail)
    result =  identify(table, part, head, tail);
  else
    result =  {
      table: table,
      part : part
    };

  return result;
};


const scanRelations = (rels, subgens, table, part, start) => {
  let current = {
    table: table,
    part : part
  };

  current = rels.reduce(
    (c, w) => scanAndIdentify(c.table, c.part, w, start),
    current
  );

  return subgens.reduce(
    (c, w) => scanAndIdentify(c.table, c.part, w, c.part.find(0)),
    current
  );
};


const compressed = (table, part) => {
  const toIdx = table
    .map((_, k) => k)
    .filter(k => part.find(k) == k)
    .toMap()
    .flip();

  const canon = a => toIdx.get(part.find(a));

  return table.toMap()
    .filter((r, k) => toIdx.get(k) != undefined)
    .mapKeys(canon)
    .map(row => row.map(canon));
};


const maybeCompressed = (c, factor) => {
  const invalid = c.table.filter(k => c.part.find(k) != k).size / c.table.size;
  if (invalid > factor)
    return { table: compressed(c.table, c.part), part: partition() };
  else
    return c;
};


const _expandGenerators = nrGens =>
  I.Range(1, nrGens+1).concat(I.Range(-1, -(nrGens+1)));


const _expandRelators = relators =>
  I.Set(I.List(relators).flatMap(fw.relatorPermutations));


const withInverses = words => I.Set(words).merge(words.map(fw.inverse));


export const cosetTable = (nrGens, relators, subgroupGens) => {
  const gens = _expandGenerators(nrGens);
  const rels = withInverses(_expandRelators(relators));
  const subgens = withInverses(subgroupGens.map(fw.word));

  let current = {
    table: I.List([I.Map()]),
    part : partition()
  };

  let i = 0, j = 0;

  while (true) {
    if (current.table.size > 10000)
      throw new Error('maximum coset table size reached');

    if (i >= current.table.size) {
      return compressed(current.table, current.part);
    } else if (j >= gens.size || i != current.part.find(i)) {
      ++i;
      j = 0;
    } else if (current.table.getIn([i, gens.get(j)]) !== undefined) {
      ++j;
    } else {
      const g = gens.get(j);
      const n = current.table.size;
      const table = current.table.setIn([i, g], n).setIn([n, -g], i);
      current = maybeCompressed(
        scanRelations(rels, subgens, table, current.part, n));
      ++j;
    }
  }
};


export const cosetRepresentatives = table => {
  let queue = I.List([0]);
  let reps = I.Map([[0, fw.empty]]);

  while (queue.size > 0) {
    const i = queue.first();
    const row = table.get(i);
    const free = row.filter(v => reps.get(v) === undefined);
    reps = reps.merge(free.entrySeq().map(
      e => [e[1], fw.product([reps.get(i), [e[0]]])]));
    queue = queue.shift().concat(free.toList());
  }

  return reps;
};


const _freeInTable = (table, gens) => {
  return I.Range(0, table.size).flatMap(k => (
    gens
      .filter(g => table.get(k).get(g) == null)
      .map(g => ({ index: k, generator: g }))));
};


const _scanRecursively = (rels, table, index) => {
  const q = [];
  const rs = rels.toArray();

  let row = index;
  let t   = table;
  let k   = 0;

  while (k < rs.length || q.length) {
    if (k < rs.length) {
      const rel = rs[k];
      ++k;
      const out = scanAndIdentify(t, partition(), rel, row);
      if (!out.part.isTrivial())
        return;

      t = out.table;
      if (out.next != null)
        q.push(out.next);
    } else {
      row = q.shift();
      k = 0;
    }
  }

  return t;
};


const _potentialChildren = (table, gens, rels, maxCosets) => {
  const free = _freeInTable(table, gens);

  if (!free.isEmpty()) {
    const k = free.first().index;
    const g = free.first().generator;
    const ginv = -g;
    const n = table.size;
    const matches = I.Range(k, n).filter(k => table.getIn([k, ginv]) == null);
    const candidates = n < maxCosets ? I.List(matches).push(n) : matches;

    return candidates
      .map(pos => {
        const t = table.setIn([k, g], pos).setIn([pos, ginv], k);
        return _scanRecursively(rels, t, k);
      })
      .filter(t => t != null);
  }
  else
    return I.List();
};


const _compareRenumberedFom = (table, gens, start) => {
  let o2n = I.Map([[start, 0]]);
  let n2o = I.Map([[0, start]]);
  let row = 0;
  let col = 0;

  while (true) {
    if (row >= o2n.size && row < table.size)
      throw new Error("coset table is not transitive");

    if (row >= table.size)
      return 0;
    else if (col >= gens.size) {
      ++row;
      col = 0;
    } else {
      const oval = table.getIn([row, gens.get(col)]);
      let nval = table.getIn([n2o.get(row), gens.get(col)]);
      if (nval != null && o2n.get(nval) == null) {
        n2o = n2o.set(o2n.size, nval);
        o2n = o2n.set(nval, o2n.size);
      }
      nval = o2n.get(nval);

      if (oval == nval)
        ++col;
      else if (oval == null)
        return -1;
      else if (nval == null)
        return 1;
      else
        return nval - oval;
    }
  }
};


const _isCanonical = (table, gens) => I.Range(1, table.size)
  .every(start => _compareRenumberedFom(table, gens, start) >= 0);


export const tables = (nrGens, relators, maxCosets) => {
  const gens = _expandGenerators(nrGens);
  const rels = _expandRelators(relators);
  const free = t => _freeInTable(t, gens);

  return generators.backtracker({
    root: I.List([I.Map()]),
    extract(table) { return free(table).isEmpty() ? table : undefined },
    children(table) {
      return _potentialChildren(table, gens, rels, maxCosets)
        .filter(t => !t.isEmpty() && _isCanonical(t, gens))
        .toArray();
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
      table.setIn([i, g], n).setIn([n, -g], i);
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
  const timer = util.timer();

  const base = cosetTable(
    3,
    [[1,1], [2,2], [3,3], [1,2,1,2,1,2], [1,3,1,3], fw.raisedTo(3, [2,3])],
    [[1,2]]);

  let t = cosetRepresentatives(base);
  console.log(t.toList(), t.size);

  t = cosetRepresentatives(coreTable(base));
  console.log(t.toList(), t.size);

  console.log(_expandGenerators(4));
  console.log(_expandRelators([[1,2,-3]]));

  for (const x of generators.results(tables(2, [[1,1],[2,2],[1,2,1,2]], 8)))
    console.log(JSON.stringify(x));
}
