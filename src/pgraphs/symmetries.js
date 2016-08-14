import * as I from 'immutable';

import * as pg from './periodic';
import Partition from '../common/partition';
import * as comb from '../common/combinatorics';
import { rationalMethods, rationals } from '../arithmetic/types';
import * as mats from '../arithmetic/matrices';
import * as util from '../common/util';


let _timers = null;


const ops = pg.ops;

const encode = value => {
  _timers && _timers.start('encode');
  const out = JSON.stringify(ops.repr(value));
  _timers && _timers.stop('encode');
  return out;
};

const decode = value => {
  _timers && _timers.start('decode');
  const out = ops.fromRepr(JSON.parse(value));
  _timers && _timers.stop('decode');
  return out;
};


const encodeVector = value => {
  _timers && _timers.start('encode');
  const out = JSON.stringify(value.map(x => ops.repr(x)));
  _timers && _timers.stop('encode');
  return out;
};

const decodeVector = value => {
  _timers && _timers.start('decode');
  const out = JSON.parse(value).map(x => ops.fromRepr(x));
  _timers && _timers.stop('decode');
  return out;
};


const _allIncidences = (graph, v, adj = pg.adjacencies(graph)) => adj.get(v)
  .map(({v: w, s}) => pg.makeEdge(v, w, s))
  .flatMap(e => e.head == e.tail ? [e, e.reverse()] : [e])
  .toJS();


const _directedEdges = graph =>
  graph.edges.flatMap(e => [e, e.reverse()]).toJS();


const _edgeVector = (e, pos) =>
  ops.plus(e.shift, ops.minus(pos.get(e.tail), pos.get(e.head)));


function* _goodCombinations(edges, pos) {
  const dim = ops.dimension(edges[0].shift);

  for (const c of comb.combinations(edges.length, dim)) {
    const vectors = c.map(i => _edgeVector(edges[i - 1], pos));
    if (ops.rank(vectors) == dim) {
      for (const p of comb.permutations(dim)) {
        yield p.map(i => edges[c[i - 1] - 1]);
      }
    }
  }
};


const _goodEdgeChains = (
  graph,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph)
) => {
  const dim = graph.dim;
  const results = [];

  const extend = es => {
    if (es.length == dim) {
      results.push(es);
    }
    else {
      const v = es[es.length - 1].tail;
      for (const e of _allIncidences(graph, v, adj)) {
        const next = es.concat([e]);
        const M = next.map(e => _edgeVector(e, pos));
        if (ops.rank(M) == next.length) {
          extend(next);
        }
      }
    }
  };

  for (const e of _directedEdges(graph)) {
    extend([e]);
  }

  return I.List(results);
};


const _characteristicBases = (
  graph,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph)
) => {
  const firstAttempt = pg.vertices(graph)
    .flatMap(v => _goodCombinations(_allIncidences(graph, v, adj), pos));
  if (firstAttempt.size)
    return firstAttempt;

  const secondAttempt = _goodEdgeChains(graph, adj, pos);
  if (secondAttempt.size)
    return secondAttempt;

  return I.List(_goodCombinations(_directedEdges(graph), pos));
};


const _adjacenciesByEdgeVector = (
  graph, v,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph)
) => {
  _timers && _timers.start('_adjacenciesByEdgeVector');

  const out = I.Map(
    _allIncidences(graph, v, adj)
      .map(e => [encode(_edgeVector(e, pos)), e]));

  _timers && _timers.stop('_adjacenciesByEdgeVector');
  return out;
};


const _checkGraphsForMorphism = (graph1, graph2, transform) => {
  const errors = [];
  _timers && _timers.start('_checkGraphsForMorphism');

  if (graph2.dim != graph1.dim)
    errors.push('graphs have different dimensions');
  if (transform != null && ops.dimension(transform) != graph1.dim)
    errors.push('coordinate transformation has the wrong dimension');

  if (!pg.isConnected(graph1))
    errors.push('first graph is not connected');
  else if (!pg.isLocallyStable(graph1))
    errors.push('first graph is not locally stable');

  if (!pg.isConnected(graph2))
    errors.push('second graph is not connected');
  else if (!pg.isLocallyStable(graph2))
    errors.push('second graph is not locally stable');

  _timers && _timers.stop('_checkGraphsForMorphism');
  if (errors.length > 0)
    throw new Error(errors.join('\n'));
};


export function morphism(
  graph1, graph2, start1, start2, transform,
  adj1 = pg.adjacencies(graph1),
  adj2 = pg.adjacencies(graph2),
  pos1 = pg.barycentricPlacement(graph1),
  pos2 = pg.barycentricPlacement(graph2),
  skipChecks = false
) {
  _timers && _timers.start('morphism');
  if (!skipChecks)
    _checkGraphsForMorphism(graph1, graph2, transform);

  const src2img = I.Map().asMutable();
  const img2src = I.Map().asMutable();
  const queue = [];

  let injective = true;

  src2img.set(start1, start2);
  img2src.set(start2, start1);
  queue.push(start1);

  while (queue.length) {
    const w1 = queue.shift();
    const w2 = src2img.get(w1);
    const n1 = _adjacenciesByEdgeVector(graph1, w1, adj1, pos1);
    const n2 = _adjacenciesByEdgeVector(graph2, w2, adj2, pos2);

    for (const [d1, e1] of n1) {
      const d2 = encode(ops.times(decode(d1), transform));
      const e2 = n2.get(d2);
      if (e2 == null)
        return null;

      const e1img = src2img.get(encode(e1));
      if (I.is(encode(e2), encode(e1img)))
        continue;
      else if (e1img != null)
        return null;

      if (img2src.has(encode(e2)))
        injective = false;

      src2img.set(encode(e1), e2);
      img2src.set(encode(e2), e1);

      const u1 = e1.tail;
      const u2 = e2.tail;

      const u2src = img2src.get(u2);
      if (u2src == null)
        img2src.set(u2, u1);
      else if (u2src != u1)
        injective = false;

      const u1img = src2img.get(u1);
      if (u1img == null) {
        src2img.set(u1, u2);
        queue.push(u1);
      }
      else if (u1img != u2)
        return null;
    }
  }

  for (const v of pg.vertices(graph2))
    if (!img2src.has(v))
      return null;
  for (const e of graph2.edges)
    if (!img2src.has(encode(e)) || !img2src.has(encode(e.reverse())))
      return null;

  _timers && _timers.stop('morphism');

  return {
    src2img,
    img2src,
    transform,
    injective,
    sourceGraph: graph1,
    imageGraph: graph2
  };
};


export function isMinimal(
  graph,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph))
{
  const id = ops.identityMatrix(graph.dim);
  const verts = pg.vertices(graph);
  const start = verts.first();

  for (const v of verts.rest()) {
    if (morphism(graph, graph, start, v, id, adj, adj, pos, pos) != null)
      return false;
  }

  return true;
}


const translationalEquivalences = (
  graph,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph)
) => {
  if (!pg.isConnected(graph))
    throw new Error('graph is not connected');
  else if (!pg.isLocallyStable(graph, pos))
    throw new Error('graph is not locally stable');

  const id = ops.identityMatrix(graph.dim);
  const verts = pg.vertices(graph);
  const start = verts.first();

  let p = Partition();

  for (const v of verts) {
    if (p.get(start) != p.get(v)) {
      const iso = morphism(graph, graph, start, v, id, adj, adj, pos, pos, true);
      if (iso != null) {
        for (const w of verts) {
          p = p.union(w, iso.src2img.get(w));
        }
      }
    }
  }

  return p;
};


const extraTranslationVectors = (
  graph,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph),
  equivs = translationalEquivalences(graph, adj, pos)
) => {
  const verts = pg.vertices(graph);
  const class0 = equivs.get(verts.first());
  const pos0 = pos.get(verts.first());
  const vectors = [];

  for (const v of verts.rest()) {
    if (equivs.get(v) == class0) {
      vectors.push(ops.mod(ops.minus(pos.get(v), pos0), 1));
    }
  }

  return vectors;
};


const translationalEquivalenceClasses = (
  graph,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph),
  equivs = translationalEquivalences(graph, adj, pos)
) => {
  const repToClass = {};
  const classes = [];

  for (const v of pg.vertices(graph)) {
    const rep = equivs.get(v);
    if (repToClass[rep] == null) {
      repToClass[rep] = classes.length;
      classes.push([v]);
    }
    else
      classes[repToClass[rep]].push(v);
  }

  return classes;
};


const fullTranslationBasis = vectors => {
  const ops = rationalMethods.register(
    mats.methods(rationals, ['Integer', 'LongInt', 'Fraction'], false)
  ).ops();

  const dim = vectors[0].length;
  const M = ops.identityMatrix(dim).concat(vectors);
  const T = ops.triangulation(M).R;
  return T.slice(0, dim);
};


export function minimalImage(
  graph,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph),
  equivs = translationalEquivalences(graph, adj, pos))
{
  const classes = translationalEquivalenceClasses(graph, adj, pos, equivs);
  const vectors = extraTranslationVectors(graph, adj, pos, equivs);
  const basisChange = ops.inverse(fullTranslationBasis(vectors));

  const old2new = {};
  for (let i = 0; i < classes.length; ++i) {
    for (const v of classes[i]) {
      old2new[v] = i;
    }
  }

  const imgEdges = [];
  for (const e of graph.edges) {
    const v = e.head;
    const w = e.tail;
    const vNew = old2new[v];
    const wNew = old2new[w];
    const vRep = classes[vNew][0];
    const wRep = classes[wNew][0];

    const s = e.shift;
    const vShift = ops.minus(pos.get(v), pos.get(vRep));
    const wShift = ops.minus(pos.get(w), pos.get(wRep));
    const sNew = ops.times(ops.plus(s, ops.minus(wShift, vShift)), basisChange);

    imgEdges.push([vNew + 1, wNew + 1, sNew]);
  }

  return pg.make(imgEdges);
};


const _isUnimodularIntegerMatrix = M => (
  M.every(row => row.every(x => ops.isInteger(x)))
    && ops.eq(1, ops.abs(ops.determinant(M)))
);


export function symmetryGenerators(
  graph,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph),
  bases = _characteristicBases(graph, adj, pos))
{
  _timers && _timers.start('symmetryGenerators');
  if (!pg.isConnected(graph))
    throw new Error('graph is not connected');
  else if (!pg.isLocallyStable(graph, pos))
    throw new Error('graph is not locally stable');

  const v0 = bases.first()[0].head;
  const B0 = bases.first().map(e => _edgeVector(e, pos));
  const gens = [];

  let p = Partition();

  for (const basis of bases) {
    if (p.get(encodeVector(basis)) != p.get(encodeVector(bases.first()))) {
      const v = basis[0].head;
      const B = basis.map(e => _edgeVector(e, pos));
      const M = ops.solve(B0, B);

      if (_isUnimodularIntegerMatrix(M)) {
        const iso = morphism(graph, graph, v0, v, M, adj, adj, pos, pos, true);
        if (iso != null) {
          gens.push(iso);
          for (const b of bases) {
            p = p.union(encodeVector(b),
                        encodeVector(b.map(e => iso.src2img.get(encode(e)))));
          }
        }
      }
    }
  }

  _timers && _timers.stop('symmetryGenerators');

  return gens;
};


export function useTimers(timers) {
  _timers = timers;
}


if (require.main == module) {
  Array.prototype.toString = function() {
    return `[ ${this.map(x => x.toString()).join(', ')} ]`;
  };

  const maybeDecode = x => x.constructor.name == 'Number' ? x : decode(x);

  const test = function test(g) {
    console.log(`vertices: ${pg.vertices(g)}`);
    console.log('edges:');
    for (const e of g.edges)
      console.log(`  ${e}`);
    console.log();

    const edges = I.List(g.edges).toJS();
    const pos = pg.barycentricPlacement(g);
    const bases = _characteristicBases(g);
    console.log(`found ${bases.size} characteristic bases`);

    if (pg.isConnected(g) && pg.isLocallyStable(g)) {
      const syms = symmetryGenerators(g);
      console.log(`found ${syms.length} symmetry generators:`);
      for (const sym of syms)
        console.log(sym.transform);
      console.log();

      const minimal = isMinimal(g);
      console.log(`minimal = ${isMinimal(g)}`);
      if (!minimal) {
        const p = translationalEquivalences(g);
        console.log(`translational equivalences: ${p}`);
        console.log(`extra translations = ${extraTranslationVectors(g)}`);
        console.log(
          `equivalence classes: ${translationalEquivalenceClasses(g)}`);
        console.log(`minimal image: ${minimalImage(g)}`);
      }
    }
    console.log();
    console.log();
    console.log();
  };

  const symTimers = util.timers();
  useTimers(symTimers);
  symTimers.start('total');

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 1, 2, [ 0, 1, 0 ] ],
                 [ 1, 2, [ 0, 0, 1 ] ] ]));

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 2, 1, [ 1, 0, 0 ] ],
                 [ 2, 3, [ 0, 0, 0 ] ],
                 [ 3, 2, [ 0, 1, 0 ] ],
                 [ 3, 1, [ 0, 0, 1 ] ],
                 [ 3, 1, [ 1, 1, -1 ] ] ]));

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 2, 3, [ 0, 0, 0 ] ],
                 [ 3, 4, [ 0, 0, 0 ] ],
                 [ 4, 5, [ 0, 0, 0 ] ],
                 [ 5, 6, [ 0, 0, 0 ] ],
                 [ 6, 1, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 2, 3, [ 0, 1, 0 ] ],
                 [ 3, 4, [ 0, 0, 1 ] ],
                 [ 4, 5, [ -1, 0, 0 ] ],
                 [ 5, 6, [ 0, -1, 0 ] ],
                 [ 6, 1, [ 0, 0, -1 ] ] ]));

  symTimers.stop('total');
  console.log(`${JSON.stringify(symTimers.current(), null, 2)}`);
}
