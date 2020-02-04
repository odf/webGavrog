import { serialize as encode } from '../common/pickler';
import { rationalLinearAlgebra as ops } from '../arithmetic/types';
import * as pg from './periodic';
import * as ps from './symmetries';


class Basis {
  constructor(dim) {
    this.dim = dim;
    this.vectors = [];
    this.matrix = ops.identityMatrix(dim);
  }

  add(vecIn) {
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
  const seen = {start};
  const queue = [start];

  while (queue.length) {
    const v = queue.shift();

    const incidences = pg.incidences(graph)[v].map(e => [
      e, ops.times(pg.edgeVector(e, pos), transform)
    ]);
    incidences.sort(([ea, da], [eb, db]) => ops.cmp(da, db));

    for (const [e] of incidences) {
      const key = encode(e);
      if (!seen[key]) {
        seen[key] = true;
        yield e;
      }

      if (!seen[e.tail]) {
        seen[e.tail] = true;
        queue.push(e.tail);
      }
    }
  }
};


const traversalWithNormalizations = (graph, traversal) => {
  const zero = ops.vector(graph.dim);
  const edges = [];
  const vertexShifts = {};
  const vertexMapping = {};
  const basis = new Basis(graph.dim);
  let nrVerticesMapped = 0;

  const advance = () => {
    const { value: e, done } = traversal.next();
    if (done)
      return false;

    if (vertexMapping[e.head] == null) {
      vertexMapping[e.head] = ++nrVerticesMapped;
      vertexShifts[e.head] = zero;
    }
    const v = vertexMapping[e.head];
    const w = vertexMapping[e.tail];

    if (w == null) {
      vertexMapping[e.tail] = ++nrVerticesMapped;
      vertexShifts[e.tail] = ops.plus(e.shift, vertexShifts[e.head]);
      edges.push([v, vertexMapping[e.tail], zero]);
    }
    else if (v <= w) {
      const shift = basis.add(ops.minus(
        ops.plus(e.shift, vertexShifts[e.head]),
        vertexShifts[e.tail]
      ));
      if (v < w || ops.sgn(shift) < 0)
        edges.push([v, w, shift]);
    }

    return true;
  };

  return {
    get(i) {
      while (edges.length <= i && advance())
        ;
      return edges[i];
    },
    result() {
      while (advance())
        ;
      return { edges, vertexMapping, basisChange: basis.matrix };
    }
  };
};


const triangulate = matrix => {
  const A = matrix.map(v => v.slice());
  const [nrows, ncols] = ops.shape(A);

  let sign = 1;
  let row = 0;
  let col = 0;

  // --- try to annihilate one entry at a time
  while (row < nrows && col < ncols) {
    // --- find the entry of smallest norm in the current column
    let pivot = null;
    let pivotRow = -1;

    for (let i = row; i < nrows; ++i) {
      const val = ops.abs(A[i][col]);
      if (ops.ne(0, val) && (pivot == null || ops.lt(val, pivot))) {
        pivot = val;
        pivotRow = i;
      }
    }

    // --- if the current column is "clean", move on to the next one
    if (pivot == null) {
      col += 1;
      continue;
    }

    // --- move the pivot to the current row
    if (pivotRow != row) {
      [A[row], A[pivotRow]] = [A[pivotRow], A[row]];
      sign = -sign;
    }

    // --- make the pivot positive
    if (ops.sgn(A[row]) < 0) {
      A[row] = ops.negative(A[row]);
      sign = -sign;
    }

    // --- attempt to clear the current column below the diagonal
    for (let i = row + 1; i < nrows; ++i) {
      if (ops.ne(0, A[i][col])) {
        const f = ops.idiv(A[i][col], A[row][col]);
        A[i] = ops.minus(A[i], ops.times(f, A[row]));
      }
    }

    // --- if clearing was successful, move on
    if (A.slice(row + 1).every(v => ops.eq(0, v[col]))) {
      row += 1;
      col += 1;
    }
  }

  // --- we're done
  return { matrix: A, sign };
};


const postprocessTraversal = trav => {
  const shifts = trav.map(([head, tail, shift]) => shift);
  const dim = ops.dimension(shifts[0]);
  const basis = triangulate(shifts).matrix.slice(0, dim);

  const basisChange = ops.inverse(basis);

  return trav.map(([head, tail, shift]) => {
    const newShift = ops.times(shift, basisChange);

    if (newShift.some(x => !ops.isInteger(x)))
      throw new Error("panic: produced non-integer shift");

    if (head == tail && ops.sgn(newShift) > 0)
      return [head, tail, ops.negative(newShift)];
    else
      return [head, tail, newShift];
  });
};


export const invariant = graph => {
  const pos = pg.barycentricPlacement(graph);
  const sym = ps.symmetries(graph);

  const _cmpSteps = ([headA, tailA, shiftA], [headB, tailB, shiftB]) =>
    (headA - headB) || (tailA - tailB) || ops.cmp(shiftA, shiftB);

  let best = null;

  const bases = sym.representativeEdgeLists;

  for (const edgeList of bases) {
    const transform = ops.inverse(edgeList.map(e => pg.edgeVector(e, pos)));
    const trav = traversalWithNormalizations(
      graph,
      placeOrderedTraversal(graph, edgeList[0].head, transform)
    );

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

  return postprocessTraversal(best.result().edges).sort(_cmpSteps);
};


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
    for (const e of invariant(g))
      console.log(e);
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
