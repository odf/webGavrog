import * as pickler from '../common/pickler';
import modularSolver from '../arithmetic/solveRational';
import * as spacegroups from '../spacegroups/spacegroups';

import {
  rationalLinearAlgebra as ops,
  rationalLinearAlgebraModular
} from '../arithmetic/types';

const encode = pickler.serialize;
const decode = pickler.deserialize;


class VectorLabeledEdge {
  constructor(head, tail, shift) {
    this.head = head;
    this.tail = tail;
    this.shift = shift;
  }

  toString() {
    if (ops.sgn(this.shift) == 0)
      return `${this.head} -> ${this.tail}`;
    else
      return `${this.head} -> ${this.tail} + ${this.shift}`;
  }

  reverse() {
    return new VectorLabeledEdge(
      this.tail, this.head, ops.negative(this.shift)
    );
  }

  canonical() {
    if (
      this.tail < this.head ||
        (this.tail == this.head && ops.sgn(this.shift) < 0)
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
    return `PGraph(${this.edges.join(', ')})`;
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


export const makeEdge = (head, tail, shift) =>
  new VectorLabeledEdge(head, tail, shift);


export const makeGraph = edgeData => {
  const seen = {};
  const edges = [];

  for (const spec of edgeData) {
    const edge = (Array.isArray(spec) ? makeEdge(...spec) : spec).canonical();
    const key = encode(edge);

    if (!seen[key]) {
      seen[key] = true;
      edges.push(edge);
    }
  }

  if (edges.length == 0)
    throw new Error('cannot be empty');

  const dim = ops.dimension(edges[0].shift);
  if (edges.some(e => ops.dimension(e.shift) != dim))
    throw new Error('must have consistent shift dimensions');

  return new Graph(dim, edges);
};


export const vertices = graph => {
  if (graph._$verts != undefined)
    return graph._$verts;

  const seen = {};
  const verts = [];

  for (const e of graph.edges) {
    for (const v of [e.head, e.tail]) {
      if (!seen[v]) {
        seen[v] = true;
        verts.push(v);
      }
    }
  }

  graph._$verts = verts;

  return verts;
};


export const incidences = graph => {
  if (graph._$incds != undefined)
    return graph._$incds;

  const res = {};

  for (const e of graph.edges) {
    if (res[e.head] == null)
      res[e.head] = [];
    res[e.head].push(e);

    if (res[e.tail] == null)
      res[e.tail] = [];
    res[e.tail].push(e.reverse());
  }

  graph._$incds = res;

  return res;
};


export const edgeVector = (e, pos) =>
  ops.plus(e.shift, ops.minus(pos[e.tail], pos[e.head]));


export function* coordinationSeq(graph, start, dist) {
  let oldShell = {};
  let currentShell = { [encode([start, ops.vector(graph.dim)])]: true };

  for (let i = 0; i < dist; ++i) {
    const nextShell = {};

    for (const item of Object.keys(currentShell)) {
      const [v, s] = decode(item);

      for (const e of incidences(graph)[v]) {
        const key = encode([e.tail, ops.plus(s, e.shift)]);

        if (!oldShell[key] && !currentShell[key])
          nextShell[key] = true;
      }
    }

    yield Object.keys(nextShell).length;

    oldShell = currentShell;
    currentShell = nextShell;
  }
};


const traverseWithShiftAdjustments = function*(graph, start) {
  const shifts = { [start]: ops.vector(graph.dim) };
  const seen = {};
  const queue = [start];

  while (queue.length) {
    const v = queue.shift();

    for (const e of incidences(graph)[v]) {
      if (shifts[e.tail] == null) {
        shifts[e.tail] = ops.plus(e.shift, shifts[v]);
        queue.push(e.tail);
      }

      const edge = e.canonical();
      const key = encode(edge);

      if (!seen[key]) {
        seen[key] = true;
        const shift = ops.minus(
          ops.plus(edge.shift, shifts[edge.head]),
          shifts[edge.tail]
        );

        yield new VectorLabeledEdge(edge.head, edge.tail, shift);
      }
    }
  }
};


export const graphWithNormalizedShifts = graph => {
  const seen = {};
  const edges = [];

  for (const v of vertices(graph)) {
    if (!seen[v]) {
      for (const e of traverseWithShiftAdjustments(graph, v)) {
        seen[e.head] = true;
        seen[e.tail] = true;
        edges.push(e);
      }
    }
  }

  return makeGraph(edges);
};


const annotatedGraphComponent = (graph, start) => {
  const edges = Array.from(traverseWithShiftAdjustments(graph, start));
  let basisVecs = null;

  for (const e of edges) {
    if (ops.sgn(e.shift) != 0)
      basisVecs = rationalLinearAlgebraModular.extendBasis(e.shift, basisVecs);
  }

  const basis = basisVecs.slice();
  const dim = basis.length;
  const multiplicity =
    dim == graph.dim ? ops.abs(ops.determinant(basis)) : Infinity;

  for (const vec of ops.identityMatrix(graph.dim)) {
    if (ops.rank(basisVecs.concat([vec])) > basisVecs.length)
      basisVecs.push(vec);
  }

  const t = ops.inverse(basisVecs).map(row => row.slice(0, dim));
  const component = makeGraph(edges.map(
    e => [e.head, e.tail, ops.times(e.shift, t)]
  ));

  return { basis, multiplicity, graph: component };
};


export const isConnected = graph => {
  const comp = annotatedGraphComponent(graph, vertices(graph)[0]);

  return (
    vertices(comp.graph).length == vertices(graph).length &&
      comp.multiplicity == 1
  );
};


export const connectedComponents = graph => {
  const seen = {};
  const result = [];

  for (const start of vertices(graph)) {
    if (!seen[start]) {
      const comp = annotatedGraphComponent(graph, start);
      result.push(comp);
      for (const v of vertices(comp.graph))
        seen[v] = true;
    }
  }

  return result;
};


export const barycentricPlacement = graph => {
  if (graph._$pos != undefined)
    return graph._$pos;

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
    for (const e of incidences(graph)[verts[i]]) {
      const j = vIdcs[e.tail];
      A[i][j] -= 1;
      A[i][i] += 1;
      t[i] = ops.plus(t[i], e.shift);
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
  const seen = {};

  for (const v of vertices(graph)) {
    const key = encode(ops.mod(pos[v], 1));
    if (seen[key])
      return false;
    else
      seen[key] = true;
  }

  return true;
};


export const isLocallyStable = graph => {
  const pos = barycentricPlacement(graph);

  for (const v of vertices(graph)) {
    const seen = {};

    for (const e of incidences(graph)[v]) {
      const key = encode(ops.plus(pos[e.tail], e.shift));
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
  const seen = {};

  for (const v of vertices(graph)) {
    const p = ops.mod(pos[v], 1);
    const vectors = incidences(graph)[v].map(e => edgeVector(e, pos));
    const key = encode([p].concat(vectors.sort((v, w) => ops.cmp(v, w))));

    if (seen[key])
      return true;
    else
      seen[key] = true;
  }

  return false;
};


export const finiteCover = (graph, superCell) => {
  const pos = barycentricPlacement(graph);
  const lattice = ops.inverse(superCell);
  const latticePoints = spacegroups.sublatticePoints(lattice);

  let nextNode = 1;
  const coverToNode = {};

  for (const v of vertices(graph)) {
    const p = ops.times(pos[v], lattice);
    for (const s of latticePoints) {
      coverToNode[encode([v, ops.mod(ops.plus(p, s), 1)])] = nextNode;
      ++nextNode;
    }
  }

  const coverEdges = [];
  for (const e of graph.edges) {
    const head = ops.times(pos[e.head], lattice);
    const vec = ops.times(edgeVector(e, pos), lattice);

    for (const s of latticePoints) {
      const p = ops.mod(ops.plus(head, s), 1);
      const q = ops.plus(p, vec);
      const v = coverToNode[encode([e.head, p])];
      const w = coverToNode[encode([e.tail, ops.mod(q, 1)])];

      coverEdges.push([v, w, q.map(x => ops.floor(x))]);
    }
  }

  return makeGraph(coverEdges);
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

    const g1 = graphWithNormalizedShifts(g);
    console.log(`graphWithNormalizedShifts(g) = ${g1}`);
    console.log();

    console.log(`pickled: ${JSON.stringify(pickler.pickle(g))}`);
    console.log();

    console.log(`unpickled: ${pickler.unpickle(pickler.pickle(g))}`);
    console.log();

    console.log(`  cs  = ${Array.from(coordinationSeq(g, 1, 10))}`);
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
      console.log(`  second-order collisions: ${hasSecondOrderCollisions(g)}`);
    }

    for (const comp of connectedComponents(g)) {
      console.log(`  component:`);
      console.log(`    nodes = ${vertices(comp.graph)}`);
      console.log(`    graph = ${comp.graph}`);
      console.log(`    basis = ${comp.basis}`);
      console.log(`    multiplicity = ${comp.multiplicity}`);
    }
    console.log();
    console.log();
  };

  test(makeGraph(
    [ [ 1, 2, [ 0, 0 ] ],
      [ 1, 2, [ 1, 0 ] ],
      [ 1, 2, [ 0, 1 ] ] ]
  ));

  test(makeGraph(
    [ [ 1, 2, [ 0, 0, 0 ] ],
      [ 1, 2, [ 0, 1, 0 ] ],
      [ 1, 2, [ 0, 0, 1 ] ] ]
  ));

  test(makeGraph(
    [ [ 1, 2, [ 0, 0, 0 ] ],
      [ 1, 2, [ 1, 0, 0 ] ],
      [ 1, 2, [ 0, 1, 0 ] ],
      [ 1, 2, [ 0, 0, 1 ] ] ]
  ));

  test(makeGraph(
    [ [ 1, 1, [ 1, 0 ] ],
      [ 1, 1, [ 0, 1 ] ],
      [ 1, 2, [ 0, 0 ] ],
      [ 1, 2, [ 1, 1 ] ],
      [ 1, 3, [ 0, 0 ] ],
      [ 1, 3, [ 1, -1 ] ] ]
  ));

  test(makeGraph(
    [ [ 1, 1, [ 1, 0 ] ],
      [ 1, 1, [ 0, 1 ] ],
      [ 1, 2, [ 0, 0 ] ],
      [ 1, 2, [ 1, 1 ] ],
      [ 1, 3, [ 0, 0 ] ],
      [ 1, 3, [ 1, -1 ] ],
      [ 1, 4, [ 0, 0 ] ],
      [ 1, 4, [ 1, -1 ] ] ]
  ));

  test(makeGraph(
    [ [ 1, 1, [ -1,  1,  1 ] ],
      [ 1, 1, [  0, -1,  1 ] ],
      [ 1, 1, [  0,  0, -1 ] ] ]
  ));

  test(makeGraph(
    [ [ 1, 2, [ 0, 0, 0 ] ],
      [ 1, 2, [ 2, 0, 0 ] ],
      [ 1, 2, [ 0, 2, 0 ] ],
      [ 1, 2, [ 0, 0, 2 ] ] ]
  ));

  test(makeGraph(
    [ [ 1, 3, [ 0, 0, 0 ] ],
      [ 1, 3, [ 2, 0, 0 ] ],
      [ 1, 3, [ 0, 2, 0 ] ],
      [ 1, 3, [ 0, 0, 2 ] ],
      [ 2, 4, [ 0, 0, 0 ] ],
      [ 2, 4, [ 2, 0, 0 ] ],
      [ 2, 4, [ 0, 2, 0 ] ],
      [ 2, 4, [ 0, 0, 2 ] ] ]
  ));

  test(makeGraph(
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
}
