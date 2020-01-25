import * as S from '../common/lazyseq';

import * as pg from './periodic';
import * as ps from './symmetries';

import { rationalLinearAlgebra,
         rationalLinearAlgebraModular } from '../arithmetic/types';

const ops = rationalLinearAlgebra;


const DEBUG = false;


const _solveInRows = (v, M) =>
  ops.transposed(ops.solve(ops.transposed(M), ops.transposed(v)));


const _traversal = function*(graph, v0, transform) {
  const zero = ops.vector(graph.dim);

  const pos = pg.barycentricPlacement(graph);
  const old2new = {[v0]: 1};
  const newPos = { [v0]: ops.times(pos[v0], transform) };
  const queue = [[v0, zero]];
  const essentialShifts = [];

  let next = 2;
  let basisAdjustment = null;

  while (queue.length) {
    const [vo, vShift] = queue.shift();
    const vn = old2new[vo];

    const neighbors = [];
    for (const e of pg.incidences(graph)[vo]) {
      const w = e.tail;
      const s = ops.plus(vShift, ops.times(e.shift, transform));
      neighbors.push([w, s, ops.plus(s, ops.times(pos[w], transform))]);
    }

    neighbors.sort(([wa, sa, pa], [wb, sb, pb]) => ops.cmp(pa, pb));

    for (const [wo, s, p] of neighbors) {
      const wn = old2new[wo];
      if (wn == null) {
        yield [vn, next, zero];
        old2new[wo] = next++;
        newPos[wo] = p;
        queue.push([wo, s]);
      }
      else if (wn < vn)
        continue;
      else {
        const rawShift = ops.minus(p, newPos[wo]);
        let shift;
        if (basisAdjustment != null)
          shift = ops.times(rawShift, basisAdjustment);
        else if (ops.sgn(rawShift) == 0)
          shift = rawShift;
        else {
          if (essentialShifts.length)
            shift = _solveInRows(rawShift, essentialShifts);

          if (shift == null) {
            shift = ops.unitVector(graph.dim, essentialShifts.length);
            essentialShifts.push(rawShift);
            if (essentialShifts.length == graph.dim)
              basisAdjustment = ops.inverse(essentialShifts);
          }
          else
            shift = shift[0].concat(ops.vector(graph.dim - shift[0].length));
        }
        if (vn < wn || (vn == wn && ops.sgn(shift) < 0))
          yield [vn, wn, shift];
      }
    }
  }
};


const _triangulate = matrix => {
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


const _postprocessTraversal = trav => {
  const shifts = trav.map(([head, tail, shift]) => shift);
  const dim = ops.dimension(shifts[0]);
  const basis = _triangulate(shifts).matrix.slice(0, dim);

  if (DEBUG)
    console.log(`Shift basis: Matrix(${basis})\n`);

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


const printEdge = e => `(${e.head},${e.tail},${e.shift}])`;
const printStep = ([head, tail, shift]) => `  (${head},${tail},${shift})`;
const printTraversal = trav => trav.toArray().map(printStep).join('\n')


export const invariant = graph => {
  if (DEBUG)
    console.log(`Computing invariant for ${graph.edges.map(printEdge)}\n`);

  const pos = pg.barycentricPlacement(graph);
  const sym = ps.symmetries(graph);

  const _cmpSteps = ([headA, tailA, shiftA], [headB, tailB, shiftB]) =>
    (headA - headB) || (tailA - tailB) || ops.cmp(shiftA, shiftB);

  let best = null;

  const bases = sym.representativeEdgeLists;
  if (DEBUG)
    console.log(`  Found ${bases.length} bases`);

  for (const edgeList of bases) {
    const transform = ops.inverse(edgeList.map(e => pg.edgeVector(e, pos)));
    const trav = S.seq(_traversal(graph, edgeList[0].head, transform));

    if (best == null) {
      best = trav;
      if (DEBUG)
        console.log(`Best traversal so far:\n${printTraversal(best)}\n`);
    }
    else {
      let [t, b] = [trav, best];

      while (!t.isNil && _cmpSteps(t.first(), b.first()) == 0)
        [t, b] = [t.rest(), b.rest()];

      if (!t.isNil && _cmpSteps(t.first(), b.first()) < 0) {
        best = trav;
        if (DEBUG)
          console.log(`Best traversal so far:\n${printTraversal(best)}\n`);
      }
    }
  }

  return _postprocessTraversal(best.toArray()).sort(_cmpSteps);
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
    const trav = invariant(g);

    for (const e of trav)
      console.log(e);
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
