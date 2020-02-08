import {
  serialize as encode,
  deserialize as decode
} from '../common/pickler';

import { rationalLinearAlgebra as ops } from '../arithmetic/types';
import * as pg from './periodic';
import * as ps from './symmetries';


class Basis {
  constructor() {
    this.dim = null;
    this.vectors = [];
    this.matrix = null;
  }

  add(vecIn) {
    if (this.dim == null) {
      this.dim = vecIn.length;
      this.matrix = ops.identityMatrix(this.dim);
    }

    const n = this.vectors.length;

    if (this.dim > n && ops.rank(this.vectors.concat([vecIn])) > n) {
      this.vectors.push(vecIn);

      const basis = this.vectors.slice();
      for (const vec of ops.identityMatrix(this.dim)) {
        if (ops.rank(basis.concat([vec])) > basis.length)
          basis.push(vec);
      }
      this.matrix = ops.inverse(basis);
    }
    return ops.times(vecIn, this.matrix);
  }
};


const placeOrderedTraversal = function*(graph, start, transform) {
  const pos = pg.barycentricPlacement(graph);
  const seen = {};
  const queue = [start];

  while (queue.length) {
    const v = queue.shift();

    if (!seen[v]) {
      seen[v] = true;

      const incidences = pg.incidences(graph)[v].map(e => [
        e, ops.times(pg.edgeVector(e, pos), transform)
      ]);
      incidences.sort(([ea, da], [eb, db]) => ops.cmp(da, db));

      for (const [e] of incidences) {
        queue.push(e.tail);
        yield e;
      }
    }
  }
};


const adjustedTraversal = function*(traversal) {
  const shifts = {};
  const vertexMapping = {};
  const edgeMapping = {};
  const basis = new Basis();
  let nrVerticesMapped = 0;

  for (const edge of traversal) {
    if (vertexMapping[edge.head] == null) {
      vertexMapping[edge.head] = ++nrVerticesMapped;
      shifts[edge.head] = ops.times(0, edge.shift);
    }
    const v = vertexMapping[edge.head];

    if (vertexMapping[edge.tail] == null) {
      vertexMapping[edge.tail] = ++nrVerticesMapped;
      shifts[edge.tail] = ops.plus(edge.shift, shifts[edge.head]);
    }
    const w = vertexMapping[edge.tail];

    if (v <= w) {
      const d = ops.minus(shifts[edge.head], shifts[edge.tail]);
      const shift = basis.add(ops.plus(edge.shift, d));

      if (v < w || ops.sgn(shift) < 0) {
        edgeMapping[encode(edge)] = encode(pg.makeEdge(v, w, shift));
        yield [v, w, shift];
      }
    }
  }

  return { vertexMapping, edgeMapping, basisChange: basis.matrix };
};


const buffered = iterator => {
  const generated = [];
  let returned = null;

  const advance = () => {
    const { value, done } = iterator.next();

    if (!done)
      generated.push(value);
    else if (value != null)
      returned = value;

    return !done;
  }

  return {
    get(i) {
      while (generated.length <= i && advance()) {}
      return generated[i];
    },
    result() {
      while (advance()) {}
      return { generated, returned };
    }
  };
};


const findPivot = (A, col, startRow) => {
  const pairs = A
    .map((row, i) => [ops.abs(row[col]), i])
    .filter(([x, i]) => i >= startRow && ops.sgn(x));

  if (pairs.length)
    return pairs.reduce((acc, val) => ops.lt(val[0], acc[0]) ? val : acc)[1];
};


const triangulate = matrix => {
  const A = matrix.map(v => v.slice());
  const [nrows, ncols] = ops.shape(A);

  let row = 0;

  for (let col = 0; col < ncols; ++col) {
    while (true) {
      const pivotRow = findPivot(A, col, row);
      if (pivotRow == null)
        break;

      if (pivotRow != row)
        [A[row], A[pivotRow]] = [A[pivotRow], A[row]];

      if (ops.sgn(A[row]) < 0)
        A[row] = ops.negative(A[row]);

      for (let i = row + 1; i < nrows; ++i) {
        if (ops.ne(0, A[i][col])) {
          const f = ops.idiv(A[i][col], A[row][col]);
          A[i] = ops.minus(A[i], ops.times(f, A[row]));
        }
      }

      if (A.every((v, i) => i <= row || ops.eq(0, v[col]))) {
        row += 1;
        break;
      }
    }
  }

  return A.slice(0, ncols);
};


const transformEdges = (edges, M) => edges.map(([head, tail, shift]) => {
  const newShift = ops.times(shift, M);

  if (newShift.some(x => !ops.isInteger(x)))
    throw new Error("panic: produced non-integer shift");

  if (head == tail && ops.sgn(newShift) > 0)
    return [head, tail, ops.negative(newShift)];
  else
    return [head, tail, newShift];
});


const transformEdgeMapping = (mapping, M) => {
  const result = {};

  for (const [key, val] of Object.entries(mapping)) {
    const edge = decode(val);
    const shift = ops.times(edge.shift, M);
    result[key] = encode(pg.makeEdge(edge.head, edge.tail, shift));
  }

  return result;
};


export const invariantWithMapping = graph => {
  const pos = pg.barycentricPlacement(graph);
  const sym = ps.symmetries(graph);

  const _cmpSteps = ([headA, tailA, shiftA], [headB, tailB, shiftB]) =>
    (headA - headB) || (tailA - tailB) || ops.cmp(shiftA, shiftB);

  let best = null;

  const bases = sym.representativeEdgeLists;

  for (const edgeList of bases) {
    const transform = ops.inverse(edgeList.map(e => pg.edgeVector(e, pos)));
    const base = placeOrderedTraversal(graph, edgeList[0].head, transform);
    const trav = buffered(adjustedTraversal(base));

    if (best == null)
      best = trav;
    else {
      for (let i = 0; ; ++i) {
        const next = trav.get(i);
        if (next == null)
          break;

        const d = _cmpSteps(next, best.get(i));
        if (d < 0)
          best = trav;
        else if (d > 0)
          break;
      }
    }
  }

  const { generated, returned } = best.result();
  const shifts = generated.map(([head, tail, shift]) => shift);
  const M = ops.inverse(triangulate(shifts));

  const edges = transformEdges(generated, M).sort(_cmpSteps);
  const basisChange = ops.times(returned.basisChange, M);
  const vertexMapping = returned.vertexMapping;
  const edgeMapping = transformEdgeMapping(returned.edgeMapping, M);

  return { edges, vertexMapping, edgeMapping, basisChange };
};


export const invariant = graph => invariantWithMapping(graph).edges;


export const systreKey = graph => {
  const seq = [graph.dim];

  for (const [from, to, shift] of invariant(graph)) {
    seq.push(from);
    seq.push(to);
    for (const x of shift)
      seq.push(x);
  }

  return seq.join(' ');
};


export const keyVersion = '1.0';


if (require.main == module) {
  Array.prototype.toString = function() {
    return `[ ${this.map(x => x.toString()).join(', ')} ]`;
  };

  const test = g => {
    const inv = invariantWithMapping(g);

    for (const e of g.edges)
      console.log(`${e}`);
    console.log();

    for (const k of Object.keys(inv.vertexMapping))
      console.log(`${k} => ${inv.vertexMapping[k]}`);
    console.log();

    for (const k of Object.keys(inv.edgeMapping))
      console.log(`(${decode(k)}) => (${decode(inv.edgeMapping[k])})`);
    console.log();

    console.log(inv.basisChange);
    console.log();

    for (const e of inv.edges)
      console.log(`${pg.makeEdge(...e)}`);
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
    [ [ 1, 2, [ 0, 0 ] ],
      [ 1, 2, [ 1, 0 ] ],
      [ 2, 3, [ 0, 0 ] ],
      [ 2, 3, [ 0, 1 ] ],
      [ 1, 3, [ 0, 0 ] ],
      [ 1, 3, [ 1, 1 ] ] ]
  ));
}
