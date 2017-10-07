import * as I  from 'immutable';
import * as fw from './freeWords';


const _relatorsByStartGen = function _relatorsByStartGen(relators) {
  return I.List(relators).map(I.List)
    .flatMap(fw.relatorPermutations)
    .groupBy(rel => rel.get(0))
    .map(I.Set);
};


const _inverseGen = g => fw.inverse([g]).first();


const _traceWord = (point, w, edge2word, action) => {
  let p = point;
  const trace = [];
  w.forEach(g => {
    trace.push(edge2word.getIn([p, g]));
    p = action(p, g);
  });

  return fw.product(trace);
};


const _closeRelations = (startEdge, wd, edge2word, relsByGen, action) => {
  const queue = [[startEdge, wd]];

  while (queue.length) {
    const [{ point, gen }, w] = queue.shift();

    edge2word.setIn([point, gen], w);
    edge2word.setIn([action(point, gen), _inverseGen(gen)], fw.inverse(w));

    relsByGen.get(gen).forEach(function(r) {
      let cut = null;
      let w   = null;
      let x   = point;

      for (const i of r.keys()) {
        const h = r.get(i);
        if (edge2word.getIn([x, h]) == null) {
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


const _spanningTree = function _spanningTree(basePoint, nrGens, action) {
  const gens = I.Range(1, nrGens+1).flatMap(i => [i, -i]);

  const queue = [basePoint];
  const edges = [];
  const seen  = I.Set([basePoint]).asMutable();

  while (queue.length) {
    const point = queue.shift();

    gens.forEach(function(gen) {
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


export const stabilizer = (basePoint, nrGens, relators, domain, action) => {
  const relsByGen = _relatorsByStartGen(relators);
  const tree = _spanningTree(basePoint, nrGens, action);
  const gens = I.Range(1, nrGens+1).flatMap(i => [i, -i]);
  const id = fw.empty;

  const point2word = I.Map([[basePoint, id]]).asMutable();
  const edge2word = I.Map().asMutable();

  tree.forEach(function(edge) {
    _closeRelations(edge, id, edge2word, relsByGen, action);
    point2word.set(
      action(edge.point, edge.gen),
      fw.product([point2word.get(edge.point), [edge.gen]]));
  });

  const generators = [];
  let lastGen = 0;

  domain.forEach(function(px) {
    const wx = point2word.get(px);
    gens.forEach(function(g) {
      const edge = { point: px, gen: g };
      if (edge2word.getIn([px, g]) == null) {
        const py = action(px, g);
        const wy = point2word.get(py);
        const h = ++lastGen;
        _closeRelations(edge, fw.word([h]), edge2word, relsByGen, action);
        generators.push(fw.product([wx, [g], fw.inverse(wy)]));
      }
    });
  });

  const subrels = I.Set().asMutable();
  for (const p of domain) {
    for (const r of relators) {
      const w = fw.relatorRepresentative(_traceWord(p, r, edge2word, action));
      if (w && w.size)
        subrels.add(w);
    }
  }

  return { generators: I.List(generators), relators: subrels.sort(fw.compare) };
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
