import * as I from 'immutable';

import { rationalLinearAlgebra,
         rationalLinearAlgebraModular } from '../arithmetic/types';

import modularSolver from '../arithmetic/solveRational';
import * as solveRational from '../arithmetic/solveRational';


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


export const ops = rationalLinearAlgebra.register({
  __repr__  : {
    VectorLabeledEdge: x => ({
      head: ops.repr(x.head),
      tail: ops.repr(x.tail),
      shift: ops.repr(x.shift)
    })
  },
  __VectorLabeledEdge__: {
    Object: ({ VectorLabeledEdge: obj }) =>
      new VectorLabeledEdge(
        ops.fromRepr(obj.head),
        ops.fromRepr(obj.tail),
        ops.fromRepr(obj.shift))
  }
});


class Graph {
  constructor(dim, edges) {
    this.dim = dim;
    this.edges = edges;
  }

  toString() {
    return `PGraph(${this.edges})`;
  }
};


const encode = value => ops.serialize(value);
const decode = value => ops.deserialize(value);


const dedupe = as => {
  const seen = {};
  const out = [];

  for (const a of as) {
    const key = encode(a);
    if (!seen[key]) {
      seen[key] = true;
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


export const asObject = graph => ({
  PeriodicGraph: {
    dim: graph.dim,
    edges: graph.edges.map(e => ops.repr(e))
  }
});


export const fromObject = ({ PeriodicGraph: obj }) => new Graph(
  obj.dim,
  obj.edges.map(e => ops.fromRepr(e))
);


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
  const vIdcs = I.Map(I.Range(0, verts.length).map(i => [verts[i], i]));

  const n = verts.length;
  const d = graph.dim;
  let A = ops.matrix(n, n);
  let t = ops.matrix(n, d);

  A[0][0] = 1;

  verts.forEach((v, i) => {
    if (i > 0) {
      adj[v].forEach(c => {
        if (c.v != v) {
          const j = vIdcs.get(c.v);
          A[i][j] -= 1;
          A[i][i] += 1;
          t[i] = ops.plus(t[i], c.s);
        }
      });
    }
  });

  const p = modularSolver(A, t);

  const result = I.Map(I.Range(0, n).map(i => [verts[i], p[i]]));

  graph._$pos = result;

  return result;
};


export const isStable = graph => {
  const pos = barycentricPlacement(graph);
  const verts = vertices(graph);
  const seen = I.Set().asMutable();

  for (const v of verts) {
    const p = pos.get(v);
    const key = encode(p.map(x => ops.mod(x, 1)));
    if (seen.contains(key))
      return false;
    else
      seen.add(key);
  }

  return true;
};


export const isLocallyStable = graph => {
  const pos = barycentricPlacement(graph);

  const adj = adjacencies(graph);
  const verts = vertices(graph);

  for (const v of verts) {
    const seen = I.Set().asMutable();

    for (const w of adj[v]) {
      const p = ops.plus(pos.get(w.v), w.s);
      const key = encode(p);
      if (seen.contains(key)) {
        return false;
      }
      else
        seen.add(key);
    }
  }

  return true;
};


export const allIncidences = (graph, v, adj=adjacencies(graph)) =>
  adj[v].map(({v: w, s}) => makeEdge(v, w, s));


export const edgeVector = (e, pos) =>
  ops.plus(e.shift, ops.minus(pos.get(e.tail), pos.get(e.head)));


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const test = g => {
    console.log('g = '+g);
    console.log('  cs  = '+coordinationSeq(g, 1, 10));
    if (isConnected(g)) {
      console.log('  pos = '+barycentricPlacement(g));
      console.log('  stable: '+isStable(g));
      console.log('  locally stable: '+isLocallyStable(g));
    }

    for (const comp of connectedComponents(g)) {
      console.log('  component:');
      console.log('    nodes = '+comp.nodes);
      console.log('    graph = '+comp.graph);
      console.log('    basis = '+comp.basis);
      console.log('    multiplicity = '+comp.multiplicity);
    }
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
