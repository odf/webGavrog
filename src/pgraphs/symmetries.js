import * as I from 'immutable';

import * as pg from './periodic';

const ops = pg.ops;

const encode = value => I.fromJS(ops.repr(value));
const decode = value => ops.fromRepr(value.toJS());


const _adjacenciesByEdgeVector = (
  graph, v,
  adj = pg.adjacencies(graph),
  pos = pg.barycentricPlacement(graph)
) => {
  const result = I.Map().asMutable();

  for (const { v: w, s } of adj.get(v)) {
    const d = ops.plus(s, ops.minus(pos.get(w), pos.get(v)));
    result.set(encode(d), pg.makeEdge(v, w, s));
    if (v == w)
      result.set(encode(ops.negative(d)), pg.makeEdge(w, v, ops.negative(s)));
  }

  return result.asImmutable();
};


const _checkGraphsForMorphism = (graph1, graph2, transform) => {
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
};


export function morphism(
  graph1, graph2, start1, start2, transform,
  adj1 = pg.adjacencies(graph1),
  adj2 = pg.adjacencies(graph2),
  pos1 = pg.barycentricPlacement(graph1),
  pos2 = pg.barycentricPlacement(graph2)
) {
  _checkGraphsForMorphism(graph1, graph2, transform);

  const src2img = I.Map().asMutable();
  const img2src = I.Map().asMutable();
  const queue = [];

  let injective = true;

  src2img.set(start1, start2);
  // TODO Seems we need the following, but Java code leaves it out:
  // img2src.set(start2, start1);
  queue.push(start1);

  while (queue.length) {
    const w1 = queue.shift();
    const w2 = src2img.get(w1);
    const n1 = _adjacenciesByEdgeVector(graph1, w1, adj1, pos1);
    const n2 = _adjacenciesByEdgeVector(graph2, w2, adj2, pos2);

    for (const [d1, e1] of n1) {
      const d2 = encode(ops.times(decode(d1), transform));
      const e2 = n2.get(d2);
      if (e2 == null)
        return null;

      const e1img = src2img.get(encode(e1));
      if (I.is(encode(e2), encode(e1img)))
        continue;
      else if (e1img != null)
        return null;

      if (img2src.has(encode(e2)))
        injective = false;

      src2img.set(encode(e1), e2);
      img2src.set(encode(e2), e1);

      const u1 = e1.tail;
      const u2 = e2.tail;

      const u2src = img2src.get(u2);
      if (u2src == null)
        img2src.set(u2, u1);
      else if (u2src != u1)
        injective = false;

      const u1img = src2img.get(u1);
      if (u1img == null) {
        src2img.set(u1, u2);
        queue.push(u1);
      }
      else if (u1img != u2)
        return null;
    }
  }

  for (const v of I.List(adj2.keySeq()))
    if (!img2src.has(v))
      return null;
  for (const e of graph2.edges)
    if (!img2src.has(encode(e)) || !img2src.has(encode(e.reverse())))
      return null;

  return {
    src2img,
    img2src,
    transform,
    injective,
    sourceGraph: graph1,
    imageGraph: graph2
  };
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return `[ ${this.map(x => x.toString()).join(', ')} ]`;
  };

  const maybeDecode = x => x.constructor.name == 'Number' ? x : decode(x);

  const test = function test(g) {
    console.log('edges:');
    for (const e of g.edges)
      console.log(`  ${e}`);

    if (pg.isConnected(g) && pg.isLocallyStable(g)) {
      const phi = morphism(g, g, 1, 1, ops.identityMatrix(g.dim));
      console.log();
      console.log('identity morphism:');

      console.log('  src2img:');
      for (const [k, v] of phi.src2img)
        console.log(`    ${maybeDecode(k)} -> ${v}`);

      console.log('  img2src:');
      for (const [k, v] of phi.img2src)
        console.log(`    ${maybeDecode(k)} -> ${v}`);
      console.log(`  injective = ${phi.injective}`);
    }
    console.log();
    console.log();
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
