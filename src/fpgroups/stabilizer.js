import * as I  from 'immutable';
import * as fw from './freeWords';


const _relatorsByStartGen = relators => I.List(relators).map(I.List)
  .flatMap(fw.relatorPermutations)
  .groupBy(rel => rel.get(0))
  .map(I.Set);


const _inverseGen = g => fw.inverse([g]).first();


const _traceWord = (point, w, edge2word, action) => {
  let p = point;
  const trace = [];
  w.forEach(g => {
    trace.push(edge2word[p][g]);
    p = action(p, g);
  });

  return fw.product(trace);
};


const _closeRelations = (startEdge, wd, edge2word, relsByGen, action) => {
  const queue = [[startEdge, wd]];

  while (queue.length) {
    const [{ point, gen }, w] = queue.shift();

    if (edge2word[point] == null)
      edge2word[point] = {};
    edge2word[point][gen] = w;

    const pg = action(point, gen);
    if (edge2word[pg] == null)
      edge2word[pg] = {};
    edge2word[pg][_inverseGen(gen)] = fw.inverse(w);

    relsByGen.get(gen).forEach(r => {
      let cut = null;
      let w   = null;
      let x   = point;

      for (const i of r.keys()) {
        const h = r.get(i);
        if ((edge2word[x] || {})[h] == null) {
          if (cut == null) {
            cut = { point: x, gen: h };
            w   = fw.inverse(fw.rotated(r, i+1).slice(0, -1));
          }
          else {
            cut = null;
            break;
          }
        }
        x = action(x, h);
      };

      if (cut != null)
        queue.push([cut, _traceWord(cut.point, w, edge2word, action)]);
    });
  }
};


const _spanningTree = (basePoint, nrGens, action) => {
  const gens = I.Range(1, nrGens+1).flatMap(i => [i, -i]);

  const queue = [basePoint];
  const edges = [];
  const seen  = I.Set([basePoint]).asMutable();

  while (queue.length) {
    const point = queue.shift();

    gens.forEach(gen => {
      const p = action(point, gen);
      if (!seen.contains(p)) {
        queue.push(p);
        seen.add(p);
        edges.push({ point, gen });
      }
    });
  }

  return edges;
};


const _insertInOrderedSet = (elm, set, cmp) => {
  let i = 0;
  while (i < set.length && cmp(elm, set[i]) < 0)
    ++i;
  if (i >= set.length || cmp(elm, set[i]) != 0)
    set.splice(i, 0, elm);
};


export const stabilizer = (basePoint, nrGens, relators, domain, action) => {
  const relsByGen = _relatorsByStartGen(relators);
  const tree = _spanningTree(basePoint, nrGens, action);
  const id = fw.empty;

  const point2word = { [basePoint]: id };
  const edge2word = {};

  for (const edge of tree) {
    _closeRelations(edge, id, edge2word, relsByGen, action);
    point2word[action(edge.point, edge.gen)] =
      fw.product([point2word[edge.point], [edge.gen]]);
  }

  const generators = [];
  let lastGen = 0;

  for (const px of domain) {
    const wx = point2word[px];
    for (let i = 1; i <= nrGens; ++i) {
      for (const g of [i, -i]) {
        const edge = { point: px, gen: g };
        if (edge2word[px][g] == null) {
          const py = action(px, g);
          const wy = point2word[py];
          const h = ++lastGen;
          _closeRelations(edge, fw.word([h]), edge2word, relsByGen, action);
          generators.push(fw.product([wx, [g], fw.inverse(wy)]));
        }
      }
    }
  }

  const subrels = [];
  for (const p of domain) {
    for (const r of relators) {
      const w = fw.relatorRepresentative(_traceWord(p, r, edge2word, action));
      if (w && fw.compare(w, fw.empty))
        _insertInOrderedSet(w, subrels, fw.compare);
    }
  }

  return { generators, relators: subrels };
};


if (require.main == module) {
  const mapFn = map => (...args) => args.reduce((s, x) => s[x], map);

  console.log(stabilizer(
    'a',
    3,
    [[1,1],[2,2],[3,3],[1,2,1,2],[1,3,1,3],[2,3,2,3]],
    ['a', 'b', 'c', 'd'],
    mapFn({
      a: { '1': 'b', '2': 'c', '3': 'a', '-1': 'b', '-2': 'c', '-3': 'a' },
      b: { '1': 'a', '2': 'd', '3': 'b', '-1': 'a', '-2': 'd', '-3': 'b' },
      c: { '1': 'd', '2': 'a', '3': 'c', '-1': 'd', '-2': 'a', '-3': 'c' },
      d: { '1': 'c', '2': 'b', '3': 'd', '-1': 'c', '-2': 'b', '-3': 'd' }
    })
  ));

  console.log(stabilizer(
    'a',
    3,
    [[1,2,-1,-2],[1,3,-1,-3],[2,3,-2,-3]],
    ['a', 'b'],
    mapFn({
      a: { '1': 'b', '-1': 'b', '2': 'a', '-2': 'a', '3': 'a', '-3': 'a' },
      b: { '1': 'a', '-1': 'a', '2': 'b', '-2': 'b', '3': 'b', '-3': 'b' }
    })
  ));
}
