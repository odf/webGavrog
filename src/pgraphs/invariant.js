import * as pg from './periodic';

const ops = pg.ops;


const _solveInRows = (v, M) =>
  ops.transposed(ops.solve(ops.transposed(M), ops.transposed(v)));


const _traversal = function* _traversal(
  graph,
  v0,
  transform,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph))
{
  const zero = ops.vector(graph.dim);

  let next = 2;
  const old2new = {v0: 1};
  const newPos = {v0: zero};
  const queue = [v0];
  const basisAdjustment = null;
  const essentialShifts = [];

  while (queue.length) {
    const vo = queue.shift();
    const vn = old2new[vo];
    const pv = newPos[vo];

    const incident = pg.allIncidences(vo);
    const M = ops.times(incident.map(e => pg.edgeVector(e, pos)), transform);

    const neighbors = incident
      .map((e, i) => [ops.plus(pv, M[i]), e.tail])
      .sort(([sa, wa], [sb, wb]) => ops.cmp(sa, sb));

    for (const [s, wo] of neighbors) {
      const wn = old2new[wo];
      if (wn == null) {
        yield pg.makeEdge(vn, next, zero);
        old2new[wo] = next++;
        newPos[wo] = s;
        queue.push(wo);
      }
      else if (wn < vn) {
        continue;
      }
      else {
        const rawShift = ops.minus(s, newPos[wo]);
        let shift;
        if (basisAdjustment != null) {
          shift = rawShift.times(basisAdjustment);
        }
        else {
          shift = _solveInRows(rawShift, essentialShifts);
          if (shift == null) {
            essentialShifts.push(rawShift);
            shift = ops.unitVector(graph.dim, essentialShifts.length);
            if (essentialShifts.length == graph.dim) {
              basisAdjustment = ops.inverse(ops.transposed(essentialShifts));
            }
          }
        }
        if (vn < wn || (vn == wn && ops.sgn(shift) < 0)) {
          yield pg.makeEdge(vn, wn, shift);
        }
      }
    }
  }
};
