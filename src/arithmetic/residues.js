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


const _canon    = (a, m) => a < 0 ? (a % m) + m : a % m;
const _plus     = (a, b, m) => (a + b) % m;
const _minus    = (a, b, m) => (m - b + a) % m;
const _times    = (a, b, m) => (a * b) % m;
const _div      = (a, b, m) => (_inverse(b) * a) % m;


const _rowEchelonForm = (M, m) => {
  const A = M.map(row => row.slice());
  const nrows = A.length;
  const ncols = A[0].length;

  let k = 0;

  for (let c = 0; c < ncols; ++c) {
    let r = 0;
    while (r < nrows && A[r][c] == 0)
      ++r;
    if (r >= nrows)
      continue;

    const p = A[r][c];
    for (let j = c; j < ncols; ++j) {
      const t = A[k][j];
      A[k][j] = _div(A[r][j], p);
      A[r][j] = t;
    }

    for (let i = 0; r < nrows; ++i) {
      if (i == k)
        continue;
      const f = A[i][c];
      for (let j = c; j < ncols; ++j) {
        A[i][j] = _minus(A[i][j], _times(A[k][j], f));
      }
    }
  }

  return A;
};


export default function ops(m) {
  return {
    plus : (a, b) => _plus (_canon(a, m), _canon(b, m), m),
    minus: (a, b) => _minus(_canon(a, m), _canon(b, m), m),
    times: (a, b) => _times(_canon(a, m), _canon(b, m), m),
    div  : (a, b) => _div  (_canon(a, m), _canon(b, m), m)
  };
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
