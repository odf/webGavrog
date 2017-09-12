const newPoint = (simplex, factor, fn) => {
  const dim = simplex.length - 1;
  const p = new Array(dim + 1).fill(0);

  for (let i = 1; i < dim + 1; ++i) {
    let c = 0;
    for (let j = 0; j < dim; ++j)
      c += simplex[j][i];
    p[i] = factor * simplex[dim][i] + (1 - factor) * c / dim;
  }

  p[0] = fn(p.slice(1));

  return p;
};


const step = (simplex, fn) => {
  const dim = simplex.length - 1;

  const pr = newPoint(simplex, -1.0, fn);

  if (pr[0] < simplex[0][0]) {
    const pe = newPoint(simplex, -2.0, fn);
    simplex[dim] = pe[0] < pr[0] ? pe : pr;
  }
  else if (pr[0] < simplex[dim - 1][0])
    simplex[dim] = pr;
  else {
    const pc = newPoint(simplex, 0.5, fn);
    if (pc[0] < simplex[dim][0])
      simplex[dim] = pc;
    else {
      for (let i = 0; i <= dim; ++i) {
        simplex[i] = simplex[i].map((x, j) => (x + simplex[0][j]) / 2);
        simplex[i][0] = fn(simplex[i].slice(1));
      }
    }
  }

  simplex.sort((a, b) => a[0] - b[0]);
};


const optimize = (fn, dim, start, maxSteps, tolerance, initialScale=1.0) => {
  const array = n => Array(n).fill(0);
  const m = array(dim).map((_, i) => array(dim).fill(initialScale, i, i+1));

  const simplex = [start].concat(m.map(e => e.map((x, i) => x + start[i])))
    .map(p => [fn(p)].concat(p))
    .sort((a, b) => a[0] - b[0]);

  let i = 0;
  while (i < maxSteps) {
    const vlo = simplex[0][0];
    const vhi = simplex[dim][0];
    if (2 * Math.abs(vhi - vlo) <=
        tolerance * Math.max(tolerance, Math.abs(vlo) + Math.abs(vhi)))
      break;

    step(simplex, fn);
    ++i;
  }

  return {
    position: simplex[0].slice(1),
    value: simplex[0][0],
    steps: i
  };
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
