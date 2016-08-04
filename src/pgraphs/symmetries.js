import * as I from 'immutable';

import * as pg from './periodic';
import Partition from '../common/partition';
import * as comb from '../common/combinatorics';
import { rationalMethods, rationals } from '../arithmetic/types';
import * as mats from '../arithmetic/matrices';

const ops = pg.ops;

const encode = value => I.fromJS(ops.repr(value));
const decode = value => ops.fromRepr(value.toJS());


const _allIncidences = (
  graph, v,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph)
) => {
  const result = [];

  for (const { v: w, s } of adj.get(v)) {
    result.push(pg.makeEdge(v, w, s));
    if (v == w)
      result.push(pg.makeEdge(w, v, ops.negative(s)));
  }

  return result;
};


const _adjacenciesByEdgeVector = (
  graph, v,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph)
) => {
  const result = I.Map().asMutable();

  for (const { v: w, s } of adj.get(v)) {
    const d = ops.plus(s, ops.minus(pos.get(w), pos.get(v)));
    result.set(encode(d), pg.makeEdge(v, w, s));
    if (v == w)
      result.set(encode(ops.negative(d)), pg.makeEdge(w, v, ops.negative(s)));
  }

  return result.asImmutable();
};


const _checkGraphsForMorphism = (graph1, graph2, transform) => {
  const errors = [];

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

  if (errors.length > 0)
    throw new Error(errors.join('\n'));
};


export function morphism(
  graph1, graph2, start1, start2, transform,
  adj1 = pg.adjacencies(graph1),
  adj2 = pg.adjacencies(graph2),
  pos1 = pg.barycentricPlacement(graph1),
  pos2 = pg.barycentricPlacement(graph2)
) {
  _checkGraphsForMorphism(graph1, graph2, transform);

  const src2img = I.Map().asMutable();
  const img2src = I.Map().asMutable();
  const queue = [];

  let injective = true;

  src2img.set(start1, start2);
  // TODO Seems we need the following, but Java code leaves it out:
  // img2src.set(start2, start1);
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
  const id = ops.identityMatrix(graph.dim);
  const verts = pg.vertices(graph);
  const start = verts.first();

  let p = Partition();

  for (const v of verts) {
    if (p.get(start) != p.get(v)) {
      const iso = morphism(graph, graph, start, v, id, adj, adj, pos, pos);
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
    const sNew = ops.times(basisChange, ops.plus(s, ops.minus(wShift, vShift)));

    imgEdges.push([vNew + 1, wNew + 1, sNew]);
  }

  return pg.make(imgEdges);
};


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
    for (const c of _goodCombinations(_allIncidences(g, 1), pos))
      console.log(`${c}`);
    console.log();

    if (pg.isConnected(g) && pg.isLocallyStable(g)) {
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

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 3, 4, [ 0, 0, 0 ] ],
                 [ 3, 4, [ 1, 0, 0 ] ],
                 [ 5, 6, [ 0, 0, 0 ] ],
                 [ 5, 6, [ 1, 0, 0 ] ],
                 [ 7, 8, [ 0, 0, 0 ] ],
                 [ 7, 8, [ 1, 0, 0 ] ],
                 [ 1, 3, [ 0, 0, 0 ] ],
                 [ 1, 3, [ 0, 1, 0 ] ],
                 [ 2, 4, [ 0, 0, 0 ] ],
                 [ 2, 4, [ 0, 1, 0 ] ],
                 [ 5, 7, [ 0, 0, 0 ] ],
                 [ 5, 7, [ 0, 1, 0 ] ],
                 [ 6, 8, [ 0, 0, 0 ] ],
                 [ 6, 8, [ 0, 1, 0 ] ],
                 [ 1, 5, [ 0, 0, 0 ] ],
                 [ 1, 5, [ 0, 0, 1 ] ],
                 [ 2, 6, [ 0, 0, 0 ] ],
                 [ 2, 6, [ 0, 0, 1 ] ],
                 [ 3, 7, [ 0, 0, 0 ] ],
                 [ 3, 7, [ 0, 0, 1 ] ],
                 [ 4, 8, [ 0, 0, 0 ] ],
                 [ 4, 8, [ 0, 0, 1 ] ] ]));

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 1, 2, [ 0, 1, 0 ] ],
                 [ 1, 2, [ 0, 0, 1 ] ],
                 [ 3, 4, [ 0, 0, 0 ] ],
                 [ 3, 4, [ 1, 0, 0 ] ],
                 [ 3, 4, [ 0, 1, 0 ] ],
                 [ 3, 4, [ 0, 0, 1 ] ],
                 [ 1, 3, [ 0, 0, 0 ] ] ]));

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 1, 2, [ 0, 1, 0 ] ],
                 [ 1, 2, [ 0, 0, 1 ] ] ]));
}
