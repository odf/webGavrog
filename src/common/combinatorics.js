export function* permutations(n) {
  const perms = function*(as) {
    if (as.length < 2) {
      yield as.slice();
    }
    else if (as.length == 2) {
      yield [as[0], as[1]];
      yield [as[1], as[0]];
    }
    else {
      for (let i = 0; i < as.length; ++i) {
        const a = as[i];
        const rest = as.slice(0, i).concat(as.slice(i + 1));

        for (const p of perms(rest))
          yield [a].concat(p);
      }
    }
  }

  const as = [...Array(n + 1).keys()].slice(1);
  for (const p of perms(as))
    yield p;
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
