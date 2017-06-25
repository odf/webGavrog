import { matrices } from '../arithmetic/types';
const ops = matrices;


const newPoint = (simplex, factor, fn) => {
  const dim = simplex.length - 1;
  const vs = simplex.map(vertex => vertex.pos);
  const p = new Array(dim);

  for (let i = 0; i < dim; ++i) {
    let c = 0;
    for (let j = 0; j < dim; ++j)
      c += vs[j][i];
    c /= dim;
    p[i] = factor * vs[dim][i] + (1 - factor) * c;
  }

  return { pos: p, val: fn(p) }
};


const insert = (simplex, point) => {
  const dim = simplex.length - 1;
  let k = dim;
  while (k > 0 && point.val < simplex[k - 1].val)
    --k;
  return [].concat(simplex.slice(0, k), [point], simplex.slice(k, dim));
};


const makeSimplex = (positions, fn) => positions
  .map(p => ({ pos: p, val: fn(p) }))
  .sort((a, b) => ops.cmp(a.val, b.val));


const shrink = (simplex, fn) => makeSimplex(
  simplex.map(vertex => ops.div(ops.plus(simplex[0].pos, vertex.pos), 2.0)), fn
);


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


const optimize = (fn, dim, start, maxSteps, tolerance, initialScale=1.0) => {
  const m = ops.times(initialScale, ops.identityMatrix(dim));

  let s = makeSimplex([start].concat(m.map(e => ops.plus(e, start))), fn);
  let i = 0;

  while (i < maxSteps) {
    const vlo = s[0].val;
    const vhi = s[dim].val;
    if (2 * Math.abs(vhi - vlo) <=
        tolerance * Math.max(tolerance, Math.abs(vlo) + Math.abs(vhi)))
      break;

    s = step(s, fn);
    ++i;
  }

  return { position: s[0].pos, value: s[0].val, steps: i };
};


const himmelblau = ([x, y]) =>
  Math.pow(x*x + y - 11, 2) + Math.pow(x + y*y - 7, 2);


const rosenbrock = (a, b) => ([x, y]) =>
  Math.pow(a - x, 2) + b * Math.pow(y - x*x, 2);


export default optimize;


if (require.main == module) {
  console.log('Himmelblau:');
  console.log(optimize(himmelblau, 2, [-1, -1], 1000, 1e-12));
  console.log('Rosenbrock:');
  console.log(optimize(rosenbrock(1, 100), 2, [-1, -1], 1000, 1e-12));
}
