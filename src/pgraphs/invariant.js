import * as I from 'immutable';

import { rationalMatricesAsModule } from '../arithmetic/types';
import * as pg from './periodic';
import * as ps from './symmetries';


let _timers = null;

const ops = pg.ops;


const _solveInRows = (v, M) => {
  const tmp = ops.solution(ops.transposed(M), ops.transposed(v));
  return tmp && ops.transposed(tmp);
};


const _traversal = function* _traversal(graph, v0, transform)
{
  _timers && _timers.start('_traversal');
  _timers && _timers.start('_traversal: preparations');
  const zero = ops.vector(graph.dim);

  const adj = pg.adjacencies(graph);
  const pos = pg.barycentricPlacement(graph);
  const old2new = {[v0]: 1};
  const mappedPos = {[v0]: ops.times(pos.get(v0), transform)};
  const newPos = {[v0]: mappedPos[v0]};
  const queue = [[v0, zero]];
  const essentialShifts = [];

  let next = 2;
  let basisAdjustment = null;
  _timers && _timers.stop('_traversal: preparations');

  while (queue.length) {
    const [vo, vShift] = queue.shift();
    const vn = old2new[vo];

    _timers && _timers.start('_traversal: compute neighbors');
    const neighbors = [];

    for (const e of pg.allIncidences(graph, vo, adj)) {
      const w = e.tail;
      if (mappedPos[w] == null)
        mappedPos[w] = ops.times(pos.get(w), transform);

      let s = vShift;
      if (ops.ne(zero, e.shift))
        s = ops.plus(s, ops.times(e.shift, transform));

      neighbors.push([w, s, ops.plus(s, mappedPos[w])]);
    }

    neighbors.sort(([wa, sa, pa], [wb, sb, pb]) => ops.cmp(pa, pb));
    _timers && _timers.stop('_traversal: compute neighbors');

    for (const [wo, s, p] of neighbors) {
      const wn = old2new[wo];
      if (wn == null) {
        _timers && _timers.stop('_traversal');
        yield [vn, next, zero];
        _timers && _timers.start('_traversal');
        old2new[wo] = next++;
        newPos[wo] = p;
        queue.push([wo, s]);
      }
      else if (wn < vn) {
        continue;
      }
      else {
        _timers && _timers.start('_traversal: compute shift');
        const rawShift = ops.minus(p, newPos[wo]);
        let shift;
        if (basisAdjustment != null) {
          shift = ops.times(rawShift, basisAdjustment);
        }
        else if (ops.sgn(rawShift) == 0) {
          shift = rawShift;
        }
        else {
          if (essentialShifts.length) {
            shift = _solveInRows(rawShift, essentialShifts);
          }
          if (shift == null) {
            shift = ops.unitVector(graph.dim, essentialShifts.length);
            essentialShifts.push(rawShift);
            if (essentialShifts.length == graph.dim) {
              basisAdjustment = ops.inverse(essentialShifts);
            }
          }
          else {
            shift = shift[0].concat(ops.vector(graph.dim - shift[0].length));
          }
        }
        _timers && _timers.stop('_traversal: compute shift');
        if (vn < wn || (vn == wn && ops.sgn(shift) < 0)) {
          _timers && _timers.stop('_traversal');
          yield [vn, wn, shift];
          _timers && _timers.start('_traversal');
        }
      }
    }
  }
  _timers && _timers.stop('_traversal');
};


const _cmpSteps = ([headA, tailA, shiftA], [headB, tailB, shiftB]) =>
  (headA - headB) || (tailA - tailB) || ops.cmp(shiftA, shiftB);


const _postprocessTraversal = trav => {
  const A = trav.map(([head, tail, shift]) => shift);
  const basis = rationalMatricesAsModule
    .triangulation(A).R.slice(0, A[0].length);
  const basisChange = ops.inverse(basis);

  return trav.map(([head, tail, shift]) => {
    const newShift = ops.times(shift, basisChange);
    if (newShift.some(x => !ops.isInteger(x))) {
      throw new Error("panic: produced non-integer shift");
    }
    if (head == tail && ops.sgn(newShift) > 0) {
      return [head, tail, ops.negative(newShift)];
    }
    else {
      return [head, tail, newShift];
    }
  });
};


const _goodBases = (graph, bases) => {
  const adj = pg.adjacencies(graph);

  const atLoop = bases.filter(basis => {
    const v = basis[0].head;
    return adj.get(v).every(e => e.tail == v);
  });

  if (atLoop.size > 0)
    return atLoop;

  const atLune = bases.filter(basis => {
    const v = basis[0].head;
    const neighbours = adj.get(v).map(e => e.tail).sort();
    return neighbours.some((w, i) => i == 0 || w == neighbours[i - 1]);
  });

  if (atLune.size > 0)
    return atLune;

  const maxDeg = adj.keySeq().map(v => adj.get(v).size).max();
  return bases.filter(basis => adj.get(basis[0].head).size == maxDeg);
};


export function invariant(graph)
{
  _timers && _timers.start('invariant');

  const pos = pg.barycentricPlacement(graph);
  const sym = ps.symmetries(graph);

  let best = null;

  for (const basis of _goodBases(graph, sym.representativeBases)) {
    const v = basis[0].head;
    _timers && _timers.start('invariant: compute basis transformation');
    const transform = ops.inverse(basis.map(e => pg.edgeVector(e, pos)));
    _timers && _timers.stop('invariant: compute basis transformation');
    const trav = I.Seq(_traversal(graph, v, transform));

    if (best == null) {
      best = trav;
    }
    else {
      for (let i = 0; ; ++i) {
        const next = trav.get(i);
        if (next == null) {
          break;
        }

        const d = _cmpSteps(next, best.get(i));
        if (d < 0) {
          best = trav;
        }
        else if (d > 0) {
          break;
        }
      }
    }
  }

  _timers && _timers.start('invariant: postprocess traversal')
  const result = _postprocessTraversal(I.List(best).toArray()).sort(_cmpSteps);
  _timers && _timers.stop('invariant: postprocess traversal')

  _timers && _timers.stop('invariant');

  return result;
}


export function useTimers(timers) {
  _timers = timers;
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
