import * as pg from './periodic';
import * as symmetries from './symmetries';

import { affineTransformations } from '../geometry/types';
const ops = affineTransformations;


const _avg = xs => ops.div(xs.reduce((a, b) => ops.plus(a, b)), xs.length);


const _nodeSymmetrization = (v, syms, positions) => {
  const stab = syms.filter(a => a.src2img[v] == v).map(phi => phi.transform);
  const pos = positions.get(v);
  const dim = ops.dimension(pos);

  const s = _avg(stab.map(a => a.concat([ops.minus(pos, ops.times(pos, a))])));
  const m = s.slice(0, dim);
  const t = s[dim];

  if (ops.ne(ops.plus(ops.times(pos, m), t), pos))
    throw Error(`${pos} * ${[m, t]} = ${ops.plus(ops.times(pos, m), t)}`);

  return ops.affineTransformation(m, t);
};


const _normalizedInvariantSpace = operator => {
  const m = ops.asProjectiveMatrix(operator);
  console.log(`m = ${m}`);
  const a = ops.transposed(ops.nullSpace(ops.transposed(m)));

  const [nr, nc] = ops.shape(a);
  const k = a.findIndex(r => ops.ne(r[nc - 1], 0));
  console.log(`a = ${a}, k = ${k}`);

  if (k >= 0) {
    const t = a[k];
    a[k] = a[nr - 1];
    a[nr - 1] = t;

    a[nr - 1] = ops.div(a[nr - 1], a[nr - 1][nc - 1]);
    for (let i = 0; i < nr - 1; ++i)
      a[i] = ops.minus(a[i], ops.times(a[nr - 1], a[i][nc - 1]));
  }

  return a;
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
