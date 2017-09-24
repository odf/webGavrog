const checkLen = (v, w) => {
  if (w.length == v.length)
    return true;
  else
    throw new Error('size mismatch');
};


const map = {
  V : f => v => v.map(x => f(x)),
  M : f => m => m.map(v => v.map(x => f(x))),
  VS: f => (v, s) => v.map(x => f(x, s)),
  MS: f => (m, s) => m.map(v => v.map(x => f(x, s))),
  SV: f => (s, v) => v.map(x => f(s, x)),
  SM: f => (s, m) => m.map(v => v.map(x => f(s, x))),
  VV: f => (v, w) => checkLen(v, w) && v.map((x, i) => f(x, w[i])),
  MM: f => (a, b) => checkLen(a, b) && a.map((v, i) => map.VV(f)(v, b[i]))
};


const shapeOfMatrix = m => [m.length, m[0].length];

const array = n => Array(n).fill(0);

const matrix = (nrows, ncols) => array(nrows).map(() => array(ncols));

const identity = n => array(n).map((_, i) => array(n).fill(1, i, i+1));

const cloneMatrix = A => A.map(row => row.slice());


const transposedMatrix = m => {
  const [nrows, ncols] = shapeOfMatrix(m);
  return array(ncols).map((_, j) => array(nrows).map((_, i) => m[i][j]));
};


export const extend = (scalarOps, scalarTypes) => {
  const sops = scalarOps;


  const compareV = (v, w) => {
    for (let i = 0; i < v.length || i < w.length; ++i) {
      const d = sops.cmp(v[i] || 0, w[i] || 0);
      if (d)
        return d;
    }
    return 0;
  };


  const compareM = (A, B) => {
    for (let i = 0; i < A.length || i < B.length; ++i) {
      const d = compareV(A[i] || [], B[i] || []);
      if (d)
        return d;
    }
    return 0;
  };


  const signV = v => {
    for (const x of v) {
      const s = sops.sgn(x);
      if (s)
        return s;
    }
    return 0;
  };


  const dotProduct = (v, w) => {
    if (v.length != w.length)
      throw new Error('vectors must have equal length');

    let res = 0;
    for (let k = 0; k < v.length; ++k)
      res = sops.plus(res, sops.times(v[k], w[k]));

    return res;
  };


  const matrixProduct = (A, B) => {
    const [nrowsA, ncolsA] = shapeOfMatrix(A);
    const [nrowsB, ncolsB] = shapeOfMatrix(B);

    if (ncolsA != nrowsB)
      throw new Error('shapes do not match');

    const out = matrix(nrowsA, ncolsB);
    for (let i = 0; i < nrowsA; ++i)
      for (let j = 0; j < ncolsB; ++j)
        for (let k = 0; k < ncolsA; ++k)
          out[i][j] = sops.plus(out[i][j], sops.times(A[i][k], B[k][j]));

    return out;
  };


  const crossProduct = (v, w) => {
    if (v.length != 3 || w.length != 3)
      throw new Error('both vectors must have length 3');

    return [
      sops.minus(sops.times(v[1], w[2]), sops.times(v[2], w[1])),
      sops.minus(sops.times(v[2], w[0]), sops.times(v[0], w[2])),
      sops.minus(sops.times(v[0], w[1]), sops.times(v[1], w[0]))
    ];
  };


  const methods = {
    __context__: () => `matrices(${scalarOps.__context__()})`,

    toJS: {
      Vector: map.V(sops.toJS),
      Matrix: map.M(sops.toJS)
    },

    vector: {
      Integer: array
    },

    unitVector: {
      Integer: {
        Integer: (n, k) => array(n).fill(1, k, k+1)
      }
    },

    matrix: {
      Integer: {
        Integer: matrix
      }
    },

    identityMatrix: {
      Integer: identity
    },

    shape: {
      Vector: v => [v.length],
      Matrix: shapeOfMatrix
    },

    dimension: {
      Vector: v => v.length,
      Matrix: m => m.length
    },

    negative: {
      Vector: map.V(sops.negative),
      Matrix: map.M(sops.negative)
    },

    cmp: {
      Vector: { Vector: compareV },
      Matrix: { Matrix: compareM }
    },

    sgn: {
      Vector: signV
    },

    squareNorm: {
      Vector: v => dotProduct(v, v),
      Matrix: M =>
        M.map(v => dotProduct(v, v)).reduce((a, b) => sops.plus(a, b))
    },

    norm: {
      Vector: v => sops.sqrt(methods.squareNorm.Vector(v)),
      Matrix: m => sops.sqrt(methods.squareNorm.Matrix(m))
    },

    transposed: {
      Null: _ => null,
      Vector: v => v.map(x => [x]),
      Matrix: transposedMatrix
    },

    crossProduct: {
      Vector: {
        Vector: crossProduct
      }
    },

    times: {
      Vector: {
        Vector: dotProduct,
        Matrix: (v, m) => matrixProduct([v], m)[0]
      },
      Matrix: {
        Vector: (m, v) => matrixProduct([v], transposedMatrix(m))[0],
        Matrix: matrixProduct
      }
    },

    __repr__: {
      Vector: map.V(sops.repr),
      Matrix: map.M(sops.repr)
    },

    __Vector__: { Object: ({ Vector: v }) => map.V(sops.fromRepr)(v) },
    __Matrix__: { Object: ({ Matrix: m }) => map.M(sops.fromRepr)(m) },
  };

  for (const name of ['plus', 'minus', 'div', 'idiv', 'mod']) {
    methods[name] = { Vector: {}, Matrix: {} };
  };

  for (const name of ['plus', 'minus', 'times', 'div', 'idiv', 'mod']) {
    for (const sType of scalarTypes) {
      methods[name]['Vector'][sType] = map.VS(sops[name]);
      methods[name]['Matrix'][sType] = map.MS(sops[name]);
    }
  }

  for (const name of ['plus', 'minus', 'times']) {
    for (const sType of scalarTypes) {
      methods[name][sType] = {
        Vector: map.SV(sops[name]),
        Matrix: map.SM(sops[name])
      }
    }
  }

  for (const name of ['plus', 'minus']) {
    methods[name].Vector.Vector = map.VV(sops[name]);
    methods[name].Matrix.Matrix = map.MM(sops[name]);
  }

  return sops.register(methods);
};
