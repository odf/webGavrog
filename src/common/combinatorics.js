const _swap = (a, i, j) => [a[i], a[j]] = [a[j], a[i]];


export function permutations(n) {
  const p = [];
  for (let i = 1; i <= n; ++i)
    p.push(i);

  const result = [];

  while (true) {
    let i, j;

    result.push(p.slice());

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

  return result;
};
