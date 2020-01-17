import * as fw from './freeWords';


const _relatorsByStartGen = relators => {
  const result = {};

  for (const w of fw.expandedRelators(relators)) {
    if (result[w[0]] == null)
      result[w[0]] = [];

    result[w[0]].push(w);
  }

  return result;
};


const _traceWord = (point, w, edge2word, action) => {
  let p = point;
  const trace = [];

  for (const g of w) {
    trace.push(edge2word[p][g]);
    p = action(p, g);
  }

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
    edge2word[pg][-gen] = fw.inverse(w);

    for (const r of relsByGen[gen]) {
      let cut = null;
      let w = null;
      let x = point;

      for (let i = 0; i < r.length; ++i) {
        const h = r[i];
        if ((edge2word[x] || {})[h] == null) {
          if (cut == null) {
            cut = { point: x, gen: h };
            w = fw.inverse(fw.rotated(r, i+1).slice(0, -1));
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
    }
  }
};


const _spanningTree = (basePoint, nrGens, action) => {
  const queue = [basePoint];
  const edges = [];
  const seen  = { [basePoint]: true };

  while (queue.length) {
    const point = queue.shift();

    for (let i = 1; i <= nrGens; ++i) {
      for (const gen of [i, -i]) {
        const p = action(point, gen);
        if (!seen[p]) {
          queue.push(p);
          seen[p] = true;
          edges.push({ point, gen });
        }
      }
    }
  }

  return edges;
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
        if ((edge2word[px] || {})[g] == null) {
          const py = action(px, g);
          const wy = point2word[py];
          const h = ++lastGen;
          _closeRelations(edge, fw.word([h]), edge2word, relsByGen, action);
          generators.push(fw.product([wx, [g], fw.inverse(wy)]));
        }
      }
    }
  }

  const seen = {};
  const subrels = [];
  for (const p of domain) {
    for (const r of relators) {
      const w = fw.relatorRepresentative(_traceWord(p, r, edge2word, action));
      if (w && w.length && !seen[w]) {
        seen[w] = true;
        subrels.push(w);
      }
    }
  }
  subrels.sort(fw.compare).reverse();

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

  console.log(stabilizer(
    'a',
    4,
    [[2,2],[3,3],[4,4],[1,2,-1,-2],[1,3,-1,-3],[1,4,-1,-4],[2,4,3,2,4,3]],
    ['a', 'b'],
    mapFn({
      a: {
        '1': 'a', '-1': 'a',
        '2': 'b', '-2': 'b',
        '3': 'b', '-3': 'b',
        '4': 'b', '-4': 'b'
      },
      b: {
        '1': 'b', '-1': 'b',
        '2': 'a', '-2': 'a',
        '3': 'a', '-3': 'a',
        '4': 'a', '-4': 'a'
      },
    })
  ));
}
