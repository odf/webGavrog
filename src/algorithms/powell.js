const tiny = 1e-12;

const goldenRatio = (1 + Math.sqrt(5)) / 2;


const areAlmostEqual = (a, b, eps=tiny) =>
  2 * Math.abs(b - a) <= eps * Math.max(eps, Math.abs(a) + Math.abs(a));


const bracketMinimum = (fn, start=0, step0=1, tolerance=tiny) => {
  let step = step0;
  let a = start;
  let fa = fn(a);
  let b = a + step0;
  let fb = fn(b);

  while (areAlmostEqual(fa, fb, tolerance)) {
    step = 2 * step;
    b = a + step;
    fb = fn(b);
  }

  if (fa < fb)
    return bracketMinimum(fn, b, -step0, tolerance);

  let c = b + step;
  let fc = fn(c);

  while (fc < fb || areAlmostEqual(fb, fc, tolerance)) {
    a = b;
    fa = fb;
    b = c;
    fb = fc;
    step *= goldenRatio;
    c = b + step;
    fc = fn(c);
  }

  return [a, b, c];
};


const goldenSectionSearch = (fn, a, b, tolerance=tiny) => {
  while (!areAlmostEqual(a, b, tolerance)) {
    const t = (b - a) / goldenRatio;
    const c = b - t;
    const d = a + t;

    if (fn(c) < fn(d))
      b = d;
    else
      a = c;
  }

  return (b + a) / 2;
};


const lineSearch = (fn, start=0, step=1, tolerance=tiny) => {
  const [a, b, c] = bracketMinimum(fn, start, step, tolerance);

  return goldenSectionSearch(fn, a, c, tolerance);
};


const array = n => Array(n).fill(0);
const units = n => array(n).map((_, i) => array(n).fill(1, i, i+1));
const onLine = (p, d, f) => p.map((x, i) => x + d[i] * f);
const norm = xs => Math.sqrt(xs.reduce((a, x) => a + x * x));


const argmax = xs => {
  let best = 0;

  for (let i = 1; i < xs.length; ++i) {
    if (xs[i] > xs[best])
      best = i;
  }

  return best;
};


const normalized = xs => {
  const norm = Math.sqrt(xs.reduce((a, x) => a + x * x, 0));
  return xs.map(x => x / norm);
};


const optimize = (fn, dim, start, maxSteps, tolerance) => {
  const direction = units(dim);
  const alpha = array(dim);

  let p0 = start.slice();
  let p1 = start.slice();
  let k = 0;

  do {
    p0 = p1.slice();

    for (let i = 0; i < dim; ++i) {
      const fn1 = a => fn(onLine(p1, direction[i], a));

      alpha[i] = lineSearch(fn1, 0, 1, tolerance);
      p1 = onLine(p1, direction[i], alpha[i]);
    }

    const id = argmax(alpha);

    let s = array(dim);
    for (let i = 0; i < dim; ++i)
      s = onLine(s, direction[i], alpha[i]);

    direction.splice(id, 1);
    direction.push(normalized(s));

    ++k;
  }
  while (k < maxSteps && !areAlmostEqual(fn(p1), fn(p0), tolerance));

  return {
    position: p1,
    value: fn(p1),
    steps: k
  };
};


export default optimize;


const himmelblau = ([x, y]) =>
  Math.pow(x*x + y - 11, 2) + Math.pow(x + y*y - 7, 2);


const rosenbrock = (a, b) => ([x, y]) =>
  Math.pow(a - x, 2) + b * Math.pow(y - x*x, 2);


if (require.main == module) {
  console.log('Himmelblau:');
  console.log(optimize(himmelblau, 2, [-1, -1], 1000, 1e-12));
  console.log('Rosenbrock:');
  console.log(optimize(rosenbrock(1, 100), 2, [-1, -1], 1000, 1e-12));
}
