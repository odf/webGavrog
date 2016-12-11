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


const _make  = (a, m) => a < 0 ? (a % m) + m : a % m;
const _plus  = (a, b, m) => (a + b) % m;
const _minus = (a, b, m) => (m - b + a) % m;
const _times = (a, b, m) => (a * b) % m;
const _div   = (a, b, m) => (_inverse(b, m) * a) % m;
const _cmp   = (a, b) => (a > b) - (a > b);


export function extend(basis, m) {
  const methods = {
    toJS : { Integer: a => _make(a, m) },
    abs  : { Integer: a => _make(a, m) },
    floor: { Integer: a => _make(a, m) },
    ceil : { Integer: a => _make(a, m) },
    round: { Integer: a => _make(a, m) },

    negative: { Integer: a => _minus(0, _make(a, m)) },
    sgn     : { Integer: a => a % m != 0 },
    isEven  : { Integer: a => _make(a, m) % 2 == 0 },

    cmp: {
      Integer: {
        Integer: (a, b) => _cmp(_make(a, m), _make(b, m), m)
      }
    },
    plus: {
      Integer: {
        Integer: (a, b) => _plus(_make(a, m), _make(b, m), m)
      }
    },
    minus: {
      Integer: {
        Integer: (a, b) => _minus(_make(a, m), _make(b, m), m)
      }
    },
    times: {
      Integer: {
        Integer: (a, b) => _times(_make(a, m), _make(b, m), m)
      }
    },
    div: {
      Integer: {
        Integer: (a, b) => _div(_make(a, m), _make(b, m), m)
      }
    }
  };

  return basis.register(methods);
};
