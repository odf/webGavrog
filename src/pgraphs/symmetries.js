import * as pickler from '../common/pickler';

import * as pg from './periodic';
import { rationalLinearAlgebraModular } from '../arithmetic/types';
import { coordinateChangesQ } from '../geometry/types';
import * as part from '../common/unionFind';
import * as comb from '../common/combinatorics';


const ops = coordinateChangesQ;

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


const characteristicEdgeLists = graph => {
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


const automorphism = (srcStart, imgStart, transform, edgeByVec) => {
  const src2img = { [srcStart]: imgStart };
  const queue = [srcStart];

  while (queue.length) {
    const w1 = queue.shift();
    const w2 = src2img[w1];

    for (const [d1, e1] of Object.entries(edgeByVec[w1])) {
      const e2 = edgeByVec[w2][encode(ops.times(decode(d1), transform))];
      if (e2 == null)
        return null;

      src2img[encode(e1)] = encode(e2);

      if (src2img[e1.tail] == null) {
        src2img[e1.tail] = e2.tail;
        queue.push(e1.tail);
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
  const pos = pg.barycentricPlacement(graph);
  const adj = pg.adjacencies(graph);
  const ebv = uniqueEdgesByVector(graph, pos, adj);

  for (const v of verts.slice(1)) {
    if (automorphism(start, v, id, ebv) != null)
      return false;
  }

  return true;
}


export const isLadder = graph => {
  if (pg.isStable(graph) || !pg.isLocallyStable(graph))
    return false;

  const id = ops.identityMatrix(graph.dim);
  const verts = pg.vertices(graph);
  const start = verts[0];
  const pos = pg.barycentricPlacement(graph);
  const adj = pg.adjacencies(graph);
  const ebv = uniqueEdgesByVector(graph, pos, adj);

  for (const v of verts) {
    if (v == start)
      continue;

    const d = ops.minus(pos[v], pos[start]);
    if (d.every(x => ops.eq(ops.mod(x, 1), 0))) {
      if (automorphism(start, v, id, ebv) != null)
        return true;
    }
  }

  return false;
};


const translationalEquivalences = graph => {
  const id = ops.identityMatrix(graph.dim);
  const verts = pg.vertices(graph);
  const start = verts[0];
  const pos = pg.barycentricPlacement(graph);
  const adj = pg.adjacencies(graph);
  const ebv = uniqueEdgesByVector(graph, pos, adj);

  const p = new part.Partition();

  for (const v of verts) {
    if (p.find(start) != p.find(v)) {
      const iso = automorphism(start, v, id, ebv);
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


export const minimalImageWithOrbits = graph => {
  if (isMinimal(graph))
    return { graph };
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

    return {
      graph: pg.make(imgEdges),
      orbits: classes
    };
  }
};


export const minimalImage = graph => minimalImageWithOrbits(graph).graph;


const isUnimodular = A =>
  A.every(row => row.every(x => ops.isInteger(x))) &&
  ops.eq(1, ops.abs(ops.determinant(A)));


const uniqueEdgesByVector = (graph, pos, adj) => {
  const result = {};

  for (const v of pg.vertices(graph)) {
    const seen = {};
    const m = {};

    for (const e of pg.allIncidences(graph, v, adj)) {
      const key = encode(pg.edgeVector(e, pos));
      if (seen[key])
        delete m[key];
      else {
        m[key] = e;
        seen[key] = true;
      }
    }

    result[v] = m;
  }

  return result;
};


const goodEdgeLists = (graph, edgeLists) => {
  const adj = pg.adjacencies(graph);

  const atLoop = edgeLists.filter(edgeList => {
    const v = edgeList[0].head;
    return adj[v].some(e => e.tail == v);
  });

  if (atLoop.length > 0)
    return atLoop;

  const atLune = edgeLists.filter(edgeList => {
    const v = edgeList[0].head;
    const neighbours = adj[v].map(e => e.tail).sort();
    return neighbours.some((w, i) => i > 0 && w == neighbours[i - 1]);
  });

  if (atLune.length > 0)
    return atLune;

  const maxDeg = Object.keys(adj).map(v => adj[v].length).max();
  return edgeLists.filter(edgeList => adj[edgeList[0].head].length == maxDeg);
};


export const symmetries = graph => {
  const pos = pg.barycentricPlacement(graph);

  if (!pg.isLocallyStable(graph))
    throw new Error('graph is not locally stable; cannot compute symmetries');

  const ebv = uniqueEdgesByVector(graph, pos, pg.adjacencies(graph));

  const edgeLists = goodEdgeLists(graph, characteristicEdgeLists(graph));
  const bases = edgeLists.map(es => ({
    v: es[0].head,
    B: es.map(e => pg.edgeVector(e, pos))
  }));
  const keys = edgeLists.map(encode);
  const mapped = (es, phi) => es.map(e => decode(phi.src2img[encode(e)]));

  const v0 = bases[0].v;
  const invB0 = ops.inverse(bases[0].B);

  const I = ops.identityMatrix(graph.dim);
  const gens = [automorphism(v0, v0, I, ebv)];

  const p = new part.LabelledPartition((a, b) => a || b);

  for (let i = 0; i < edgeLists.length; ++i) {
    if (p.find(keys[i]) != p.find(keys[0]) && !p.getLabel(keys[i])) {
      const { v, B } = bases[i];
      const M = ops.times(invB0, B);
      const iso = isUnimodular(M) && automorphism(v0, v, M, ebv);

      if (iso) {
        gens.push(iso);
        for (let k = 0; k < edgeLists.length; ++k)
          p.union(keys[k], encode(mapped(edgeLists[k], iso)));
      }
      else
        p.setLabel(keys[i], true);
    }
  }

  return {
    representativeEdgeLists: keys.filter(k => k == p.find(k)).map(decode),
    symmetries: groupOfAutomorphisms(
      gens, phi => encode(mapped(edgeLists[0], phi)))
  };
};


export const affineSymmetries = (graph, syms) => {
  const I = ops.identityMatrix(graph.dim);
  const pos = pg.barycentricPlacement(graph);
  const v = pg.vertices(graph)[0];

  return syms.map(({ src2img, transform }) => {
    const s = ops.minus(pos[src2img[v]], ops.times(pos[v], transform));
    return ops.affineTransformation(ops.transposed(transform), s);
  });
}


export const nodeOrbits = (graph, syms) => {
  const seen = {};
  const p = new part.Partition();

  for (const v of pg.vertices(graph)) {
    const kv = encode(v);
    if (seen[kv])
      continue;
    seen[kv] = true;

    for (const phi of syms) {
      const w = phi.src2img[v];
      const kw = encode(w);
      if (seen[kw])
        continue;
      seen[kw] = true;

      p.union(v, w);
    }
  }

  return equivalenceClasses(p, Object.keys(seen).map(decode));
}


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


const stableDeductionGraph = graph => {
  const pos = pg.barycentricPlacement(graph);
  const adj = pg.adjacencies(graph);

  const res = {};

  for (const v of pg.vertices(graph)) {
    const edgeVecs = {};
    for (const e of pg.allIncidences(graph, v, adj)) {
      const k = encode(pg.edgeVector(e, pos));
      if (edgeVecs[k] == null)
        edgeVecs[k] = [];
      edgeVecs[k].push(e);
    }

    const outEdges = [];
    for (const k of Object.keys(edgeVecs)) {
      if (edgeVecs[k].length == 1)
        outEdges.push(edgeVecs[k][0]);
    }
    res[encode(v)] = outEdges;
  }

  return res;
};


const postOrder = outEdges => {
  const res = [];
  const seen = {};

  const visit = v => {
    if (!seen[v]) {
      seen[v] = true;
      for (const e of outEdges[v])
        visit(e.tail);
      res.push(v);
    }
  };

  for (const v of Object.keys(outEdges))
    visit(decode(v));

  return res;
};


const strongComponents = outEdges => {
  const inEdges = {};
  for (const v of Object.keys(outEdges)) {
    for (const e of outEdges[v]) {
      const w = e.tail;
      if (inEdges[w] == null)
        inEdges[w] = [];
      inEdges[w].push(e);
    }
  }

  const todo = postOrder(outEdges).reverse();
  const rootFor = {};
  const stack = [];

  for (const root of todo) {
    stack.push(root);

    while (stack.length) {
      const v = stack.pop();
      if (rootFor[v] == null) {
        rootFor[v] = root;
        for (const e of inEdges[v] || [])
          stack.push(e.head);
      }
    }
  }

  const underRoot = {};
  for (const v of Object.keys(outEdges)) {
    const root = rootFor[v];
    if (underRoot[root] == null)
      underRoot[root] = [];
    underRoot[root].push(decode(v));
  }

  return Object.values(underRoot);
};


const strongSourceComponents = outEdges => {
  const components = strongComponents(outEdges);

  const node2component = {};
  for (let i = 0; i < components.length; ++i) {
    for (const v of components[i])
      node2component[v] = i;
  }

  const isSource = components.map(_ => true);
  for (const v of Object.keys(outEdges)) {
    for (const e of outEdges[v]) {
      const cHead = node2component[e.head];
      const cTail = node2component[e.tail];
      if (cHead != cTail)
        isSource[cTail] = false;
    }
  }

  return components.filter((c, i) => isSource[i]);
};


const edgeListCandidates = graph => {
  const adj = pg.adjacencies(graph);
  const pos = pg.barycentricPlacement(graph);

  const stars = [].concat(...pg.vertices(graph).map(
    v => _goodCombinations(pg.allIncidences(graph, v, adj), pos)));

  const chains = _goodEdgeChains(graph);

  const scatters = _goodCombinations(_directedEdges(graph), pos);

  return { stars, chains, scatters };
};


const edgeListsForComponents = (components, edgeLists) => {
  const { stars, chains, scatters } = edgeLists;

  for (const lists of [stars, chains, scatters]) {
    const res = components.map(
      nodes => lists.filter(list => nodes.includes(list[0].head))
    );
    if (res.every(els => els.length > 0))
      return res;
  }
};


const extendAutomorphism = (
  startSrc, startImg, transform, edgeByVec, partial
) => {
  const src2img = {};
  const img2src = {};
  if (partial) {
    if (ops.ne(partial.transform, transform))
      return null;
    Object.assign(src2img, partial.src2img);
    Object.assign(img2src, partial.img2src);
  }

  const assign = (src, img) => {
    if (src2img[src] != null && src2img[src] != img)
      return false;
    if (img2src[img] != null && img2src[img] != src)
      return false;

    src2img[src] = img;
    img2src[img] = src;
    return true;
  };

  if (!assign(startSrc, startImg))
    return null;

  const queue = [startSrc];

  while (queue.length) {
    const wSrc = queue.shift();
    const wImg = src2img[wSrc];

    for (const [dSrc, eSrc] of Object.entries(edgeByVec[wSrc])) {
      const isNew = src2img[eSrc.tail] == null;
      const eImg = edgeByVec[wImg][encode(ops.times(decode(dSrc), transform))];

      if (eImg == null || !assign(eSrc.tail, eImg.tail))
        return null;
      else if (isNew)
        queue.push(eSrc.tail);
    }
  }

  return { src2img, img2src, transform };
};


const extendAutomorphismWithEdges = (graph, iso) => {
  const { transform } = iso;
  const src2img = Object.assign({}, iso.src2img);
  const img2src = Object.assign({}, iso.img2src);

  const hasEdge = {};
  for (const e of graph.edges) {
    hasEdge[encode(e)] = true;
    hasEdge[encode(e.reverse())] = true;
  }

  const pos = pg.barycentricPlacement(graph);

  const assign = (src, img) => {
    src2img[src] = img;
    img2src[img] = src;
  };

  for (const eSrc of graph.edges) {
    const vSrc = eSrc.head;
    const wSrc = eSrc.tail;
    const dSrc = ops.minus(ops.plus(pos[wSrc], eSrc.shift), pos[vSrc]);

    const vImg = iso.src2img[vSrc];
    const wImg = iso.src2img[wSrc];
    const dImg = ops.times(dSrc, transform);
    const shiftImg = ops.minus(ops.plus(pos[vImg], dImg), pos[wImg]);

    const eImg = pg.makeEdge(vImg, wImg, shiftImg);
    if (!hasEdge[encode(eImg)])
      return null;

    assign(encode(eSrc), encode(eImg));
    assign(encode(eSrc.reverse()), encode(eImg.reverse()));
  }

  return { src2img, img2src, transform };
};


const collectBasesUnstable = graph => {
  const pos = pg.barycentricPlacement(graph);

  const sourceEdgeLists = edgeListsForComponents(
    strongSourceComponents(stableDeductionGraph(graph)),
    edgeListCandidates(graph)
  );

  const seedIndices = [];
  const bases = [];
  const basesSeen = {};

  for (const els of sourceEdgeLists) {
    seedIndices.push(bases.length);

    for (const es of els) {
      const base = { v: es[0].head, B: es.map(e => pg.edgeVector(e, pos)) };
      const key = encode(base);

      if (!basesSeen[key]) {
        bases.push(base);
        basesSeen[key] = true;
      }
    }
  }

  return { bases, seedIndices };
};


export const symmetriesUnstable = graph => {
  const pos = pg.barycentricPlacement(graph);
  const ebv = uniqueEdgesByVector(graph, pos, pg.adjacencies(graph));
  const { bases, seedIndices } = collectBasesUnstable(graph);

  const gens = [];

  const extend = (partial, level) => {
    if (level >= seedIndices.length) {
      const res = extendAutomorphismWithEdges(graph, partial);
      res && gens.push(res);
    }
    else {
      const { v: vSrc, B: BSrc } = bases[seedIndices[level]];

      for (const { v: vImg, B: BImg } of bases) {
        const M = ops.times(ops.inverse(BSrc), BImg);
        const good = level ? ops.eq(M, partial.transform) : isUnimodular(M);
        const iso = good && extendAutomorphism(vSrc, vImg, M, ebv, partial);
        iso && extend(iso, level + 1);
      }
    }
  };

  extend(null, 0);

  return gens;
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

    const edgeLists = characteristicEdgeLists(g);
    console.log(`found ${edgeLists.length} characteristic edgeLists`);
    for (const el of edgeLists.slice(0, 4))
      console.log(`  ${el.map(e => e.toString())}`);
    if (edgeLists.length > 4)
      console.log(`  ...`);
    console.log();

    if (
      pg.isConnected(g) &&
        pg.isLocallyStable(g) &&
        !pg.hasSecondOrderCollisions(g)
    ) {
      const syms = symmetries(g);
      const edgeLists = syms.representativeEdgeLists;
      console.log(`found ${syms.symmetries.length} symmetries`);

      const transforms = affineSymmetries(g, syms.symmetries);
      transforms
        .sort((a, b) => ops.cmp(a, b))
        .forEach(t => console.log(t));

      console.log(`found ${edgeLists.length} representative base(s)`);
      for (const edgeList of edgeLists)
        console.log(`${edgeList}`);
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
    else {
      console.log(`stable deduction graph:`);
      const sdg = stableDeductionGraph(g);
      for (const k of Object.keys(sdg)) {
        for (const e of sdg[k])
          console.log(`  ${e}`);
      }
      console.log(
        `strong components: ${JSON.stringify(strongComponents(sdg))}`
      );

      const sourceComponents = strongSourceComponents(sdg);
      console.log(
        `strong source components: ${JSON.stringify(sourceComponents)}`
      );

      const syms = symmetriesUnstable(g);
      console.log(`stationary symmetries:`);
      const I = ops.identityMatrix(g.dim);
      for (const s of syms) {
        if (ops.eq(s.transform, I)) {
          const d = {};
          for (const k of Object.keys(s.src2img)) {
            if (Number.isInteger(decode(k)))
              d[k] = s.src2img[k];
          }
          console.log(`  ${JSON.stringify(d)}`);
        }
      }
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

  test(pg.make([ [ 1, 1, [  0,  1 ] ],
                 [ 1, 2, [  0,  0 ] ],
                 [ 1, 2, [ -1,  0 ] ],
                 [ 1, 3, [  0,  0 ] ],
                 [ 1, 3, [ -1,  0 ] ],
                 [ 2, 3, [  0,  0 ] ],
                 [ 1, 4, [  0,  0 ] ],
                 [ 1, 4, [ -1,  0 ] ],
                 [ 1, 5, [  0,  0 ] ],
                 [ 1, 5, [ -1,  0 ] ],
                 [ 4, 5, [  0,  0 ] ] ]));

  test(pg.make([ [ 1, 1, [  0,  0,  1] ],
                 [ 1, 2, [  0,  0,  0] ],
                 [ 1, 2, [ -1,  0,  0] ],
                 [ 1, 2, [  0, -1,  0] ],
                 [ 1, 2, [ -1, -1,  0] ],
                 [ 1, 3, [  0,  0,  0] ],
                 [ 1, 3, [ -1,  0,  0] ],
                 [ 1, 3, [  0, -1,  0] ],
                 [ 1, 3, [ -1, -1,  0] ] ]));

  test(pg.make([ [ 1, 1, [ 1, 0 ] ],
                 [ 1, 1, [ 0, 1 ] ],
                 [ 2, 2, [ 1, 0 ] ],
                 [ 2, 2, [ 0, 1 ] ],
                 [ 1, 2, [ 0, 0 ] ] ]));

  test(pg.make([ [ 1, 1, [ 1, 0 ] ],
                 [ 1, 1, [ 0, 1 ] ],
                 [ 2, 2, [ 1, 0 ] ],
                 [ 2, 2, [ 0, 1 ] ],
                 [ 3, 3, [ 1, 0 ] ],
                 [ 3, 3, [ 0, 1 ] ],
                 [ 1, 2, [ 0, 0 ] ],
                 [ 2, 3, [ 0, 0 ] ] ]));

  test(pg.make([ [ 1, 1, [ 1, 0 ] ],
                 [ 1, 1, [ 0, 1 ] ],
                 [ 2, 2, [ 1, 0 ] ],
                 [ 2, 2, [ 0, 1 ] ],
                 [ 3, 3, [ 1, 0 ] ],
                 [ 3, 3, [ 0, 1 ] ],
                 [ 4, 4, [ 1, 0 ] ],
                 [ 4, 4, [ 0, 1 ] ],
                 [ 1, 2, [ 0, 0 ] ],
                 [ 2, 3, [ 0, 0 ] ],
                 [ 3, 4, [ 0, 0 ] ],
                 [ 4, 1, [ 0, 0 ] ] ]));
}
