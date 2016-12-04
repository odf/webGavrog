const _inverse = (a, m) => {
  let [t, t1] = [0, 1];
  let [r, r1] = [m, a];

  while (r1 != 0) {
    const q = Math.floor(r / r1);
    [t, t1] = [t1, t - q * t1];
    [r, r1] = [r1, r - q * r1];
  }

  if (r == 1)
    return t < 0 ? t + m : t;
};


if (require.main == module) {
  const test = (a, m) => {
    const ainv = _inverse(a, m);
    console.log(`1 / ${a} = ${ainv} (mod ${m})`);
    
    if (ainv >= m)
      console.log(`ERROR: ${ainv} is too large`);
    else if ((a * ainv) % m != 1)
      console.log(
        `ERROR: ${a} * ${ainv} = ${a * ainv} = ${(a * ainv) % m} (mod ${m})`);
  }

  for (const p of [3, 5, 7, 11, 13]) {
    console.log();
    for (let a = 2; a < p; ++a) {
      test(a, p);
    }
  }
}
