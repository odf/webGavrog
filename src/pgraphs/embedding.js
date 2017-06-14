import * as pg from './periodic';
import * as symmetries from './symmetries';

import { matrices } from '../arithmetic/types';
const ops = matrices;


const _avg = xs => ops.div(xs.reduce((a, b) => ops.plus(a, b)), xs.length);


const _projectiveMatrix = (linear, shift) =>
  linear.map(row => row.concat(0)).concat([shift.concat(1)]);


const _nodeSymmetrization = (v, syms, positions) => {
  const stab = syms.filter(a => a.src2img[v] == v).map(phi => phi.transform);
  const pos = positions.get(v);
  const dim = ops.dimension(pos);

  const s = _avg(stab.map(a => a.concat([ops.minus(pos, ops.times(pos, a))])));
  const m = s.slice(0, dim);
  const t = s[dim];

  if (ops.ne(ops.plus(ops.times(pos, m), t), pos))
    throw Error(`${pos} * ${[m, t]} = ${ops.plus(ops.times(pos, m), t)}`);

  return _projectiveMatrix(m, t);
};


const _normalizedInvariantSpace = P => {
  const I = ops.identityMatrix(ops.dimension(P));
  const A = ops.transposed(ops.nullSpace(ops.transposed(ops.minus(P, I))));

  const [nr, nc] = ops.shape(A);
  const k = A.findIndex(r => ops.ne(r[nc - 1], 0));

  if (k >= 0) {
    const t = ops.div(A[k], A[k][nc - 1]);
    A[k] = A[nr - 1];
    A[nr - 1] = t;

    for (let i = 0; i < nr - 1; ++i)
      A[i] = ops.minus(A[i], ops.times(A[nr - 1], A[i][nc - 1]));
  }

  if (ops.ne(ops.times(A, P), A))
    throw Error(`${A} * ${P} = ${ops.times(A, P)}`);

  return A;
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return `[ ${this.map(x => x.toString()).join(', ')} ]`;
  };

  const test = g => {
    console.log(`vertices: ${pg.vertices(g)}`);
    console.log('edges:');
    for (const e of g.edges)
      console.log(`  ${e}`);
    console.log();

    if (pg.isConnected(g) && pg.isLocallyStable(g)) {
      const syms = symmetries.symmetries(g).symmetries;
      const positions = pg.barycentricPlacement(g);

      pg.vertices(g).forEach(v => {
        const s = _nodeSymmetrization(v, syms, positions);
        const p = _normalizedInvariantSpace(s);
        console.log(`v = ${v}`);
        console.log(`  symmetrizer = ${s}`);
        console.log(`  invariant space = ${p}`);
      });
    }
  };

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 1, 2, [ 0, 1, 0 ] ],
                 [ 1, 2, [ 0, 0, 1 ] ] ]));

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 2, 1, [ 1, 0, 0 ] ],
                 [ 2, 3, [ 0, 0, 0 ] ],
                 [ 3, 2, [ 0, 1, 0 ] ],
                 [ 3, 1, [ 0, 0, 1 ] ],
                 [ 3, 1, [ 1, 1, -1 ] ] ]));

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 1, 3, [ 0, 0, 0 ] ],
                 [ 2, 4, [ 0, 0, 0 ] ],
                 [ 3, 4, [ 0, 0, 1 ] ],
                 [ 3, 4, [ 0, 1, 0 ] ] ]));
}
