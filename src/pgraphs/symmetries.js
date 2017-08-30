import * as I from 'immutable';

import * as pg from './periodic';
import { rationalLinearAlgebraModular } from '../arithmetic/types';
import Partition from '../common/partition';
import * as comb from '../common/combinatorics';
import * as util from '../common/util';


let _timers = null;


const ops = pg.ops;

const encode = value => ops.serialize(value);
const decode = value => ops.deserialize(value);


class LabelledPartition {
  constructor(combineFn) {
    this._combineFn = combineFn;
    this._rank = {};
    this._parent = {};
    this._label = {};
  }

  find(x) {
    let root = x;

    while (this._parent[root] !== undefined)
      root = this._parent[root];

    while (x != root) {
      const t = x;
      x = this._parent[x];
      this._parent[t] = root;
    }

    return root;
  }

  setLabel(x, val) {
    this._label[this.find(x)] = val;
  }

  getLabel(x) {
    return this._label[this.find(x)];
  }

  union(x, y) {
    const x0 = this.find(x);
    const y0 = this.find(y);

    if (x0 != y0) {
      const rx = this._rank[x0] || 0;
      const ry = this._rank[y0] || 0;
      const label = this._combineFn(this._label[x0], this._label[y0]);

      if (rx < ry) {
        this._parent[x0] = y0;
        this._label[y0] = label;
      }
      else {
        if (rx == ry)
          this._rank[x0] = rx + 1;

        this._parent[y0] = x0;
        this._label[x0] = label;
      }
    }
  }
};


const _directedEdges = graph =>
  graph.edges.flatMap(e => [e, e.reverse()]).toJS();


const _goodCombinations = (edges, pos) => {
  const dim = ops.dimension(edges[0].shift);
  const results = [];

  for (const c of comb.combinations(edges.length, dim)) {
    const vectors = c.map(i => pg.edgeVector(edges[i - 1], pos));
    if (ops.rank(vectors) == dim) {
      for (const p of comb.permutations(dim)) {
        results.push(p.map(i => edges[c[i - 1] - 1]));
      }
    }
  }

  return I.List(results);
};


const _goodEdgeChains = graph => {
  const adj = pg.adjacencies(graph);
  const pos = pg.barycentricPlacement(graph);
  const dim = graph.dim;
  const results = [];

  const extend = es => {
    if (es.length == dim) {
      results.push(es);
    }
    else {
      const v = es[es.length - 1].tail;
      for (const e of pg.allIncidences(graph, v, adj)) {
        const next = es.concat([e]);
        const M = next.map(e => pg.edgeVector(e, pos));
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


export function characteristicBases(graph)
{
  const adj = pg.adjacencies(graph);
  const pos = pg.barycentricPlacement(graph);

  _timers && _timers.start('characteristicBases');

  let results = pg.vertices(graph)
    .flatMap(v => _goodCombinations(pg.allIncidences(graph, v, adj), pos));

  if (results.size == 0)
    results = _goodEdgeChains(graph);

  if (results.size == 0)
    results = _goodCombinations(_directedEdges(graph), pos);

  _timers && _timers.stop('characteristicBases');

  return results;
};


const _adjacenciesByEdgeVector = (graph, v, adj) => {
  const pos = pg.barycentricPlacement(graph);

  const out = {};
  for (const e of pg.allIncidences(graph, v, adj))
    out[encode(pg.edgeVector(e, pos))] = e;

  return out;
};


const _checkGraphsForMorphism = (graph1, graph2, transform) => {
  const errors = [];

  if (graph2.dim != graph1.dim)
    errors.push('graphs have different dimensions');
  if (transform != null && ops.dimension(transform) != graph1.dim)
    errors.push('coordinate transformation has the wrong dimension');

  if (errors.length > 0)
    throw new Error(errors.join('\n'));
};


export function morphism(
  graph1,
  graph2,
  start1,
  start2,
  transform,
  adj1=pg.adjacencies(graph1),
  adj2=pg.adjacencies(graph2)
) {
  _timers && _timers.start('morpism');

  _checkGraphsForMorphism(graph1, graph2, transform);

  const src2img = {};
  const img2src = {};
  const queue = [];

  let injective = true;

  const OKAY = 0;
  const BAD = -1;
  const SEEN = 1;

  const tryPair = (src, img) => {
    const oldImg = src2img[src];
    if (img == oldImg)
      return SEEN;
    else if (oldImg != null)
      return BAD;

    if (img2src[img] != null)
      injective = false;

    src2img[src] = img;
    img2src[img] = src;

    return OKAY;
  };

  tryPair(start1, start2);
  queue.push([start1, start2]);

  while (queue.length) {
    const [w1, w2] = queue.shift();
    _timers && _timers.start('morpism: _adjacenciesByEdgeVector');
    const n1 = _adjacenciesByEdgeVector(graph1, w1, adj1);
    const n2 = _adjacenciesByEdgeVector(graph2, w2, adj2);
    _timers && _timers.stop('morpism: _adjacenciesByEdgeVector');

    for (const [d1, e1] of Object.entries(n1)) {
      const e2 = n2[encode(ops.times(decode(d1), transform))];

      const status = (e2 == null ? BAD : OKAY) ||
        tryPair(encode(e1), encode(e2)) ||
        tryPair(e1.tail, e2.tail);

      if (status == OKAY)
        queue.push([e1.tail, e2.tail]);
      else if (status == BAD) {
        _timers && _timers.stop('morpism');
        return null;
      }
    }
  }

  const complete = pg.vertices(graph2).every(v => img2src[v] != null) &&
    graph2.edges.every(e => (img2src[encode(e)] != null &&
                             img2src[encode(e.reverse())] != null));

  _timers && _timers.stop('morpism');

  if (complete)
    return {
      src2img,
      img2src,
      transform,
      injective,
      sourceGraph: graph1,
      imageGraph: graph2
    };
};


export function productMorphism(phi, psi) {
  const compose = (f, g) => {
    const h = {};
    for (const x of Object.keys(f)) {
      h[x] = g[f[x]];
      if (h[x] == null)
        throw new Error('morphism do not compose');
    }
    return h;
  };

  const src2img = compose(phi.src2img, psi.src2img);
  const img2src = compose(psi.img2src, phi.img2src);

  return {
    src2img,
    img2src,
    transform: ops.times(phi.transform, psi.transform),
    injective: phi.injective && psi.injective,
    sourceGraph: phi.sourceGraph,
    imageGraph: psi.imageGraph
  };
};


export function groupOfMorphisms(generators, keyFn) {
  const result = generators.slice();
  const seen = {};
  generators.forEach(gen => seen[keyFn(gen)] = true);

  for (let next = 0; next < result.length; ++next) {
    const phi = result[next];
    for (const psi of generators) {
      const product = productMorphism(phi, psi);
      const key = keyFn(product);

      if (!seen[key]) {
        result.push(product);
        seen[key] = true;
      }
    }
  }

  return result;
};


export function isMinimal(graph)
{
  const id = ops.identityMatrix(graph.dim);
  const verts = pg.vertices(graph);
  const start = verts.first();

  for (const v of verts.rest()) {
    if (morphism(graph, graph, start, v, id) != null)
      return false;
  }

  return true;
}


const translationalEquivalences = graph => {
  const id = ops.identityMatrix(graph.dim);
  const verts = pg.vertices(graph);
  const start = verts.first();

  let p = Partition();

  for (const v of verts) {
    if (p.get(start) != p.get(v)) {
      const iso = morphism(graph, graph, start, v, id);
      if (iso != null) {
        for (const w of verts) {
          p = p.union(w, iso.src2img[w]);
        }
      }
    }
  }

  return p;
};


const extraTranslationVectors = (graph, equivs) => {
  const pos = pg.barycentricPlacement(graph);
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


const translationalEquivalenceClasses = (graph, equivs) =>
  equivs.classes(pg.vertices(graph));


const fullTranslationBasis = vectors => {
  let basis = ops.identityMatrix(vectors[0].length);
  for (const v of vectors)
    basis = rationalLinearAlgebraModular.extendBasis(v, basis);
  return basis;
};


export function minimalImage(graph)
{
  let result;

  _timers && _timers.start('minimalImage');

  if (isMinimal(graph))
    result = graph;
  else {
    const pos = pg.barycentricPlacement(graph);
    const equivs = translationalEquivalences(graph);
    const classes = translationalEquivalenceClasses(graph, equivs);
    const vectors = extraTranslationVectors(graph, equivs);
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

    result = pg.make(imgEdges);
  }

  _timers && _timers.stop('minimalImage');

  return result;
};


const _matrixProductIfUnimodular = (A, B) => {
  const [nrowsA, ncolsA] = [A.length, A[0].length];
  const [nrowsB, ncolsB] = [B.length, B[0].length];

  if (ncolsA != nrowsB)
    throw new Error('shapes do not match');

  const result = Array(nrowsA);

  for (let i = 0; i < nrowsA; ++i) {
    const row = Array(ncolsB).fill(0);

    for (let j = 0; j < ncolsB; ++j) {
      let t = 0;

      for (let k = 0; k < ncolsA; ++k)
        t = ops.plus(t, ops.times(A[i][k], B[k][j]));

      if (!ops.isInteger(t))
        return null;

      row[j] = t;
    }

    result[i] = row;
  }

  if (ops.eq(1, ops.abs(ops.determinant(result))))
    return result;
  else
    return null;
};


export function symmetries(graph)
{
  const pos = pg.barycentricPlacement(graph);

  if (!pg.isLocallyStable(graph))
    throw new Error('graph is not locally stable; cannot compute symmetries');

  const bases = characteristicBases(graph);

  _timers && _timers.start('symmetries');

  _timers && _timers.start('symmetries: preparations');
  const adj = pg.adjacencies(graph);
  const deg = v => adj.get(v).size;

  const encodedBases = bases.map(b => b.map(encode)).toArray();
  const keys = encodedBases.map(b => b.join(','));
  const degs = bases.map(b => b.map(e => [deg(e.head), deg(e.tail)])).toArray();
  const v0 = bases.first()[0].head;
  const B0 = bases.first().map(e => pg.edgeVector(e, pos));
  const invB0 = ops.inverse(B0);

  const id = ops.identityMatrix(graph.dim);
  const generators = [morphism(graph, graph, v0, v0, id, adj, adj)];

  const p = new LabelledPartition((a, b) => a || b);
  _timers && _timers.stop('symmetries: preparations');

  _timers && _timers.start('symmetries: main loop');
  for (let i = 0; i < bases.size; ++i) {
    if (ops.eq(degs[i], degs[0]) &&
        p.find(keys[i]) != p.find(keys[0]) &&
        !p.getLabel(keys[i]))
    {
      const basis = bases.get(i);
      const v = basis[0].head;
      const B = basis.map(e => pg.edgeVector(e, pos));

      const M = _matrixProductIfUnimodular(invB0, B);
      const iso = M && morphism(graph, graph, v0, v, M, adj, adj);

      if (iso) {
        generators.push(iso);

        for (let i = 0; i < bases.size; ++i) {
          p.union(
            keys[i],
            encodedBases[i].map(e => iso.src2img[e]).join(','));
        }
      }
      else
        p.setLabel(keys[i], true);
    }
  }
  _timers && _timers.stop('symmetries: main loop');

  _timers && _timers.start('symmetries: representative bases');
  const representativeBases = I.Range(0, bases.size)
    .filter(i => keys[i] == p.find(keys[i]))
    .map(i => bases.get(i))
    .toList();
  _timers && _timers.stop('symmetries: representative bases');

  _timers && _timers.start('symmetries: group of morphisms');
  const keyFn = phi => encodedBases[0].map(e => phi.src2img[e]).join(',');
  const syms = groupOfMorphisms(generators, keyFn);
  _timers && _timers.stop('symmetries: group of morphisms');

  _timers && _timers.stop('symmetries');

  return {
    generators: generators.slice(1),
    representativeBases,
    symmetries: syms
  };
};


export function edgeOrbits(graph, syms=symmetries(graph).symmetries) {
  const seen = {};
  let p = Partition();

  for (const a of graph.edges) {
    const ka = encode(a);
    if (seen[ka])
      continue;
    seen[ka] = true;

    for (const phi of syms) {
      const b = decode(phi.src2img[ka]).canonical();
      const kb = encode(b);
      if (seen[kb])
        continue;
      seen[kb] = true;

      p = p.union(ka, kb);
    }
  }

  return p.classes(Object.keys(seen)).map(cl => cl.map(decode));
}


export function useTimers(timers) {
  _timers = timers;
}


if (require.main == module) {
  Array.prototype.toString = function() {
    return `[ ${this.map(x => x.toString()).join(', ')} ]`;
  };

  const test = function test(g) {
    console.log(`vertices: ${pg.vertices(g)}`);
    console.log('edges:');
    for (const e of g.edges)
      console.log(`  ${e}`);
    console.log();

    const bases = characteristicBases(g);
    console.log(`found ${bases.size} characteristic bases`);

    if (pg.isConnected(g) && pg.isLocallyStable(g)) {
      const syms = symmetries(g);
      const gens = syms.generators;
      const bases = syms.representativeBases;
      console.log(`found ${syms.symmetries.length} symmetries in total`
                  + ` from ${gens.length} generators:`);
      for (const sym of gens)
        console.log(sym.transform);
      console.log(`found ${bases.size} representative base(s):`);
      for (const basis of bases)
        console.log(`${basis}`);
      console.log();

      const minimal = isMinimal(g);
      console.log(`minimal = ${minimal}`);
      if (!minimal) {
        const p = translationalEquivalences(g);
        const vs = extraTranslationVectors(g, p);
        const cls = translationalEquivalenceClasses(g, p);
        console.log(`translational equivalences: ${p}`);
        console.log(`extra translations = ${vs}`);
        console.log(`equivalence classes: ${cls}`);
        console.log(`minimal image: ${minimalImage(g)}`);
      }
      console.log();

      const orbits = edgeOrbits(g, syms.symmetries);
      console.log(`edge orbits: ${JSON.stringify(orbits)}`);
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

  test(pg.make([ [ 1, 2, [ 0, 0 ] ],
                 [ 1, 2, [ 1, 0 ] ],
                 [ 2, 3, [ 0, 0 ] ],
                 [ 2, 3, [ 0, 1 ] ],
                 [ 1, 3, [ 0, 0 ] ],
                 [ 1, 3, [ 1, 1 ] ] ]));

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 1, 2, [ 0, 1, 0 ] ],
                 [ 1, 1, [ 0, 0, 1 ] ],
                 [ 2, 2, [ 0, 0, 1 ] ] ]));

  symTimers.stop('total');
  console.log(`${JSON.stringify(symTimers.current(), null, 2)}`);
}
