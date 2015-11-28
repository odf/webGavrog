import * as I  from 'immutable';
import * as fw from './freeWords';


const _relatorsByStartGen = function _relatorsByStartGen(relators) {
  return I.List(relators).map(I.List)
    .flatMap(fw.relatorPermutations)
    .groupBy(rel => rel.get(0))
    .map(I.Set);
};


const _sgn = x => (x > 0) - (x < 0);

const _cmpGens = function(a, b) {
  if (_sgn(a) != _sgn(b))
    return _sgn(b) - _sgn(a);
  else
    return Math.abs(a) - Math.abs(b);
};


const _cmpWords = function _cmpWords(a, b) {
  const n = Math.min(a.size, b.size);
  for (let i = 0; i < n; ++i) {
    const d = _cmpGens(a.get(i), b.get(i));
    if (d)
      return d;
  }
  if (a.size > n)
    return 1;
  else if (b.size > n)
    return -1;
  else
    return 0;
};


const Edge = I.Record({
  point: undefined,
  gen  : undefined
});


const _inverseGen = g => fw.inverse([g]).first();


const _reverseEdge = (edge, action) => new Edge({
  point: action(edge.point, edge.gen),
  gen  : _inverseGen(edge.gen)
});


const _traceWord = function _traceWord(point, w, edge2word, action) {
  let p = point;
  let trace = fw.empty;
  w.forEach(function(g) {
    const t = edge2word.get(new Edge({ point: p, gen: g }));
    trace = fw.product([trace, t]);
    p = action(p, g);
  });

  return trace;
};


const _closeRelations = function _closeRelations(
  startEdge,
  edge2word,
  relsByGen,
  action
) {
  let queue = I.List([startEdge]);

  while (!queue.isEmpty()) {
    const next = queue.first();
    queue = queue.rest();

    const p = next.point;
    const g = next.gen;

    relsByGen.get(g).forEach(function(r) {
      let x = p;
      let cuts = I.List();
      r.forEach(function(h, i) {
        const next = new Edge({ point: x, gen: h });
        if (edge2word.get(next) == null)
          cuts = cuts.push([i, next]);
        x = action(x, h);
      });

      if (cuts.size == 1) {
        const i = cuts.first()[0];
        const cut = cuts.first()[1];
        const w = fw.inverse(fw.rotated(r, i+1).slice(0, -1));
        const trace = _traceWord(cut.point, w, edge2word, action);

        edge2word = edge2word
          .set(cut, trace)
          .set(_reverseEdge(cut, action), fw.inverse(trace));

        queue = queue.push(cut);
      }
    });
  }

  return edge2word;
};


const _spanningTree = function _spanningTree(basePoint, nrGens, action) {
  const gens = I.Range(1, nrGens+1).flatMap(i => [i, -i]);

  let queue = I.List([basePoint]);
  let seen = I.Set([basePoint]);
  let edges = I.List();

  while (!queue.isEmpty()) {
    const point = queue.first();
    queue = queue.rest();

    gens.forEach(function(g) {
      const p = action(point, g);
      if (!seen.contains(p)) {
        queue = queue.push(p);
        seen = seen.add(p);
        edges = edges.push(new Edge({ point: point, gen: g }));
      }
    });
  }

  return edges;
};


const stabilizer = function stabilizer(
  basePoint, nrGens, relators, domain, action, timers = null
) {
  timers && timers.start('preparations');
  const relsByGen = _relatorsByStartGen(relators);
  const tree = _spanningTree(basePoint, nrGens, action);
  const gens = I.Range(1, nrGens+1).flatMap(i => [i, -i]);
  const id = fw.empty;

  let point2word = I.Map([[basePoint, id]]);
  let edge2word = I.Map();

  timers && timers.switchTo('closing trivial relations');
  tree.forEach(function(edge) {
    edge2word = edge2word.set(edge, id).set(_reverseEdge(edge, action), id);
    edge2word = _closeRelations(edge, edge2word, relsByGen, action);
    point2word = point2word.set(
      action(edge.point, edge.gen),
      fw.product([point2word.get(edge.point), [edge.gen]]));
  });

  let lastGen = 0;
  let generators = I.List();

  timers && timers.switchTo('constructing the generators');
  domain.forEach(function(px) {
    const wx = point2word.get(px);
    gens.forEach(function(g) {
      const edge = new Edge({ point: px, gen: g });
      if (edge2word.get(edge) == null) {
        const py = action(px, g);
        const wy = point2word.get(py);
        const h = ++lastGen;
        const redge = _reverseEdge(edge, action);
        edge2word = edge2word
          .set(edge, fw.word([h]))
          .set(redge, fw.inverse([h]));
        edge2word = _closeRelations(edge, edge2word, relsByGen, action);
        edge2word = _closeRelations(redge, edge2word, relsByGen, action);
        generators = generators.push(fw.product([wx, [g], fw.inverse(wy)]));
      }
    });
  });

  timers && timers.switchTo('constructing the relators');
  const subrels = I.Set(domain)
    .flatMap(p => relators.map(function(w) {
      const trace = _traceWord(p, w, edge2word, action);
      return fw.relatorPermutations(trace).min(_cmpWords);
    }))
    .filter(w => w && w.size > 0)
    .sort(_cmpWords);

  timers && timers.stopAll();
  return { generators: generators, relators: subrels };
};


module.exports = stabilizer;


if (require.main == module) {
  const mapFn = map => (...args) => map.getIn(args);

  console.log(stabilizer(
    'a',
    3,
    [[1,1],[2,2],[3,3],[1,2,1,2],[1,3,1,3],[2,3,2,3]],
    ['a', 'b', 'c', 'd'],
    mapFn(I.Map({
      a: I.Map([[1, 'b'], [2, 'c'], [3, 'a'], [-1, 'b'], [-2, 'c'], [-3, 'a']]),
      b: I.Map([[1, 'a'], [2, 'd'], [3, 'b'], [-1, 'a'], [-2, 'd'], [-3, 'b']]),
      c: I.Map([[1, 'd'], [2, 'a'], [3, 'c'], [-1, 'd'], [-2, 'a'], [-3, 'c']]),
      d: I.Map([[1, 'c'], [2, 'b'], [3, 'd'], [-1, 'c'], [-2, 'b'], [-3, 'd']]),
    }))
  ));

  console.log(stabilizer(
    'a',
    3,
    [[1,2,-1,-2],[1,3,-1,-3],[2,3,-2,-3]],
    ['a', 'b'],
    mapFn(I.Map({
      a: I.Map([[1, 'b'], [-1, 'b'], [2, 'a'], [-2, 'a'], [3, 'a'], [-3, 'a']]),
      b: I.Map([[1, 'a'], [-1, 'a'], [2, 'b'], [-2, 'b'], [3, 'b'], [-3, 'b']])
    }))
  ));
}
