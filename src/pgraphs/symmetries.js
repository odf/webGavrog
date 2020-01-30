import {
  serialize as encode,
  deserialize as decode
} from '../common/pickler';

import * as pg from './periodic';
import { rationalLinearAlgebraModular } from '../arithmetic/types';
import { coordinateChangesQ as ops } from '../geometry/types';
import * as part from '../common/unionFind';
import * as comb from '../common/combinatorics';


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


const filteredEdgeLists = (graph, lists) => {
  const headIncidences = es => pg.incidences(graph)[es[0].head];

  const atLoop =
    lists.filter(es => headIncidences(es).some(e => e.tail == e.head));

  if (atLoop.length)
    return atLoop;

  const atLune = lists.filter(es => {
    const neighbours = headIncidences(es).map(e => e.tail).sort();
    return neighbours.some((w, i) => i > 0 && w == neighbours[i - 1]);
  });

  if (atLune.length)
    return atLune;

  const headDegree = es => headIncidences(es).length;
  const maxDeg = Math.max(...lists.map(headDegree));
  return lists.filter(es => headDegree(es) == maxDeg);
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

  return filteredEdgeLists(graph, lists);
};


const automorphism = (srcStart, imgStart, transform, edgeByVec) => {
  const src2img = { [srcStart]: imgStart };
  const queue = [srcStart];

  while (queue.length) {
    const vSrc = queue.shift();
    const vImg = src2img[vSrc];

    for (const [dSrc, eSrc] of Object.entries(edgeByVec[vSrc])) {
      const dImg = encode(ops.times(decode(dSrc), transform));
      const eImg = edgeByVec[vImg][dImg];

      if (eImg == null)
        return null;

      src2img[encode(eSrc)] = encode(eImg);

      if (src2img[eSrc.tail] == null) {
        src2img[eSrc.tail] = eImg.tail;
        queue.push(eSrc.tail);
      }
      else if (src2img[eSrc.tail] != eImg.tail)
        return null;
    }
  }

  return { src2img, transform };
};


const composeMaps = (f, g) => {
  const h = {};
  for (const x of Object.keys(f)) {
    h[x] = g[f[x]];
    if (h[x] == null)
      throw new Error('automorphisms do not compose');
  }
  return h;
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
        src2img: composeMaps(phi.src2img, psi.src2img),
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


const translationalEquivalences = graph => {
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


export const isMinimal = graph => {
  const verts = pg.vertices(graph);
  const p = translationalEquivalences(graph);

  return verts.every(v => v == verts[0] || p.find(v) != p.find(verts[0]));
}


export const isLadder = graph => {
  if (pg.isStable(graph) || !pg.isLocallyStable(graph))
    return false;

  const verts = pg.vertices(graph);
  const p = translationalEquivalences(graph);
  const pos = pg.barycentricPlacement(graph);

  return verts.some(v => (
    v != verts[0] &&
      p.find(v) == p.find(verts[0]) &&
      ops.eq(ops.mod(pos[v], 1), ops.mod(pos[verts[0]], 1))
  ));
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

  return { representativeEdgeLists, symmetries: syms };
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


export const angleOrbits = (graph, syms) => {
  const pos = pg.barycentricPlacement(graph);
  const seen = {};
  const p = new part.Partition();

  for (const v of pg.vertices(graph)) {
    for (const [{ tail: u, shift: su }, { tail: w, shift: sw }]
         of _pairs(pg.incidences(graph)[v]))
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

  const res = {};

  for (const v of pg.vertices(graph)) {
    const edgeVecs = {};
    for (const e of pg.incidences(graph)[v]) {
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


const mappedEdge = (eSrc, src2img, pos, transform) => {
  const vSrc = eSrc.head;
  const wSrc = eSrc.tail;
  const dSrc = ops.minus(ops.plus(pos[wSrc], eSrc.shift), pos[vSrc]);

  const vImg = src2img[vSrc];
  const wImg = src2img[wSrc];
  const dImg = ops.times(dSrc, transform);
  const shiftImg = ops.minus(ops.plus(pos[vImg], dImg), pos[wImg]);

  return pg.makeEdge(vImg, wImg, shiftImg);
};


const extendAutomorphism = (
  startSrc, startImg, transform, uniqEdgeByVec, pos, incident, hasEdge, partial
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
    src2img[src] = img;
    img2src[img] = src;
  };

  const queue = [ [ startSrc, startImg ] ];

  while (queue.length) {
    const [ vSrc, vImg ] = queue.shift();

    if (src2img[vSrc] != null || img2src[vImg] != null) {
      if (src2img[vSrc] != vImg || img2src[vImg] != vSrc)
        return null;
    }
    else {
      assign(vSrc, vImg);

      for (const eSrc of incident[vSrc]) {
        if (src2img[eSrc.tail] != null) {
          const eImg = mappedEdge(eSrc, src2img, pos, transform);
          if (!hasEdge[encode(eImg)])
            return null;

          assign(encode(eSrc), encode(eImg));
          assign(encode(eSrc.reverse()), encode(eImg.reverse()));
        }
      }

      for (const [ dSrc, eSrc ] of Object.entries(uniqEdgeByVec[vSrc])) {
        const dImg = encode(ops.times(decode(dSrc), transform));
        const eImg = uniqEdgeByVec[vImg][dImg];

        if (eImg == null)
          return null;
        else
          queue.push([ eSrc.tail, eImg.tail ]);
      }
    }
  }

  return { src2img, img2src, transform };
};


const equalModZ = (p, q) => ops.minus(p, q).every(x => ops.isInteger(x));


export const stationarySymmetries = graph => {
  const I = ops.identityMatrix(graph.dim);
  const pos = pg.barycentricPlacement(graph);
  const ebv = uniqueEdgesByVector(graph);
  const components = strongSourceComponents(stableDeductionGraph(graph));

  const incident = {};
  for (const v of pg.vertices(graph))
    incident[v] = pg.incidences(graph)[v];

  const hasEdge = {};
  for (const e of graph.edges) {
    hasEdge[encode(e)] = true;
    hasEdge[encode(e.reverse())] = true;
  }

  const seeds = components.map(c => c[0]);
  const allCandidates = [].concat(...components);
  const candidates = seeds.map(v => (
    allCandidates.filter(w => (
      equalModZ(pos[v], pos[w])
        && extendAutomorphism(v, w, I, ebv, pos, incident, hasEdge, null)
    ))
  ));

  const symmetries = [];
  const MAX_COUNT = 50000;
  let count = 0;

  const extend = (partial, level) => {
    if (count > MAX_COUNT)
      return;

    if (level >= seeds.length)
      symmetries.push(partial);
    else {
      const v = seeds[level];

      for (const w of candidates[level]) {
        const iso = extendAutomorphism(
          v, w, I, ebv, pos, incident, hasEdge, partial
        );
        count += 1;
        iso && extend(iso, level + 1);
      }
    }
  };

  extend(null, 0);

  return { symmetries, complete: count <= MAX_COUNT };
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
    for (const el of edgeLists)
      console.log(`  ${el.map(e => e.toString())}`);
    console.log();

    if (!pg.isConnected(g)) {
      console.log(`graph is not connected`);
    }
    else {
      const ladder = isLadder(g);
      console.log(`ladder = ${ladder}`);

      if (pg.isLocallyStable(g) && !pg.hasSecondOrderCollisions(g)) {
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
          const basis = extendedTranslationBasis(g, p);
          const cls = equivalenceClasses(p, pg.vertices(g));
          console.log(`translational equivalences: ${p}`);
          console.log(`extended translation basis = ${basis}`);
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

        console.log(`stationary symmetries:`);

        const verts = pg.vertices(g);
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

  test(pg.makeGraph(
    [ [ 1, 2, [ 0, 0, 0 ] ],
      [ 1, 2, [ 1, 0, 0 ] ],
      [ 1, 2, [ 0, 1, 0 ] ],
      [ 1, 2, [ 0, 0, 1 ] ] ]
  ));

  test(pg.makeGraph(
    [ [ 1, 2, [ 0, 0, 0 ] ],
      [ 2, 1, [ 1, 0, 0 ] ],
      [ 2, 3, [ 0, 0, 0 ] ],
      [ 3, 2, [ 0, 1, 0 ] ],
      [ 3, 1, [ 0, 0, 1 ] ],
      [ 3, 1, [ 1, 1, -1 ] ] ]
  ));

  test(pg.makeGraph(
    [ [ 1, 2, [ 0, 0, 0 ] ],
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
      [ 6, 1, [ 0, 0, -1 ] ] ]
  ));

  test(pg.makeGraph(
    [ [ 1, 2, [ 0, 0 ] ],
      [ 1, 2, [ 1, 0 ] ],
      [ 2, 3, [ 0, 0 ] ],
      [ 2, 3, [ 0, 1 ] ],
      [ 1, 3, [ 0, 0 ] ],
      [ 1, 3, [ 1, 1 ] ] ]
  ));

  test(pg.makeGraph(
    [ [ 1, 2, [ 0, 0, 0 ] ],
      [ 1, 2, [ 1, 0, 0 ] ],
      [ 1, 2, [ 0, 1, 0 ] ],
      [ 1, 1, [ 0, 0, 1 ] ],
      [ 2, 2, [ 0, 0, 1 ] ] ]
  ));

  test(pg.makeGraph(
    [ [ 1, 1, [  0,  1 ] ],
      [ 1, 2, [  0,  0 ] ],
      [ 1, 2, [ -1,  0 ] ],
      [ 1, 3, [  0,  0 ] ],
      [ 1, 3, [ -1,  0 ] ],
      [ 2, 3, [  0,  0 ] ],
      [ 1, 4, [  0,  0 ] ],
      [ 1, 4, [ -1,  0 ] ],
      [ 1, 5, [  0,  0 ] ],
      [ 1, 5, [ -1,  0 ] ],
      [ 4, 5, [  0,  0 ] ] ]
  ));

  test(pg.makeGraph(
    [ [ 1, 1, [  0,  0,  1] ],
      [ 1, 2, [  0,  0,  0] ],
      [ 1, 2, [ -1,  0,  0] ],
      [ 1, 2, [  0, -1,  0] ],
      [ 1, 2, [ -1, -1,  0] ],
      [ 1, 3, [  0,  0,  0] ],
      [ 1, 3, [ -1,  0,  0] ],
      [ 1, 3, [  0, -1,  0] ],
      [ 1, 3, [ -1, -1,  0] ] ]
  ));

  test(pg.makeGraph(
    [ [ 1, 1, [ 1, 0 ] ],
      [ 1, 1, [ 0, 1 ] ],
      [ 2, 2, [ 1, 0 ] ],
      [ 2, 2, [ 0, 1 ] ],
      [ 1, 2, [ 0, 0 ] ] ]
  ));

  test(pg.makeGraph(
    [ [ 1, 1, [ 1, 0 ] ],
      [ 1, 1, [ 0, 1 ] ],
      [ 2, 2, [ 1, 0 ] ],
      [ 2, 2, [ 0, 1 ] ],
      [ 3, 3, [ 1, 0 ] ],
      [ 3, 3, [ 0, 1 ] ],
      [ 1, 2, [ 0, 0 ] ],
      [ 2, 3, [ 0, 0 ] ] ]
  ));

  test(pg.makeGraph(
    [ [ 1, 1, [ 1, 0 ] ],
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
      [ 4, 1, [ 0, 0 ] ] ]
  ));

  test(pg.makeGraph(
    [ [ 1, 1, [ 0, 0, 1 ] ],
      [ 1, 2, [ 0, 0, 0 ] ],
      [ 1, 2, [ 1, 1, 0 ] ],
      [ 1, 2, [ 1, 0, 1 ] ],
      [ 1, 2, [ 0, 1, 1 ] ] ]
  ));
}
