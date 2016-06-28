import { matrices } from '../arithmetic/types';
const ops = matrices;


const plus = (v, w) => ops.plus(v, w);


const amotry = (simplex, factor, fn) => {
  const dim = simplex.length - 1;
  const c = ops.div(simplex.slice(0, dim).map(p => p.pos).reduce(plus), dim);
  const p = ops.plus(c, ops.times(factor, ops.minus(simplex[dim].pos, c)));
  const newPoint = { pos: p, val: fn(p) };

  if (newPoint.val < simplex[dim].val) {
    for (let k = dim; k > 0 && newPoint.val < simplex[k - 1].val; --k)
      ;
    return [k, [].concat(simplex.slice(0, k),
                         [newPoint],
                         simplex.slice(k, dim))];
  }
  else
    return [dim + 1, simplex];
};
