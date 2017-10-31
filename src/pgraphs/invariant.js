import * as S from '../common/lazyseq';

import * as pg from './periodic';
import * as ps from './symmetries';

import { rationalLinearAlgebra,
         rationalLinearAlgebraModular } from '../arithmetic/types';

const ops = rationalLinearAlgebra;


const _solveInRows = (v, M) =>
  ops.transposed(ops.solve(ops.transposed(M), ops.transposed(v)));


const _traversal = function*(graph, v0, transform, adj) {
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
    for (const e of pg.allIncidences(graph, vo, adj)) {
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


const _postprocessTraversal = trav => {
  let basis = null;
  for (const [head, tail, shift] of trav)
    basis = rationalLinearAlgebraModular.extendBasis(shift, basis);
  basis = basis.map(v => ops.sgn(v) < 0 ? ops.negative(v) : v);

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
  const adj = pg.adjacencies(graph);
  const pos = pg.barycentricPlacement(graph);
  const sym = ps.symmetries(graph);

  const _cmpSteps = ([headA, tailA, shiftA], [headB, tailB, shiftB]) =>
    (headA - headB) || (tailA - tailB) || ops.cmp(shiftA, shiftB);

  let best = null;

  for (const edgeList of sym.representativeEdgeLists) {
    const transform = ops.inverse(edgeList.map(e => pg.edgeVector(e, pos)));
    const trav = S.seq(_traversal(graph, edgeList[0].head, transform, adj));

    if (best == null)
      best = trav;
    else {
      let [t, b] = [trav, best];

      while (!t.isNil && _cmpSteps(t.first(), b.first()) == 0)
        [t, b] = [t.rest(), b.rest()];

      if (!t.isNil && _cmpSteps(t.first(), b.first()) < 0)
        best = trav;
    }
  }

  return _postprocessTraversal(best.toArray()).sort(_cmpSteps);
}


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

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 1, 2, [ 0, 1, 0 ] ],
                 [ 1, 2, [ 0, 0, 1 ] ] ]));

  test(pg.make([ [ 1, 2, [ 0, 0 ] ],
                 [ 1, 2, [ 1, 0 ] ],
                 [ 2, 3, [ 0, 0 ] ],
                 [ 2, 3, [ 0, 1 ] ],
                 [ 1, 3, [ 0, 0 ] ],
                 [ 1, 3, [ 1, 1 ] ] ]));
}
