import * as pickler from '../common/pickler';

import * as pg from './periodic';
import { rationalLinearAlgebra,
         rationalLinearAlgebraModular } from '../arithmetic/types';
import * as part from '../common/unionFind';
import * as comb from '../common/combinatorics';


const ops = rationalLinearAlgebra;

const encode = pickler.serialize;
const decode = pickler.deserialize;


const _directedEdges = graph => {
  const out = [];
  for (const e of graph.edges) {
    out.push(e);
    out.push(e.reverse());
  }
  return out;
};


const _goodCombinations = (edges, pos) => {
  const dim = ops.dimension(edges[0].shift);
  const results = [];

  for (const c of comb.combinations(edges.length, dim)) {
    const vectors = c.map(i => pg.edgeVector(edges[i - 1], pos));
    if (ops.rank(vectors) == dim) {
      for (const p of comb.permutations(dim))
        results.push(p.map(i => edges[c[i - 1] - 1]));
    }
  }

  return results;
};


const _goodEdgeChains = graph => {
  const adj = pg.adjacencies(graph);
  const pos = pg.barycentricPlacement(graph);
  const dim = graph.dim;
  const results = [];

  const extend = es => {
    if (es.length == dim)
      results.push(es);
    else {
      const v = es[es.length - 1].tail;
      for (const e of pg.allIncidences(graph, v, adj)) {
        const next = es.concat([e]);
        const M = next.map(e => pg.edgeVector(e, pos));
        if (ops.rank(M) == next.length)
          extend(next);
      }
    }
  };

  for (const e of _directedEdges(graph))
    extend([e]);

  return results;
};


const characteristicBases = graph => {
  const adj = pg.adjacencies(graph);
  const pos = pg.barycentricPlacement(graph);

  const stars = [].concat(...pg.vertices(graph).map(
    v => _goodCombinations(pg.allIncidences(graph, v, adj), pos)));
  if (stars.length)
    return stars;

  const chains = _goodEdgeChains(graph);
  if (chains.length)
    return chains;

  return _goodCombinations(_directedEdges(graph), pos);
};


const identityAutomorphism = graph => {
  const src2img = {};
  for (const v of pg.vertices(graph))
    src2img[v] = v;
  for (const e of graph.edges)
    src2img[encode[e]] = encode[e];

  const transform = ops.identityMatrix(graph.dim);

  return { src2img, transform };
};


const automorphism = (graph, start1, start2, transform, edgeByVec) => {
  const src2img = { [start1]: start2 };
  const queue = [[start1, start2]];

  while (queue.length) {
    const [w1, w2] = queue.shift();

    for (const [d1, e1] of Object.entries(edgeByVec[w1])) {
      const e2 = edgeByVec[w2][encode(ops.times(decode(d1), transform))];
      if (e2 == null)
        return null;

      src2img[encode(e1)] = encode(e2);

      if (src2img[e1.tail] == null) {
        src2img[e1.tail] = e2.tail;
        queue.push([e1.tail, e2.tail]);
      }
      else if (src2img[e1.tail] != e2.tail)
        return null;
    }
  }

  return { src2img, transform };
};


const productAutomorphism = (phi, psi) => {
  const compose = (f, g) => {
    const h = {};
    for (const x of Object.keys(f)) {
      h[x] = g[f[x]];
      if (h[x] == null)
        throw new Error('automorphisms do not compose');
    }
    return h;
  };

  const src2img = compose(phi.src2img, psi.src2img);
  const transform = ops.times(phi.transform, psi.transform);

  return { src2img, transform };
};


const groupOfAutomorphisms = (generators, keyFn) => {
  const result = generators.slice();
  const seen = {};
  generators.forEach(gen => seen[keyFn(gen)] = true);

  for (let next = 0; next < result.length; ++next) {
    const phi = result[next];
    for (const psi of generators) {
      const product = productAutomorphism(phi, psi);
      const key = keyFn(product);

      if (!seen[key]) {
        result.push(product);
        seen[key] = true;
      }
    }
  }

  return result;
};


export const isMinimal = graph => {
  const id = ops.identityMatrix(graph.dim);
  const verts = pg.vertices(graph);
  const start = verts[0];
  const adj = pg.adjacencies(graph);
  const ebv = edgesByVector(graph, adj);

  for (const v of verts.slice(1)) {
    if (automorphism(graph, start, v, id, ebv) != null)
      return false;
  }

  return true;
}


const translationalEquivalences = graph => {
  const id = ops.identityMatrix(graph.dim);
  const verts = pg.vertices(graph);
  const start = verts[0];
  const adj = pg.adjacencies(graph);
  const ebv = edgesByVector(graph, adj);

  const p = new part.Partition();

  for (const v of verts) {
    if (p.find(start) != p.find(v)) {
      const iso = automorphism(graph, start, v, id, ebv);
      if (iso != null) {
        for (const w of verts)
          p.union(w, iso.src2img[w]);
      }
    }
  }

  return p;
};


const extraTranslationVectors = (graph, equivs) => {
  const pos = pg.barycentricPlacement(graph);
  const verts = pg.vertices(graph);
  const class0 = equivs.find(verts[0]);
  const pos0 = pos[verts[0]];
  const vectors = [];

  for (const v of verts.slice(1)) {
    if (equivs.find(v) == class0)
      vectors.push(ops.mod(ops.minus(pos[v], pos0), 1));
  }

  return vectors;
};


const equivalenceClasses = (equivs, elements) => {
  const repToClass = {};
  const classes = [];

  for (const v of elements) {
    const rep = equivs.find(v);
    if (repToClass[rep] == null) {
      repToClass[rep] = classes.length;
      classes.push([v]);
    }
    else
      classes[repToClass[rep]].push(v);
  }

  return classes;
};


const translationalEquivalenceClasses = (graph, equivs) =>
  equivalenceClasses(equivs, pg.vertices(graph));


const fullTranslationBasis = vectors => {
  let basis = ops.identityMatrix(vectors[0].length);
  for (const v of vectors)
    basis = rationalLinearAlgebraModular.extendBasis(v, basis);
  return basis;
};


export const minimalImage = graph => {
  if (isMinimal(graph))
    return graph;
  else {
    const pos = pg.barycentricPlacement(graph);
    const equivs = translationalEquivalences(graph);
    const classes = translationalEquivalenceClasses(graph, equivs);
    const vectors = extraTranslationVectors(graph, equivs);
    const basisChange = ops.inverse(fullTranslationBasis(vectors));

    const old2new = {};
    for (let i = 0; i < classes.length; ++i) {
      for (const v of classes[i])
        old2new[v] = i;
    }

    const imgEdges = [];
    for (const { head: v, tail: w, shift: s } of graph.edges) {
      const vNew = old2new[v];
      const wNew = old2new[w];
      const vShift = ops.minus(pos[v], pos[classes[vNew][0]]);
      const wShift = ops.minus(pos[w], pos[classes[wNew][0]]);
      const sNew = ops.times(ops.plus(s, ops.minus(wShift, vShift)),
                             basisChange);

      imgEdges.push([vNew + 1, wNew + 1, sNew]);
    }

    return pg.make(imgEdges);
  }
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


const edgesByVector = (graph, pos, adj) => {
  const result = {};

  for (const v of pg.vertices(graph)) {
    const m = result[v] = {};
    for (const e of pg.allIncidences(graph, v, adj))
      m[encode(pg.edgeVector(e, pos))] = e;
  }

  return result;
};


export const goodBases = (graph, bases) => {
  const adj = pg.adjacencies(graph);

  const atLoop = bases.filter(basis => {
    const v = basis[0].head;
    return adj[v].every(e => e.tail == v);
  });

  if (atLoop.length > 0)
    return atLoop;

  const atLune = bases.filter(basis => {
    const v = basis[0].head;
    const neighbours = adj[v].map(e => e.tail).sort();
    return neighbours.some((w, i) => i > 0 && w == neighbours[i - 1]);
  });

  if (atLune.length > 0)
    return atLune;

  const maxDeg = Object.keys(adj).map(v => adj[v].length).max();
  return bases.filter(basis => adj[basis[0].head].length == maxDeg);
};


export const symmetries = graph => {
  const pos = pg.barycentricPlacement(graph);

  if (!pg.isLocallyStable(graph))
    throw new Error('graph is not locally stable; cannot compute symmetries');

  const ebv = edgesByVector(graph, pos, pg.adjacencies(graph));

  const bases = goodBases(graph, characteristicBases(graph));
  const encodedBases = bases.map(b => b.map(encode));
  const keys = encodedBases.map(b => b.join(','));

  const v0 = bases[0][0].head;
  const B0 = bases[0].map(e => pg.edgeVector(e, pos));
  const invB0 = ops.inverse(B0);

  const generators = [];
  const p = new part.LabelledPartition((a, b) => a || b);

  for (let i = 0; i < bases.length; ++i) {
    if (p.find(keys[i]) != p.find(keys[0]) && !p.getLabel(keys[i])) {
      const basis = bases[i];
      const v = basis[0].head;
      const B = basis.map(e => pg.edgeVector(e, pos));

      const M = _matrixProductIfUnimodular(invB0, B);
      const iso = M && automorphism(graph, v0, v, M, ebv);

      if (iso) {
        generators.push(iso);

        for (let i = 0; i < bases.length; ++i) {
          p.union(
            keys[i],
            encodedBases[i].map(e => iso.src2img[e]).join(','));
        }
      }
      else
        p.setLabel(keys[i], true);
    }
  }

  const representativeBases = [];
  for (let i = 0; i < bases.length; ++i) {
    if (keys[i] == p.find(keys[i]))
      representativeBases.push(bases[i]);
  }

  const keyFn = phi => encodedBases[0].map(e => phi.src2img[e]).join(',');
  const symmetries = generators.length ?
    groupOfAutomorphisms(generators, keyFn) :
    [ identityAutomorphism(graph) ];

  return { generators, representativeBases, symmetries };
};


export const edgeOrbits = (graph, syms) => {
  const seen = {};
  const p = new part.Partition();

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

      p.union(ka, kb);
    }
  }

  return equivalenceClasses(p, Object.keys(seen)).map(cl => cl.map(decode));
}


function* _pairs(list) {
  for (const i in list)
    for (const j in list)
      if (j > i)
        yield [list[i], list[j]];
};


export const angleOrbits = (graph, syms, adj=pg.adjacencies(graph)) => {
  const pos = pg.barycentricPlacement(graph);
  const seen = {};
  const p = new part.Partition();

  for (const v of pg.vertices(graph)) {
    for (const [{ tail: u, shift: su }, { tail: w, shift: sw }]
         of _pairs(pg.allIncidences(graph, v, adj)))
    {
      const s = ops.minus(sw, su);
      const c = ops.plus(s, ops.minus(pos[w], pos[u]));
      const ka = encode(pg.makeEdge(u, w, s).canonical());

      if (!seen[ka]) {
        seen[ka] = true;

        for (const { src2img, transform } of syms) {
          const ux = src2img[u];
          const wx = src2img[w];
          const d = ops.minus(pos[wx], pos[ux]);
          const sx = ops.minus(ops.times(c, transform), d);
          const kb = encode(pg.makeEdge(ux, wx, sx).canonical());

          seen[kb] = true;
          p.union(ka, kb);
        }
      }
    }
  }

  return equivalenceClasses(p, Object.keys(seen)).map(cl => cl.map(decode));
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return `[ ${this.map(x => x.toString()).join(', ')} ]`;
  };

  const test = g => {
    console.log(`vertices: ${pg.vertices(g)}`);
    console.log('edges:');
    for (const e of g.edges)
      console.log(`  ${e}`);
    console.log();

    const bases = characteristicBases(g);
    console.log(`found ${bases.length} characteristic bases`);

    if (pg.isConnected(g) && pg.isLocallyStable(g)) {
      const syms = symmetries(g);
      const gens = syms.generators;
      const bases = syms.representativeBases;
      console.log(`found ${syms.symmetries.length} symmetries in total`
                  + ` from ${gens.length} generators:`);
      for (const sym of gens)
        console.log(sym.transform);
      console.log(`found ${bases.length} representative base(s):`);
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
}
