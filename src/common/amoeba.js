// Implementation of the Nelder-Mead optimization algorithm.

const step = (simplex, values, order, dim, fn) => {
  const setPoint = (k, factor) => {
    for (let i = 0; i < dim; ++i) {
      let c = 0;
      for (let j = 0; j < dim; ++j)
        c += simplex[order[j]][i];
      simplex[k][i] = factor * simplex[order[dim]][i] + (1 - factor) * c / dim;
    }
  };

  const copyPoint = (to, from) => {
    for (let i = 0; i < dim; ++i)
      simplex[to][i] = simplex[from][i];
  };

  setPoint(dim + 1, -1.0);
  const vr = fn(simplex[dim + 1]);

  if (vr < values[order[0]]) {
    setPoint(dim + 2, -2.0);
    const ve = fn(simplex[dim + 2]);
    copyPoint(order[dim], ve < vr ? dim + 2 : dim + 1);
    values[order[dim]] = Math.min(ve, vr);
  }
  else if (vr < values[order[dim - 1]]) {
    copyPoint(order[dim], dim + 1);
    values[order[dim]] = vr;
  }
  else {
    setPoint(dim + 1, 0.5);
    const vc = fn(simplex[dim + 1]);
    if (vc < values[order[dim]]) {
      copyPoint(order[dim], dim + 1);
      values[order[dim]] = vc;
    }
    else {
      for (let i = 1; i <= dim; ++i) {
        for (let j = 0; j < dim; ++j)
          simplex[order[i]][j] += simplex[order[0]][j] / 2;
        values[order[i]] = fn(simplex[order[i]]);
      }
    }
  }

  order.sort((a, b) => values[a] - values[b]);
};


const optimize = (fn, start, maxSteps, tolerance, initialScale=1.0) => {
  const dim = start.length;
  const simplex = [new Float64Array(start)];

  for (let i = 0; i < dim; ++i) {
    const p = new Float64Array(start);
    p[i] += initialScale;
    simplex.push(p);
  }

  const values = new Float64Array(simplex.map(x => fn(x)));
  const order = new Int32Array(simplex.map((_, i) => i));
  order.sort((a, b) => values[a] - values[b]);

  simplex.push(new Float64Array(start));
  simplex.push(new Float64Array(start));

  let i = 0;
  while (i < maxSteps) {
    const vlo = values[order[0]];
    const vhi = values[order[dim]];
    if (
      2 * Math.abs(vhi - vlo) <=
        tolerance * Math.max(tolerance, Math.abs(vlo) + Math.abs(vhi))
    )
      break;

    step(simplex, values, order, dim, fn);
    ++i;
  }

  return {
    position: simplex[order[0]],
    value: values[order[0]],
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
  console.log(optimize(himmelblau, [-1, -1], 1000, 1e-12));
  console.log('Rosenbrock:');
  console.log(optimize(rosenbrock(1, 100), [-1, -1], 1000, 1e-12));
}
