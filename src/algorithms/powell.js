const goldenRatio = (1 + Math.sqrt(5)) / 2;


const areAlmostEqual = (a, b, eps=1e-12) =>
  2 * Math.abs(b - a) <= eps * Math.max(eps, Math.abs(a) + Math.abs(a));


const bracketMinimum = (fn, start=0, step0=1) => {
  let step = step0;
  let a = start;
  let fa = fn(a);
  let b = a + step0;
  let fb = fn(b);

  while (areAlmostEqual(fa, fb)) {
    step = 2 * step;
    b = a + step;
    fb = fn(b);
  }

  if (fa < fb)
    return bracketMinimum(fn, b, -step0);

  let c = b + step;
  let fc = fn(c);

  while (fc < fb || areAlmostEqual(fb, fc)) {
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


const goldenSectionSearch = (fn, a, b, tolerance=1e-12) => {
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


if (require.main == module) {
  const fn = x => x * x * Math.cos((x + 3 * Math.PI) / 4);

  const [a, b, c] = bracketMinimum(fn);

  console.log('bracket:');
  for (const x of [a, b, c])
    console.log(`  ${x} -> ${fn(x)}`);
  console.log();

  const x = goldenSectionSearch(fn, a, c);

  console.log('minimum:');
  console.log(`  ${x} -> ${fn(x)}`);
}
