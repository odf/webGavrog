import * as I  from 'immutable';
import * as fw from './freeWords';


const _relatorsByStartGen = function _relatorsByStartGen(relators) {
  return I.List(relators).map(I.List)
    .flatMap(fw.relatorPermutations)
    .groupBy(rel => rel.get(0))
    .map(I.Set);
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


const _traceWord = (point, w, edge2word, action) => {
  let p = point;
  const trace = [];
  w.forEach(g => {
    trace.push(edge2word.get(new Edge({ point: p, gen: g })));
    p = action(p, g);
  });

  return fw.product(trace);
};


const _closeRelations = (startEdge, edge2word, relsByGen, action) => {
  const queue = [startEdge];

  while (queue.length) {
    const next = queue.shift();

    const p = next.point;
    const g = next.gen;

    relsByGen.get(g).forEach(function(r) {
      let cut = null;
      let w   = null;
      let x   = p;

      for (const i of r.keys()) {
        const h = r.get(i);
        const next = new Edge({ point: x, gen: h });
        if (edge2word.get(next) == null) {
          if (cut == null) {
            cut = next;
            w   = fw.inverse(fw.rotated(r, i+1).slice(0, -1));
          }
          else {
            cut = null;
            break;
          }
        }
        x = action(x, h);
      };

      if (cut != null) {
        const trace = _traceWord(cut.point, w, edge2word, action);

        edge2word.set(cut, trace);
        edge2word.set(_reverseEdge(cut, action), fw.inverse(trace));

        queue.push(cut);
      }
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

    gens.forEach(function(g) {
      const p = action(point, g);
      if (!seen.contains(p)) {
        queue.push(p);
        seen.add(p);
        edges.push(new Edge({ point: point, gen: g }));
      }
    });
  }

  return edges;
};


export const stabilizer = (
  basePoint, nrGens, relators, domain, action, timers = null
) => {
  timers && timers.start('preparations');
  const relsByGen = _relatorsByStartGen(relators);
  const tree = _spanningTree(basePoint, nrGens, action);
  const gens = I.Range(1, nrGens+1).flatMap(i => [i, -i]);
  const id = fw.empty;

  const point2word = I.Map([[basePoint, id]]).asMutable();
  const edge2word = I.Map().asMutable();

  timers && timers.switchTo('closing trivial relations');
  tree.forEach(function(edge) {
    edge2word.set(edge, id);
    edge2word.set(_reverseEdge(edge, action), id);
    _closeRelations(edge, edge2word, relsByGen, action);
    point2word.set(
      action(edge.point, edge.gen),
      fw.product([point2word.get(edge.point), [edge.gen]]));
  });

  const generators = [];
  let lastGen = 0;

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
        edge2word.set(edge, fw.word([h]));
        edge2word.set(redge, fw.inverse([h]));
        _closeRelations(edge, edge2word, relsByGen, action);
        _closeRelations(redge, edge2word, relsByGen, action);
        generators.push(fw.product([wx, [g], fw.inverse(wy)]));
      }
    });
  });

  timers && timers.switchTo('constructing the relators');
  const subrels = I.Set().asMutable();
  for (const p of domain) {
    for (const r of relators) {
      const w = fw.relatorRepresentative(_traceWord(p, r, edge2word, action));
      if (w && w.size)
        subrels.add(w);
    }
  }

  timers && timers.stopAll();
  return { generators: I.List(generators), relators: subrels.sort(fw.compare) };
};


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
