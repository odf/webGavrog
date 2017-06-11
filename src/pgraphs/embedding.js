import * as pg from './periodic';
import * as symmetries from './symmetries';

import { affineTransformations } from '../geometry/types';
const ops = affineTransformations;


const _stabilizer = (v, syms) => syms.filter(a => a.src2img[v] == v);


const _nodeSymmetrization = (v, syms, positions) => {
  const stab = _stabilizer(v, syms);
  const pos = positions.get(v);
  const dim = ops.dimension(pos);

  let m = ops.matrix(dim, dim);
  let t = ops.vector(dim);

  for (const phi of stab) {
    const a = phi.transform;
    const s = ops.minus(pos, ops.times(pos, a));

    m = ops.plus(m, a);
    t = ops.plus(t, s);
  }

  m = ops.div(m, stab.length);
  t = ops.div(t, stab.length);

  if (ops.ne(ops.plus(ops.times(pos, m), t), pos))
    throw Error(`${pos} * ${[m, t]} = ${ops.plus(ops.times(pos, m), t)}`);

  return ops.affineTransformation(m, t);
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
        console.log(`${v} => ${_nodeSymmetrization(v, syms, positions)}`);
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
