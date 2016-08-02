const _swap = (a, i, j) => [a[i], a[j]] = [a[j], a[i]];


export function* permutations(n) {
  const p = [];
  for (let i = 1; i <= n; ++i)
    p.push(i);

  while (true) {
    let i, j;

    yield p.slice();

    for (i = n-2; i >= 0 && p[i] > p[i+1]; --i)
      ;
    if (i < 0)
      break;

    for (j = n-1; p[j] < p[i]; --j)
      ;

    _swap(p, i, j);

    for (++i, j = n-1; i < j; ++i, --j)
      _swap(p, i, j);
  }
};


export function* combinations(m, k) {
  if (k == 0) {
    yield [];
  }
  else {
    for (let i = 1; i <= m - k + 1; ++i) {
      for (const c of combinations(m - i, k - 1)) {
        yield [i].concat(c.map(x => x + i));
      }
    }
  }
};


if (require.main == module) {
  for (const p of permutations(4))
    console.log(p);

  console.log();

  for (const c of combinations(6, 3))
    console.log(c);
}
