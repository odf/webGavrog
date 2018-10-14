import * as pickler from '../common/pickler';

import { rationalLinearAlgebra,
         rationalLinearAlgebraModular } from '../arithmetic/types';

import modularSolver from '../arithmetic/solveRational';
import * as solveRational from '../arithmetic/solveRational';


export const ops = rationalLinearAlgebra;

const encode = pickler.serialize;
const decode = pickler.deserialize;


class VectorLabeledEdge {
  constructor(head, tail, shift) {
    this.head = head;
    this.tail = tail;
    this.shift = shift;
  }

  toString() {
    return `VectorLabeledEdge(${this.head}, ${this.tail}, ${this.shift})`;
  }

  reverse() {
    return new VectorLabeledEdge(
      this.tail, this.head, rationalLinearAlgebra.negative(this.shift));
  }

  canonical() {
    if (this.tail < this.head
        || (this.tail == this.head && this.shift.find(x => x != 0) < 0)
       )
      return this.reverse();
    else
      return this;
  }

  get __typeName() { return 'VectorLabeledEdge'; }
};


class Graph {
  constructor(dim, edges) {
    this.dim = dim;
    this.edges = edges;
  }

  toString() {
    return `PGraph(${this.edges})`;
  }

  get __typeName() { return 'PeriodicGraph'; }
};


pickler.register(
  'VectorLabeledEdge',
  ({ head, tail, shift }) => ({ head, tail, shift }),
  ({ head, tail, shift }) => new VectorLabeledEdge(head, tail, shift)
);


pickler.register(
  'PeriodicGraph',
  ({ dim, edges }) => ({ dim, edges: pickler.pickle(edges) }),
  ({ dim, edges }) => new Graph(dim, pickler.unpickle(edges))
);


const dedupe = as => {
  const seen = {};
  const out = [];

  for (const a of as) {
    if (!seen[a]) {
      seen[a] = true;
      out.push(a);
    }
  }

  return out;
};


export const makeEdge = (head, tail, shift) =>
  new VectorLabeledEdge(head, tail, shift);


export const make = data => {
  const edges = dedupe(data.map(([h, t, s]) => makeEdge(h, t, s).canonical()));

  if (edges.length == 0)
    throw new Error('cannot be empty');

  const dim = edges[0].shift.length;
  if (edges.some(e => e.shift.length != dim))
    throw new Error('must have consistent shift dimensions');

  return new Graph(dim, edges);
};


export const vertices = graph => {
  const verts = [];
  for (const e of graph.edges) {
    verts.push(e.head);
    verts.push(e.tail);
  }
  return dedupe(verts);
};


export const adjacencies = graph => {
  const target = e => ({ v: e.tail, s: e.shift });

  const res = {};
  for (const e of graph.edges) {
    if (res[e.head] == null)
      res[e.head] = [];
    res[e.head].push(target(e));

    if (res[e.tail] == null)
      res[e.tail] = [];
    res[e.tail].push(target(e.reverse()));
  }
  return res;
};


export const coordinationSeq = (graph, start, dist) => {
  const adj  = adjacencies(graph);
  const zero = ops.vector(graph.dim);

  let oldShell = {};
  let thisShell = { [JSON.stringify([start, zero])]: true };
  const res = [1];

  for (let i = 0; i < dist; ++i) {
    const nextShell = {};
    for (const item of Object.keys(thisShell)) {
      const [v, s] = JSON.parse(item);
      for (const { v: w, s: t } of adj[v]) {
        const key = JSON.stringify([w, ops.plus(s, t)]);
        if (!oldShell[key] && !thisShell[key])
          nextShell[key] = true;
      }
    }

    res.push(Object.keys(nextShell).length);
    oldShell = thisShell;
    thisShell = nextShell;
  }

  return res;
};


const _componentInOrbitGraph = (graph, start) => {
  const adj = adjacencies(graph);
  const bridges = [];
  const nodes = [start];
  const nodeShifts = { [start]: ops.vector(graph.dim) };

  for (let i = 0; i < nodes.length; ++i) {
    const v = nodes[i];
    const av = nodeShifts[v];

    for (const {v: w, s: shift} of adj[v]) {
      if (nodeShifts[w] == null) {
        nodes.push(w);
        nodeShifts[w] = ops.minus(av, shift);
      }
      else {
        const aw = nodeShifts[w];
        const newShift = ops.plus(shift, ops.minus(aw, av));
        if (ops.sgn(newShift) > 0)
          bridges.push({ v, w, s: newShift });
      }
    }
  }

  return { nodes, nodeShifts, bridges };
};


const _makeBasis = M => {
  let basis = null;
  for (const row of M)
    basis = rationalLinearAlgebraModular.extendBasis(row, basis);
  return basis;
};


const _makeCoordinateTransform = (B, dim) => {
  if (B.length < dim) {
    B = B.slice();
    for (const vec of ops.identityMatrix(dim)) {
      if (ops.rank(B.concat([vec])) > ops.rank(B))
        B.push(vec);
    }
  }

  return ops.inverse(B);
};


const _componentInCoverGraph = (graph, start) => {
  const { nodes, nodeShifts, bridges } = _componentInOrbitGraph(graph, start);
  const basis = _makeBasis(bridges.map(b => b.s));
  const dim = basis.length;
  const transform = _makeCoordinateTransform(basis, graph.dim);

  const old2new = {};
  for (let i = 0; i < nodes.length; ++i)
    old2new[nodes[i]] = i + 1;

  const newEdges = graph.edges
    .filter(({ head, tail }) => old2new[head] != null && old2new[tail] != null)
    .map(({ head, tail, shift }) => {
      const [v, w] = [old2new[head], old2new[tail]];
      const [av, aw] = [nodeShifts[head], nodeShifts[tail]];
      const t = ops.times(ops.plus(shift, ops.minus(aw, av)), transform);
      return [v, w, t.slice(0, dim)];
    });

  const multiplicity = dim == graph.dim ? ops.abs(ops.determinant(basis)) : 0;

  return { basis, multiplicity, nodes, graph: make(newEdges) };
};


export const isConnected = graph => {
  const verts = vertices(graph);
  const comp = _componentInCoverGraph(graph, verts[0]);

  return comp.nodes.length >= verts.length && comp.multiplicity == 1;
};


export const connectedComponents = graph => {
  const verts = vertices(graph);
  const seen = {};
  const result = [];

  for (const start of verts) {
    if (!seen[start]) {
      const comp = _componentInCoverGraph(graph, start);
      result.push(comp);
      for (const v of comp.nodes)
        seen[v] = true;
    }
  }

  return result;
};


export const barycentricPlacement = graph => {
  if (graph._$pos != undefined)
    return graph._$pos;

  const adj   = adjacencies(graph);
  const verts = vertices(graph);

  const vIdcs = {};
  for (let i = 0; i < verts.length; ++i)
    vIdcs[verts[i]] = i;

  const n = verts.length;
  const d = graph.dim;
  let A = ops.matrix(n, n);
  let t = ops.matrix(n, d);

  A[0][0] = 1;

  for (let i = 1; i < n; ++i) {
    const v = verts[i];
    for (const { v: w, s } of adj[v]) {
      if (w != v) {
        const j = vIdcs[w];
        A[i][j] -= 1;
        A[i][i] += 1;
        t[i] = ops.plus(t[i], s);
      }
    }
  }

  const p = modularSolver(A, t);

  const result = {};
  for (let i = 0; i < n; ++i)
    result[verts[i]] = p[i];

  graph._$pos = result;

  return result;
};


export const isStable = graph => {
  const pos = barycentricPlacement(graph);
  const verts = vertices(graph);
  const seen = {};

  for (const v of verts) {
    const key = encode(pos[v].map(x => ops.mod(x, 1)));
    if (seen[key])
      return false;
    else
      seen[key] = true;
  }

  return true;
};


export const isLocallyStable = graph => {
  const pos = barycentricPlacement(graph);

  const adj = adjacencies(graph);
  const verts = vertices(graph);

  for (const v of verts) {
    const seen = {};

    for (const { v: w, s } of adj[v]) {
      const key = encode(ops.plus(pos[w], s));
      if (seen[key])
        return false;
      else
        seen[key] = true;
    }
  }

  return true;
};


export const hasSecondOrderCollisions = graph => {
  const pos = barycentricPlacement(graph);
  const adj = adjacencies(graph);
  const verts = vertices(graph);
  const seen = {};

  for (const v of verts) {
    const vectors = allIncidences(graph, v, adj)
          .map(e => edgeVector(e, pos))
          .sort((v, w) => ops.cmp(v, w));

    const key = encode([].concat([pos[v].map(x => ops.mod(x, 1))], vectors));
    if (seen[key])
      return true;
    else
      seen[key] = true;
  }

  return false;
};


export const allIncidences = (graph, v, adj=adjacencies(graph)) =>
  adj[v].map(({v: w, s}) => makeEdge(v, w, s));


export const edgeVector = (e, pos) =>
  ops.plus(e.shift, ops.minus(pos[e.tail], pos[e.head]));


export const graphWithNormalizedShifts = graph => {
  const v0 = graph.edges[0].head;
  const adj = adjacencies(graph);
  const shifts = { [v0]: ops.vector(graph.dim) };
  const queue = [v0];

  while (queue.length) {
    const v = queue.shift();

    for (const { v: w, s } of adj[v]) {
      if (shifts[w] == null) {
        shifts[w] = ops.plus(s, shifts[v]);
        queue.push(w)
      }
    }
  }

  return make(graph.edges.map(e => {
    const h = e.head;
    const t = e.tail;
    const s = e.shift;

    return [h, t, ops.minus(shifts[t], ops.plus(shifts[h], s))];
  }));
};


export const finiteCover = (graph, cell) => {
  if (!cell.every(v => v.every(x => ops.isInteger(x))))
    throw new Error('cell vectors must be integral');
  else if (ops.eq(0, ops.determinant(cell)))
    throw new Error('cell vectors must form a basis');

  const lattice = ops.times(ops.identityMatrix(graph.dim), ops.inverse(cell));

  const origin = ops.vector(graph.dim);
  const latticePoints = [origin];
  const seen = { [encode(origin)]: true };

  for (let i = 0; i < latticePoints.length; ++i) {
    const v = latticePoints[i];
    for (const w of lattice) {
      const s = ops.mod(ops.plus(v, w), 1);
      if (!seen[encode(s)]) {
        latticePoints.push(s);
        seen[encode(s)] = true;
      }
    }
  }

  const verts = vertices(graph);
  const pos = barycentricPlacement(graph);

  let nextNode = 1;
  const coverToNode = {};

  for (const v of verts) {
    const p = ops.times(pos[v], lattice);
    for (const s of latticePoints) {
      coverToNode[encode([v, ops.mod(ops.plus(p, s), 1)])] = nextNode;
      ++nextNode;
    }
  }

  const coverEdges = [];
  for (const e of graph.edges) {
    const head = ops.times(pos[e.head], lattice);
    const tail = ops.times(ops.plus(pos[e.tail], e.shift), lattice);
    const vec = ops.minus(tail, head);
    for (const s of latticePoints) {
      const p = ops.mod(ops.plus(head, s), 1);
      const q = ops.plus(p, vec);
      const r = ops.mod(q, 1);
      const t = ops.minus(q, r);
      const v = coverToNode[encode([e.head, p])];
      const w = coverToNode[encode([e.tail, r])];
      coverEdges.push([v, w, t]);
    }
  }

  return make(coverEdges);
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const format = obj => {
    return '{ ' +
      Object.keys(obj).map(k => `${k}: ${obj[k]}`).join(', ') +
      ' }';
  };

  const test = g => {
    console.log(`g = ${g}`);
    console.log();

    console.log(`pickled: ${JSON.stringify(pickler.pickle(g))}`);
    console.log();

    console.log(`unpickled: ${pickler.unpickle(pickler.pickle(g))}`);
    console.log();

    console.log(`  cs  = ${coordinationSeq(g, 1, 10)}`);
    if (isConnected(g)) {
      const pos = barycentricPlacement(g);
      console.log(`  pos = ${format(pos)}`);
      console.log();

      const pickled = pickler.pickle(pos);
      console.log(`  pickled: ${JSON.stringify(pickled)}`);
      console.log();

      console.log(`  unpickled: ${format(pickler.unpickle(pickled))}`);
      console.log();

      console.log(`  stable: ${isStable(g)}`);
      console.log(`  locally stable: ${isLocallyStable(g)}`);
    }

    for (const comp of connectedComponents(g)) {
      console.log(`  component:`);
      console.log(`    nodes = ${comp.nodes}`);
      console.log(`    graph = ${comp.graph}`);
      console.log(`    basis = ${comp.basis}`);
      console.log(`    multiplicity = ${comp.multiplicity}`);
    }
    console.log();
    console.log();
  };

  test(make([ [ 1, 2, [ 0, 0 ] ],
              [ 1, 2, [ 1, 0 ] ],
              [ 1, 2, [ 0, 1 ] ] ]));

  test(make([ [ 1, 2, [ 0, 0, 0 ] ],
              [ 1, 2, [ 0, 1, 0 ] ],
              [ 1, 2, [ 0, 0, 1 ] ] ]));

  test(make([ [ 1, 2, [ 0, 0, 0 ] ],
              [ 1, 2, [ 1, 0, 0 ] ],
              [ 1, 2, [ 0, 1, 0 ] ],
              [ 1, 2, [ 0, 0, 1 ] ] ]));

  test(make([ [ 1, 1, [ 1, 0 ] ],
              [ 1, 1, [ 0, 1 ] ],
              [ 1, 2, [ 0, 0 ] ],
              [ 1, 2, [ 1, 1 ] ],
              [ 1, 3, [ 0, 0 ] ],
              [ 1, 3, [ 1, -1 ] ] ]));

  test(make([ [ 1, 1, [ 1, 0 ] ],
              [ 1, 1, [ 0, 1 ] ],
              [ 1, 2, [ 0, 0 ] ],
              [ 1, 2, [ 1, 1 ] ],
              [ 1, 3, [ 0, 0 ] ],
              [ 1, 3, [ 1, -1 ] ],
              [ 1, 4, [ 0, 0 ] ],
              [ 1, 4, [ 1, -1 ] ] ]));

  test(make([ [ 1, 1, [ -1,  1,  1 ] ],
              [ 1, 1, [  0, -1,  1 ] ],
              [ 1, 1, [  0,  0, -1 ] ] ]));

  test(make([ [ 1, 2, [ 0, 0, 0 ] ],
              [ 1, 2, [ 2, 0, 0 ] ],
              [ 1, 2, [ 0, 2, 0 ] ],
              [ 1, 2, [ 0, 0, 2 ] ] ]));

  test(make([ [ 1, 3, [ 0, 0, 0 ] ],
              [ 1, 3, [ 2, 0, 0 ] ],
              [ 1, 3, [ 0, 2, 0 ] ],
              [ 1, 3, [ 0, 0, 2 ] ],
              [ 2, 4, [ 0, 0, 0 ] ],
              [ 2, 4, [ 2, 0, 0 ] ],
              [ 2, 4, [ 0, 2, 0 ] ],
              [ 2, 4, [ 0, 0, 2 ] ] ]));

  test(make([ [ 1, 2, [ 0, 0, 0 ] ],
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
}
