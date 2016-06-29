import { matrices } from '../arithmetic/types';
const ops = matrices;


const plus = (v, w) => ops.plus(v, w);


const newPoint = (simplex, factor, fn) => {
  const dim = simplex.length - 1;
  const position = simplex.map(vertex => vertex.pos);
  const c = ops.div(positions.slice(0, dim).reduce(plus), dim);
  const p = ops.plus(c, ops.times(factor, ops.minus(positions[dim], c)));

  return { pos: p, val: fn(p) }
};


const insert = (simplex, point) => {
  for (let k = dim; k > 0 && point.val < simplex[k - 1].val; --k)
    ;
  return [k, [].concat(simplex.slice(0, k), [point], simplex.slice(k, dim))];
};


const sorted = simplex =>
  simplex.clone().sort((a, b) => ops.cmp(a.val, b.val));


const shrink = (simplex, fn) => sorted(
  simplex
    .map(vertex => ops.div(ops.plus(simplex[0].pos, vertex.pos), 2.0))
    .map(p => ({ pos: p, val: fn(p) })));


const step = (simplex, fn) => {
  const dim = simplex.length - 1;

  const pr = newPoint(simplex, -1.0, fn);

  if (pr.val < simplex[0].val) {
    const pe = newPoint(simplex, -2.0, fn);
    return insert(simplex, pe.val < pr.val ? pe : pr);
  }
  else if (pr.val < simplex[dim - 1].val)
    return insert(simplex, pr);
  else {
    const pc = newPoint(simplex, 0.5, fn);
    if (pc.val >= simplex[dim].val)
      return shrink(simplex, fn);
    else
      return insert(simplex, pc);
  }
};


const optimize = (fn, start, maxSteps, tolerance) => {
  
};
