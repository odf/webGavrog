import * as I from 'immutable';

import { rationalLinearAlgebra,
         rationalLinearAlgebraModular } from '../arithmetic/types';

import modularSolver from '../arithmetic/solveRational';
import * as solveRational from '../arithmetic/solveRational';

import * as util from '../common/util';


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
  const result = I.OrderedSet().asMutable();
  for (const e of graph.edges) {
    result.add(e.head);
    result.add(e.tail);
  }
  return I.List(result);
};


export const adjacencies = graph => {
  const target = e => ({ v: e.tail, s: e.shift });

  let res = I.Map();
  for (const e of graph.edges) {
    res = res
      .update(e.head, a => (a || I.List()).push(target(e)))
      .update(e.tail, a => (a || I.List()).push(target(e.reverse())));
  }
  return res;
};


export const coordinationSeq = (graph, start, dist) => {
  const adj  = adjacencies(graph);
  const zero = ops.vector(graph.dim);

  let oldShell = I.Set();
  let thisShell = I.Set([I.fromJS([start, zero])]);
  const res = [1];

  for (const i of I.Range(1, dist+1)) {
    let nextShell = I.Set().asMutable();
    for (const item of thisShell) {
      const [v, s] = item.toJS();
      for (const { v: w, s: t } of adj.get(v)) {
        const key = I.fromJS([w, ops.plus(s, t)]);
        if (!oldShell.contains(key) && !thisShell.contains(key))
          nextShell.add(key);
      }
    }

    res.push(nextShell.size);
    oldShell = thisShell;
    thisShell = nextShell;
  }

  return res;
};


const _componentInOrbitGraph = (graph, start) => {
  const adj = adjacencies(graph);
  const queue = [start]
  const bridges = [];
  const nodeShifts = I.Map([[start, ops.vector(graph.dim)]]).asMutable();

  while (queue.length) {
    const v = queue.shift();
    const av = nodeShifts.get(v);

    for (const {v: w, s: shift} of adj.get(v)) {
      if (nodeShifts.get(w) == undefined) {
        queue.push(w);
        nodeShifts.set(w, ops.minus(av, shift));
      }
      else {
        const aw = nodeShifts.get(w);
        const newShift = ops.plus(shift, ops.minus(aw, av));
        const pivot = newShift.find(x => ops.ne(x, 0));

        if (pivot != undefined && ops.gt(pivot, 0))
          bridges.push({ v, w, s: newShift });
      }
    }
  }

  return {
    nodes: I.Set(nodeShifts.keys()),
    nodeShifts,
    bridges
  };
};


const _isConnectedOrbitGraph = (graph) => {
  const verts = vertices(graph);
  const comp = _componentInOrbitGraph(graph, verts.first());

  return comp.nodes.size >= verts.size;
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
      if (ops.rank(B.concat([vec])) > ops.rank(B)) {
        B.push(vec);
      }
    }
  }

  return ops.inverse(B);
};


const _componentInCoverGraph = (graph, start) => {
  const { nodes, nodeShifts, bridges } = _componentInOrbitGraph(graph, start);
  const basis = _makeBasis(bridges.map(b => b.s));
  const thisDim = basis.length;
  const transform = _makeCoordinateTransform(basis, graph.dim);
  const old2new = I.Map(I.List(nodes).zip(I.Range(1, nodes.size+1)));

  const newEdges = graph.edges
    .filter(({ head, tail }) =>
            old2new.get(head) != null && old2new.get(tail) != null)
    .map(({ head, tail, shift }) => {
      const [v, w] = [old2new.get(head), old2new.get(tail)];
      const [av, aw] = [nodeShifts.get(head), nodeShifts.get(tail)];
      const t = ops.times(ops.plus(shift, ops.minus(aw, av)), transform);
      return [v, w, t.slice(0, thisDim)];
    });

  const multiplicity =
    thisDim == graph.dim ? ops.abs(ops.determinant(basis)) : 0;

  return {
    basis,
    multiplicity,
    nodes: nodes.toArray(),
    graph: make(newEdges)
  };
};


export const isConnected = graph => {
  const verts = vertices(graph);
  const comp = _componentInCoverGraph(graph, verts.first());

  return comp.nodes.length >= verts.size && comp.multiplicity == 1;
};


export const connectedComponents = graph => {
  const verts = vertices(graph);
  const seen = I.Set().asMutable();
  const result = [];

  for (const start of verts) {
    if (!seen.contains(start)) {
      const comp = _componentInCoverGraph(graph, start);
      result.push(comp);
      comp.nodes.forEach(v => seen.add(v));
    }
  }

  return result;
};


export const barycentricPlacement = graph => {
  if (graph._$pos != undefined)
    return graph._$pos;

  const adj   = adjacencies(graph);
  const verts = vertices(graph);
  const vIdcs = I.Map(I.Range(0, verts.size).map(i => [verts.get(i), i]));

  const n = verts.size;
  const d = graph.dim;
  let A = ops.matrix(n, n);
  let t = ops.matrix(n, d);

  A[0][0] = 1;

  verts.forEach((v, i) => {
    if (i > 0) {
      adj.get(v).forEach(c => {
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

  const result = I.Map(I.Range(0, n).map(i => [verts.get(i), p[i]]));

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

    for (const w of adj.get(v)) {
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
  adj.get(v).map(({v: w, s}) => makeEdge(v, w, s)).toJS();


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
