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
const _negative = (a, m) => m - a;
const _cmp      = (a, b) => (a > b) - (a < b);
const _plus     = (a, b, m) => (a + b) % m;
const _minus    = (a, b, m) => (m - b + a) % m;
const _times    = (a, b, m) => (a * b) % m;
const _div      = (a, b, m) => (_inverse(b) * a) % m;


export function extend(baseOps, m) {
  return {
    toJS:     { Integer: a => _canon(a, m) },
    negative: { Integer: a => _negative(_canon(a, m)) },
    sgn:      { Integer: a => 1 },
    abs:      { Integer: a => _canon(a, m) },
    floor:    { Integer: a => _canon(a, m) },
    ceil:     { Integer: a => _canon(a, m) },
    round:    { Integer: a => _canon(a, m) },

    cmp: {
      Integer: {
        Integer: (a, b) => _cmp(_canon(a, m), _canon(b, m))
      }
    },
    plus: {
      Integer: {
        Integer: (a, b) => _plus(_canon(a, m), _canon(b, m), m)
      }
    },
    minus: {
      Integer: {
        Integer: (a, b) => _minus(_canon(a, m), _canon(b, m), m)
      }
    },
    times: {
      Integer: {
        Integer: (a, b) => _times(_canon(a, m), _canon(b, m), m)
      }
    },
    div: {
      Integer: {
        Integer: (a, b) => _div(_canon(a, m), _canon(b, m), m)
      }
    },
    mod: {
      Integer: {
        Integer: (a, b) => _canon(a, m) % _canon(b, m)
      }
    }
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
