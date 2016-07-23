import * as I from 'immutable';

import * as pg from './periodic';

const ops = pg.ops;

const encode = value => I.fromJS(ops.repr(value));
const decode = value => ops.fromRepr(value.toJS());


const _neighborsByEdgeVector = (
  graph, v, adj=pg.adjacencies(graph), pos=pg.barycentricPlacement(graph)
) => {
  const result = I.Map().asMutable();

  for (const { v: w, s } of adj.get(v)) {
    const d = ops.plus(s, ops.minus(pos.get(w), pos.get(v)));
    result.set(encode(d), { v: w, s })
    if (v == w)
      result.set(encode(ops.negative(d)), { v, s: ops.negative(s) });
  }

  return result.asImmutable();
};


export function morphism(graph1, graph2, start1, start2, transform) {
  const errors = [];

  if (graph2.dim != graph1.dim)
    errors.push('graphs have different dimensions');
  if (!pg.isLocallyStable(graph1))
    errors.push('first graph is not locally stable');
  if (!pg.isLocallyStable(graph2))
    errors.push('second graph is not locally stable');
  if (!pg.isConnected(graph1))
    errors.push('first graph is not connected');
  if (!pg.isConnected(graph2))
    errors.push('second graph is not connected');
  if (transform != null && ops.dimension(transform) != graph1.dim)
    errors.push('coordinate transformation has the wrong dimension');

  if (errors.length > 0)
    throw new Error(errors.join('\n'));

  const adj1 = pg.adjacencies(graph1);
  const adj2 = pg.adjacencies(graph2);
  const pos1 = pg.barycentricPlacement(graph1);
  const pos2 = pg.barycentricPlacement(graph2);

  const src2img = I.Map().asMutable();
  const img2src = I.Map().asMutable();
  const queue = [];

  src2img.set(start1, start2);
  img2src.set(start2, start1);
  queue.push(start1);

  while (queue.length) {
    const w1 = queue.shift();
    const w2 = src2img.get(w1);
    const n1 = _neighborsByEdgeVector(graph1, w1, adj1, pos1);
    const n2 = _neighborsByEdgeVector(graph2, w2, adj2, pos2);

    for (const [d1, {v: node1, s: shift1}] of n1) {
      const d2 = encode(ops.times(decode(d1), transform));
      const {v: node2, s: shift2} = n1.get(d2);

      if (node2 == null)
        return null;
    }
  }
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const test = function test(g) {
    console.log('g = '+g);
    if (pg.isConnected(g)) {
      const nbrs = _neighborsByEdgeVector(g, 1).mapKeys(decode);
      console.log('  neighbors of 1: '+ JSON.stringify(nbrs));

      if (pg.isLocallyStable(g)) {
        morphism(g, g, 1, 1, ops.identityMatrix(g.dim));
      }
    }
    console.log();
  };

  test(pg.make([ [ 1, 1, [ 1, 0 ] ],
                 [ 1, 1, [ 0, 1 ] ],
                 [ 1, 2, [ 0, 0 ] ],
                 [ 1, 2, [ 1, 1 ] ],
                 [ 1, 3, [ 0, 0 ] ],
                 [ 1, 3, [ 1, -1 ] ] ]));

  test(pg.make([ [ 1, 1, [ 1, 0 ] ],
                 [ 1, 1, [ 0, 1 ] ],
                 [ 1, 2, [ 0, 0 ] ],
                 [ 1, 2, [ 1, 1 ] ],
                 [ 1, 3, [ 0, 0 ] ],
                 [ 1, 3, [ 1, -1 ] ],
                 [ 1, 4, [ 0, 0 ] ],
                 [ 1, 4, [ 1, -1 ] ] ]));

  test(pg.make([ [ 1, 1, [ -1,  1,  1 ] ],
                 [ 1, 1, [  0, -1,  1 ] ],
                 [ 1, 1, [  0,  0, -1 ] ] ]));

  test(pg.make([ [ 1, 2, [ 0, 0 ] ],
                 [ 1, 2, [ 1, 0 ] ],
                 [ 1, 2, [ 0, 1 ] ] ]));

  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 1, 2, [ 0, 1, 0 ] ],
                 [ 1, 2, [ 0, 0, 1 ] ] ]));
}
