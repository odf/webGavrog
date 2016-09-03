import * as pg from './periodic';
import * as ps from './symmetries';

const ops = pg.ops;


const _solveInRows = (v, M) => {
  const tmp = ops.solution(ops.transposed(M), ops.transposed(v));
  return tmp && ops.transposed(tmp);
};


const _traversal = function* _traversal(
  graph,
  v0,
  transform,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph))
{
  const zero = ops.vector(graph.dim);

  const old2new = {[v0]: 1};
  const newPos = {[v0]: zero};
  const queue = [v0];
  const essentialShifts = [];

  let next = 2;
  let basisAdjustment = null;

  while (queue.length) {
    const vo = queue.shift();
    const vn = old2new[vo];
    const pv = newPos[vo];

    const incident = pg.allIncidences(graph, vo, adj);
    const M = ops.times(incident.map(e => pg.edgeVector(e, pos)), transform);

    const neighbors = incident
      .map((e, i) => [ops.plus(pv, M[i]), e.tail])
      .sort(([sa, wa], [sb, wb]) => ops.cmp(sa, sb));

    for (const [s, wo] of neighbors) {
      const wn = old2new[wo];
      if (wn == null) {
        yield [vn, next, zero];
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
              basisAdjustment = ops.inverse(ops.transposed(essentialShifts));
            }
          }
        }
        if (vn < wn || (vn == wn && ops.sgn(shift) < 0)) {
          yield [vn, wn, shift];
        }
      }
    }
  }
};


export function invariant(
  graph,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph),
  bases = ps.characteristicBases(graph, adj, pos),
  sym = ps.symmetries(graph, adj, pos, bases))
{
  for (const basis of sym.representativeBases) {
    const v = basis[0].head;
    const transform = ops.inverse(basis.map(e => pg.edgeVector(e, pos)));
    const trav = _traversal(graph, v, transform, adj, pos);
    console.log(`basis = ${basis}`);
    console.log(`transform = ${transform}`);
    for (const e of trav)
      console.log(e);
    console.log();
  }
}


if (require.main == module) {
  Array.prototype.toString = function() {
    return `[ ${this.map(x => x.toString()).join(', ')} ]`;
  };

  const test = g => {
    invariant(g);
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
