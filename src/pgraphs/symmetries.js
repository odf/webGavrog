import {
  serialize as encode,
  deserialize as decode
} from '../common/pickler';

import * as pg from './periodic';
import { rationalLinearAlgebraModular } from '../arithmetic/types';
import { coordinateChangesQ as ops } from '../geometry/types';
import * as part from '../common/unionFind';
import * as comb from '../common/combinatorics';
import { structures } from '../io/cgd';


const mapObject = (obj, fn) => {
  const out = {};
  for (const k of Object.keys(obj))
    out[k] = fn(obj[k]);
  return out;
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


const directedEdges = function*(graph) {
  for (const e of graph.edges) {
    yield e;
    yield e.reverse();
  }
};


const goodEdgeChains = function*(graph) {
  const pos = pg.barycentricPlacement(graph);
  const dim = graph.dim;

  const extend = function*(es) {
    if (es.length == dim)
      yield es;
    else {
      const v = es[es.length - 1].tail;

      for (const e of pg.incidences(graph)[v]) {
        const next = es.concat([e]);
        const M = next.map(e => pg.edgeVector(e, pos));

        if (ops.rank(M) == next.length)
          yield* extend(next);
      }
    }
  };

  for (const e of directedEdges(graph))
    yield* extend([e]);
};


const goodCombinations = function*(edges, pos) {
  edges = Array.from(edges);

  const dim = ops.dimension(edges[0].shift);
  const vectors = edges.map(e => pg.edgeVector(e, pos));

  for (const c of comb.combinations(edges.length, dim)) {
    if (ops.rank(c.map(i => vectors[i - 1])) == dim) {
      for (const p of comb.permutations(dim))
        yield p.map(i => edges[c[i - 1] - 1]);
    }
  }
};


const characteristicEdgeLists = graph => {
  const pos = pg.barycentricPlacement(graph);
  const lists = [];

  for (const v of pg.vertices(graph)) {
    for (const es of goodCombinations(pg.incidences(graph)[v], pos))
      lists.push(es);
  }

  if (lists.length == 0) {
    for (const es of goodEdgeChains(graph))
      lists.push(es);
  }

  if (lists.length == 0) {
    for (const es of goodCombinations(directedEdges(graph), pos))
      lists.push(es);
  }

  return lists;
};


const automorphism = (startSrc, startImg, transform, edgeByVec) => {
  const src2img = {};
  const queue = [ [ startSrc, startImg ] ];

  while (queue.length) {
    const [ vSrc, vImg ] = queue.shift();

    if (src2img[vSrc] != null) {
      if (src2img[vSrc] != vImg)
        return null;
    }
    else {
      src2img[vSrc] = vImg;

      for (const [dSrc, eSrc] of Object.entries(edgeByVec[vSrc])) {
        const dImg = encode(ops.times(decode(dSrc), transform));
        const eImg = edgeByVec[vImg][dImg];
        if (eImg == null)
          return null;

        src2img[encode(eSrc)] = encode(eImg);
        queue.push([ eSrc.tail, eImg.tail ]);
      }
    }
  }

  return { src2img, transform };
};


const groupOfAutomorphisms = (identity, generators) => {
  const v0 = Object.keys(identity.src2img)[0];
  const keyFn = phi => encode([phi.src2img[v0], phi.transform]);

  const result = [identity];
  const seen = { [keyFn(identity)]: true };

  for (let next = 0; next < result.length; ++next) {
    const phi = result[next];

    for (const psi of generators) {
      const product = {
        src2img: mapObject(phi.src2img, elem => psi.src2img[elem]),
        transform: ops.times(phi.transform, psi.transform)
      };

      const key = keyFn(product);

      if (!seen[key]) {
        result.push(product);
        seen[key] = true;
      }
    }
  }

  return result;
};


const uniqueEdgesByVector = graph => {
  const pos = pg.barycentricPlacement(graph);
  const result = {};

  for (const v of pg.vertices(graph)) {
    const seen = {};
    const m = {};

    for (const e of pg.incidences(graph)[v]) {
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


const rawTranslationalEquivalences = graph => {
  const I = ops.identityMatrix(graph.dim);
  const verts = pg.vertices(graph);
  const ebv = uniqueEdgesByVector(graph);

  const p = new part.Partition();

  for (const v of verts) {
    if (p.find(verts[0]) != p.find(v)) {
      const iso = automorphism(verts[0], v, I, ebv);
      if (iso != null) {
        for (const w of verts)
          p.union(w, iso.src2img[w]);
      }
    }
  }

  return p;
};


const extendedTranslationBasis = (graph, equivs) => {
  const pos = pg.barycentricPlacement(graph);
  const verts = pg.vertices(graph);

  let basis = ops.identityMatrix(graph.dim);

  for (const v of verts) {
    if (equivs.find(v) == equivs.find(verts[0])) {
      const t = ops.mod(ops.minus(pos[v], pos[verts[0]]), 1);
      basis = rationalLinearAlgebraModular.extendBasis(t, basis);
    }
  }

  return basis;
};


const translationalEquivalences = graph => {
  const equivs = rawTranslationalEquivalences(graph);
  const orbits = equivalenceClasses(equivs, pg.vertices(graph));

  if (orbits.every(cl => cl.length == 1))
    return equivs;

  const pos = pg.barycentricPlacement(graph);
  const orb = orbits[0];
  const p0 = ops.mod(pos[orb[0]], 1);

  if (orb.slice(1).every(v => ops.ne(ops.mod(pos[v], 1), p0)))
    return equivs;
  else {
    const I = ops.identityMatrix(graph.dim);
    const ebv = uniqueEdgesByVector(graph);
    const p = new part.Partition();

    for (const b of extendedTranslationBasis(graph, equivs)) {
      const v = orb.find(v => ops.eq(ops.mod(ops.plus(b, pos[v]), 1), p0));
      const iso = automorphism(orb[0], v, I, ebv);
      for (const w of pg.vertices(graph))
        p.union(w, iso.src2img[w]);
    }

    return p;
  }
};


export const ladderSymmetries = graph => {
  if (!pg.isLocallyStable(graph))
    throw new Error('graph is not locally stable; cannot compute symmetries');

  const verts = pg.vertices(graph);
  const p = rawTranslationalEquivalences(graph);
  const pos = pg.barycentricPlacement(graph);

  const I = ops.identityMatrix(graph.dim);
  const ebv = uniqueEdgesByVector(graph);

  return verts.filter(v => (
      p.find(v) == p.find(verts[0]) &&
      ops.eq(ops.mod(pos[v], 1), ops.mod(pos[verts[0]], 1))
  )).map(v => automorphism(verts[0], v, I, ebv));
};


export const isLadder = graph => {
  if (pg.isStable(graph) || !pg.isLocallyStable(graph))
    return false;

  const verts = pg.vertices(graph);
  const p = rawTranslationalEquivalences(graph);
  const pos = pg.barycentricPlacement(graph);

  return verts.some(v => (
    v != verts[0] &&
      p.find(v) == p.find(verts[0]) &&
      ops.eq(ops.mod(pos[v], 1), ops.mod(pos[verts[0]], 1))
  ));
};


export const isMinimal = graph => {
  const verts = pg.vertices(graph);
  const p = translationalEquivalences(graph);

  return verts.every(v => v == verts[0] || p.find(v) != p.find(verts[0]));
}


export const minimalImageWithOrbits = graph => {
  const equivs = translationalEquivalences(graph);
  const orbits = equivalenceClasses(equivs, pg.vertices(graph));

  if (orbits.every(cl => cl.length == 1))
    return { graph };

  const pos = pg.barycentricPlacement(graph);
  const B = ops.inverse(extendedTranslationBasis(graph, equivs));

  const imgs = {};
  const shifts = {};

  for (let i = 0; i < orbits.length; ++i) {
    for (const v of orbits[i]) {
      imgs[v] = i + 1;
      shifts[v] = ops.minus(pos[v], pos[orbits[i][0]])
    }
  }

  const edges = graph.edges.map(e => [
    imgs[e.head],
    imgs[e.tail],
    ops.times(ops.plus(e.shift, ops.minus(shifts[e.tail], shifts[e.head])), B)
  ]);

  return { graph: pg.makeGraph(edges), orbits };
};


export const minimalImage = graph => minimalImageWithOrbits(graph).graph;


export const symmetries = graph => {
  if (graph._$syms != undefined)
    return graph._$syms;

  if (!pg.isLocallyStable(graph))
    throw new Error('graph is not locally stable; cannot compute symmetries');

  const isUnimodular = A =>
    A.every(row => row.every(x => ops.isInteger(x))) &&
    ops.eq(1, ops.abs(ops.determinant(A)));

  const pos = pg.barycentricPlacement(graph);
  const ebv = uniqueEdgesByVector(graph);

  const edgeLists = characteristicEdgeLists(graph);
  const baseVertices = edgeLists.map(es => es[0].head);
  const bases = edgeLists.map(es => es.map(e => pg.edgeVector(e, pos)));
  const keys = edgeLists.map(encode);

  const v0 = baseVertices[0];
  const invB0 = ops.inverse(bases[0]);

  const gens = [];
  const p = new part.LabelledPartition((a, b) => a || b);

  for (let i = 0; i < edgeLists.length; ++i) {
    if (p.find(keys[i]) != p.find(keys[0]) && !p.getLabel(keys[i])) {
      const M = ops.times(invB0, bases[i]);
      const iso = isUnimodular(M) && automorphism(v0, baseVertices[i], M, ebv);

      if (iso) {
        gens.push(iso);
        for (let k = 0; k < edgeLists.length; ++k) {
          const mapped = edgeLists[k].map(e => decode(iso.src2img[encode(e)]));
          p.union(keys[k], encode(mapped));
        }
      }
      else
        p.setLabel(keys[i], true);
    }
  }

  const representativeEdgeLists = keys.filter(k => k == p.find(k)).map(decode);
  const identity = automorphism(v0, v0, ops.identityMatrix(graph.dim), ebv);
  const syms = groupOfAutomorphisms(identity, gens);

  graph._$syms = { representativeEdgeLists, symmetries: syms };
  return graph._$syms;
};


export const affineSymmetries = (graph, syms) => {
  const pos = pg.barycentricPlacement(graph);
  const v = pg.vertices(graph)[0];

  return syms.map(({ src2img, transform }) => ops.affineTransformation(
    ops.transposed(transform),
    ops.minus(pos[src2img[v]], ops.times(pos[v], transform))
  ));
}


export const nodeOrbits = (graph, syms) => {
  const verts = pg.vertices(graph);
  const p = new part.Partition();

  for (const { src2img } of syms) {
    for (const v of verts)
      p.union(v, src2img[v]);
  }

  return equivalenceClasses(p, verts);
}


export const edgeOrbits = (graph, syms) => {
  const edges = graph.edges;
  const p = new part.Partition();

  for (const { src2img } of syms) {
    for (const eSrc of edges) {
      const eImg = decode(src2img[encode(eSrc)]).canonical();
      p.union(encode(eSrc), encode(eImg));
    }
  }

  return equivalenceClasses(p, edges.map(encode)).map(cl => cl.map(decode));
}


const postOrder = (vertices, outEdges) => {
  const res = [];
  const seen = {};

  const visit = v => {
    if (!seen[v]) {
      seen[v] = true;
      for (const e of outEdges[v] || [])
        visit(e.tail);
      res.push(v);
    }
  };

  for (const v of vertices)
    visit(v);

  return res;
};


const strongComponents = (vertices, outEdges) => {
  const inEdges = {};
  for (const v of vertices) {
    for (const e of outEdges[v] || []) {
      const w = e.tail;
      if (inEdges[w] == null)
        inEdges[w] = [];
      inEdges[w].push(e);
    }
  }

  const todo = postOrder(vertices, outEdges).reverse();
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
  for (const v of vertices) {
    const root = rootFor[v];
    if (underRoot[root] == null)
      underRoot[root] = [];
    underRoot[root].push(v);
  }

  return Object.values(underRoot);
};


const strongSourceComponents = (vertices, outEdges) => {
  const components = strongComponents(vertices, outEdges);

  const componentNr = {};
  for (let i = 0; i < components.length; ++i) {
    for (const v of components[i])
      componentNr[v] = i;
  }

  for (const v of vertices) {
    for (const e of outEdges[v] || []) {
      if (componentNr[e.head] != componentNr[e.tail])
        components[componentNr[e.tail]] = [];
    }
  }

  return components.filter(c => c.length);
};


const mappedEdge = (eSrc, src2img, transform, graph) => {
  const pos = pg.barycentricPlacement(graph);

  const vSrc = eSrc.head;
  const wSrc = eSrc.tail;
  const dSrc = ops.minus(ops.plus(pos[wSrc], eSrc.shift), pos[vSrc]);

  const vImg = src2img[vSrc];
  const wImg = src2img[wSrc];
  const dImg = ops.times(dSrc, transform);
  const shiftImg = ops.minus(ops.plus(pos[vImg], dImg), pos[wImg]);

  const isEdge = pg.incidences(graph)[vImg].some(
    e => e.tail == wImg && ops.eq(e.shift, shiftImg)
  );

  if (isEdge)
    return pg.makeEdge(vImg, wImg, shiftImg);
};


const extendAutomorphism = (partial, startSrc, startImg, graph, edgeByVec) => {
  const src2img = Object.assign({}, partial.src2img || {});
  const img2src = Object.assign({}, partial.img2src || {});
  const assign = (src, img) => { src2img[src] = img; img2src[img] = src; };

  const queue = [ [ startSrc, startImg ] ];

  while (queue.length) {
    const [ vSrc, vImg ] = queue.shift();

    if (src2img[vSrc] != null || img2src[vImg] != null) {
      if (src2img[vSrc] != vImg || img2src[vImg] != vSrc)
        return null;
    }
    else {
      assign(vSrc, vImg);

      // compute and check induced edge mappsings
      for (const eSrc of pg.incidences(graph)[vSrc]) {
        if (src2img[eSrc.tail] != null) {
          const eImg = mappedEdge(eSrc, src2img, partial.transform, graph);
          if (eImg == null)
            return null;

          assign(encode(eSrc), encode(eImg));
          assign(encode(eSrc.reverse()), encode(eImg.reverse()));
        }
      }

      // advance traversal along edges with unique difference vectors
      for (const [ dSrc, eSrc ] of Object.entries(edgeByVec[vSrc])) {
        const dImg = encode(ops.times(decode(dSrc), partial.transform));
        const eImg = edgeByVec[vImg][dImg];
        if (eImg == null)
          return null;

        queue.push([ eSrc.tail, eImg.tail ]);
      }
    }
  }

  return { src2img, img2src, transform: partial.transform };
};


export const stationarySymmetries = graph => {
  const init = { transform: ops.identityMatrix(graph.dim) };
  const pos = pg.barycentricPlacement(graph);
  const ebv = uniqueEdgesByVector(graph);
  const stableDigraph = mapObject(ebv, Object.values);
  const components = strongSourceComponents(pg.vertices(graph), stableDigraph);

  const seeds = components.map(c => c[0]);
  const allCandidates = [].concat(...components);
  const candidates = seeds.map(v => (
    allCandidates.filter(w => (
      ops.minus(pos[v], pos[w]).every(x => ops.isInteger(x)) &&
        extendAutomorphism(init, v, w, graph, ebv)
    ))
  ));

  const symmetries = [];
  let stepsLeft = 50000;

  const extend = (partial, level) => {
    if (level >= seeds.length)
      symmetries.push(partial);
    else if (stepsLeft > 0) {
      const v = seeds[level];

      for (const w of candidates[level]) {
        const iso = extendAutomorphism(partial, v, w, graph, ebv);
        if (--stepsLeft <= 0)
          return;
        iso && extend(iso, level + 1);
      }
    }
  };

  extend(init, 0);

  return { symmetries, complete: stepsLeft >= 0 };
};


const cycles = (perm, verts) => {
  const res = [];
  const seen = {};

  for (const v of verts) {
    if (!seen[v]) {
      const c = [v];
      seen[v] = true;

      let w = perm[v];
      while (w != v) {
        c.push(w);
        seen[w] = true;
        w = perm[w];
      }

      if (c.length > 1)
        res.push(c);
    }
  }

  return res;
};


const test = g => {
  const verts = pg.vertices(g);

  console.log(`vertices: ${verts}`);
  console.log('edges:');
  for (const e of g.edges)
    console.log(`  ${e}`);
  console.log();

  if (!pg.isConnected(g)) {
    console.log(`graph is not connected`);
  }
  else {
    if (pg.isLocallyStable(g)) { // && !pg.hasSecondOrderCollisions(g)) {
      const charEdgeLists = characteristicEdgeLists(g);
      console.log(`found ${charEdgeLists.length} characteristic edgeLists`);
      //for (const el of charEdgeLists)
      //  console.log(`  ${el.map(e => e.toString())}`);
      //console.log();

      const syms = symmetries(g);
      console.log(`found ${syms.symmetries.length} symmetries`);
      //affineSymmetries(g, syms.symmetries);
      //  .sort((a, b) => ops.cmp(a, b))
      //  .forEach(t => console.log(t));

      const edgeLists = syms.representativeEdgeLists;
      console.log(`found ${edgeLists.length} representative base(s)`);
      for (const edgeList of edgeLists)
        console.log(`${edgeList}`);
      console.log();

      console.log(`ladder = ${isLadder(g)}`);
      console.log(`minimal = ${isMinimal(g)}`);

      if (!isMinimal(g)) {
        const p = translationalEquivalences(g);
        const basis = extendedTranslationBasis(g, p);
        const cls = equivalenceClasses(p, verts);
        console.log(`translational equivalences: ${p}`);
        console.log(`extended translation basis = ${basis}`);
        console.log(`equivalence classes: ${cls}`);
        console.log(`minimal image: ${minimalImage(g)}`);
      }
      console.log();

      const vOrbits = nodeOrbits(g, syms.symmetries);
      console.log(`vertex orbits:`);
      for (let i = 0; i < vOrbits.length; ++i)
        console.log(`  ${vOrbits[i]}`);
      console.log();

      const eOrbits = edgeOrbits(g, syms.symmetries);
      console.log(`edge orbits:`);
      for (let i = 0; i < eOrbits.length; ++i) {
        if (i > 0)
          console.log();
        for (const e of eOrbits[i])
          console.log(`  ${e}`);
      }
    }
    else {
      console.log(`stable deduction graph:`);
      const sdg = mapObject(uniqueEdgesByVector(g), Object.values);
      for (const k of Object.keys(sdg)) {
        for (const e of sdg[k])
          console.log(`  ${e}`);
      }

      console.log(
        `strong components: ${JSON.stringify(strongComponents(verts, sdg))}`
      );

      const sourceComponents = strongSourceComponents(verts, sdg);
      console.log(
        `strong source components: ${JSON.stringify(sourceComponents)}`
      );

      console.log(`stationary symmetries:`);

      const stationary = stationarySymmetries(g);
      for (const s of stationary.symmetries) {
        const cs = cycles(s.src2img, verts);
        if (cs.length == 0)
          console.log('()');
        else
          console.log(cs.map(c => `(${c.join(',')})`).join(''));
      }
      if (!stationary.complete)
        console.log('...');
    }
  }

  console.log();
  console.log();
  console.log();
};


const examples = [
  [
    [ 1, 2, [ 0, 0, 0 ] ],
    [ 1, 2, [ 1, 0, 0 ] ],
    [ 1, 2, [ 0, 1, 0 ] ],
    [ 1, 2, [ 0, 0, 1 ] ]
  ],

  [
    [ 1, 2, [ 0, 0, 0 ] ],
    [ 2, 1, [ 1, 0, 0 ] ],
    [ 2, 3, [ 0, 0, 0 ] ],
    [ 3, 2, [ 0, 1, 0 ] ],
    [ 3, 1, [ 0, 0, 1 ] ],
    [ 3, 1, [ 1, 1, -1 ] ]
  ],

  [
    [ 1, 2, [ 0, 0, 0 ] ],
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
    [ 6, 1, [ 0, 0, -1 ] ]
  ],

  [
    [ 1, 2, [ 0, 0 ] ],
    [ 1, 2, [ 1, 0 ] ],
    [ 2, 3, [ 0, 0 ] ],
    [ 2, 3, [ 0, 1 ] ],
    [ 1, 3, [ 0, 0 ] ],
    [ 1, 3, [ 1, 1 ] ]
  ],

  [
    [ 1, 2, [ 0, 0, 0 ] ],
    [ 1, 2, [ 1, 0, 0 ] ],
    [ 1, 2, [ 0, 1, 0 ] ],
    [ 1, 1, [ 0, 0, 1 ] ],
    [ 2, 2, [ 0, 0, 1 ] ]
  ],

  [
    [ 1, 1, [  0,  1 ] ],
    [ 1, 2, [  0,  0 ] ],
    [ 1, 2, [ -1,  0 ] ],
    [ 1, 3, [  0,  0 ] ],
    [ 1, 3, [ -1,  0 ] ],
    [ 2, 3, [  0,  0 ] ],
    [ 1, 4, [  0,  0 ] ],
    [ 1, 4, [ -1,  0 ] ],
    [ 1, 5, [  0,  0 ] ],
    [ 1, 5, [ -1,  0 ] ],
    [ 4, 5, [  0,  0 ] ]
  ],

  [
    [ 1, 1, [  0,  0,  1] ],
    [ 1, 2, [  0,  0,  0] ],
    [ 1, 2, [ -1,  0,  0] ],
    [ 1, 2, [  0, -1,  0] ],
    [ 1, 2, [ -1, -1,  0] ],
    [ 1, 3, [  0,  0,  0] ],
    [ 1, 3, [ -1,  0,  0] ],
    [ 1, 3, [  0, -1,  0] ],
    [ 1, 3, [ -1, -1,  0] ]
  ],

  [
    [ 1, 1, [ 1, 0 ] ],
    [ 1, 1, [ 0, 1 ] ],
    [ 2, 2, [ 1, 0 ] ],
    [ 2, 2, [ 0, 1 ] ],
    [ 1, 2, [ 0, 0 ] ]
  ],

  [
    [ 1, 1, [ 1, 0 ] ],
    [ 1, 1, [ 0, 1 ] ],
    [ 2, 2, [ 1, 0 ] ],
    [ 2, 2, [ 0, 1 ] ],
    [ 3, 3, [ 1, 0 ] ],
    [ 3, 3, [ 0, 1 ] ],
    [ 1, 2, [ 0, 0 ] ],
    [ 2, 3, [ 0, 0 ] ]
  ],

  [
    [ 1, 1, [ 1, 0 ] ],
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
    [ 4, 1, [ 0, 0 ] ]
  ],

  [
    [ 1, 1, [ 0, 0, 1 ] ],
    [ 1, 2, [ 0, 0, 0 ] ],
    [ 1, 2, [ 1, 1, 0 ] ],
    [ 1, 2, [ 1, 0, 1 ] ],
    [ 1, 2, [ 0, 1, 1 ] ]
  ],

  [
    [ 1, 2, [ 0, 0 ] ],
    [ 2, 1, [ 1, 0 ] ],
    [ 3, 4, [ 0, 0 ] ],
    [ 4, 3, [ 1, 0 ] ],
    [ 1, 3, [ 0, 0 ] ],
    [ 3, 1, [ 0, 1 ] ],
    [ 2, 4, [ 0, 0 ] ],
    [ 4, 2, [ 0, 1 ] ],
    [ 5, 6, [ 0, 0 ] ],
    [ 6, 5, [ 1, 0 ] ],
    [ 7, 8, [ 0, 0 ] ],
    [ 8, 7, [ 1, 0 ] ],
    [ 5, 7, [ 0, 0 ] ],
    [ 7, 5, [ 0, 1 ] ],
    [ 6, 8, [ 0, 0 ] ],
    [ 8, 6, [ 0, 1 ] ],
    [ 1, 5, [ 0, 0 ] ],
    [ 2, 6, [ 0, 0 ] ],
    [ 3, 7, [ 0, 0 ] ],
    [ 4, 8, [ 0, 0 ] ]
  ]
];


if (require.main == module) {
  Array.prototype.toString = function() {
    return `[ ${this.map(x => x.toString()).join(', ')} ]`;
  };

  for (const edges of examples)
    test(pg.makeGraph(edges));
}
