let _timers = null;

export const useTimers = timers => {
  _timers = timers;
};


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

const mapFold = {
  V : (f, g) => v => v.map(x => f(x)).reduce((a, x) => g(a, x)),
  M : (f, g) => m => m.map(v => mapFold.V(f, g)(v)).reduce((a, x) => g(a, x))
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


export const extend = (scalarOps, scalarTypes, overField, epsilon = null) => {
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

    return (
      array(v.length)
        .map((_, k) => sops.times(v[k], w[k]))
        .reduce((a, x) => sops.plus(a, x)));
  };


  const matrixProduct = (A, B) => {
    _timers && _timers.start('matrix multiplication');

    const [nrowsA, ncolsA] = shapeOfMatrix(A);
    const [nrowsB, ncolsB] = shapeOfMatrix(B);

    if (ncolsA != nrowsB)
      throw new Error('shapes do not match');

    const out =
      array(nrowsA).map((_, i) => (
        array(ncolsB).map((_, j) => (
          array(ncolsA)
            .map((_, k) => sops.times(A[i][k], B[k][j]))
            .reduce((a, x) => sops.plus(a, x))))));

    _timers && _timers.stop('matrix multiplication');

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


  const _findPivot = (A, row, col) => {
    let best = null;
    for (let i = row; i < A.length; ++i) {
      if (sops.ne(0, A[i][col])
          && (best == null
              || sops.lt(sops.abs(A[i][col]), sops.abs(A[best][col]))))
      {
          best = i;
      }
    }
    return best;
  };

  const _swapRowsInPlace = (A, i, j) => { [A[i], A[j]] = [A[j], A[i]]; };

  const _negateRowInPlace = (A, i) => { A[i] = map.V(sops.negative)(A[i]); };

  const _truncate = (x, a) =>
    (sops.cmp(sops.abs(x), sops.abs(sops.times(a, epsilon))) <= 0) ? 0 : x;

  const _adjustRowInPlace = (A, i, j, f) => {
    const fn0 = k => sops.plus(A[i][k], sops.times(A[j][k], f));
    const fn  = epsilon ? k => _truncate(fn0(k), A[i][k]) : fn0;

    const row = A[i];
    for (const j in row)
      row[j] = fn(j);
  };

  const triangulation = (A, clearAboveDiagonal = false) => {
    _timers && _timers.start('matrix triangulation');

    const divide = overField ? sops.div : sops.idiv;
    const [nrows, ncols] = shapeOfMatrix(A);

    const R = cloneMatrix(A);
    const U = identity(A.length);
    let col = 0;
    let sign = 1;

    for (let row = 0; row < nrows; ++row) {
      let cleared = false;

      while (!cleared && col < ncols) {
        const pivotRow = _findPivot(R, row, col);

        if (pivotRow == null) {
          ++col;
          continue;
        }

        if (pivotRow != row) {
          _swapRowsInPlace(R, row, pivotRow);
          _swapRowsInPlace(U, row, pivotRow);
          sign *= -1;
        }

        if (sops.lt(R[row][col], 0)) {
          _negateRowInPlace(R, row);
          _negateRowInPlace(U, row);
          sign *= -1;
        }

        cleared = true;

        for (let k = row + 1; k < nrows; ++k) {
          if (sops.sgn(R[k][col]) != 0) {
            const f = sops.negative(divide(R[k][col], R[row][col]));

            _adjustRowInPlace(R, k, row, f);
            _adjustRowInPlace(U, k, row, f);

            if (overField)
              R[k][col] = 0;
            else if (sops.ne(0, R[k][col]))
              cleared = false;
          }
        }

        if (cleared)
          ++col;
      }
    }

    if (clearAboveDiagonal == true) {
      col = 0;

      for (let row = 0; row < nrows; ++row) {
        while (col < ncols && sops.eq(R[row][col], 0))
          ++col;
        if (col >= ncols)
          break;

        for (let i = 0; i < row; ++i) {
          if (sops.eq(R[i][col], 0))
            continue;
          const f = sops.negative(divide(R[i][col], R[row][col]));
          _adjustRowInPlace(R, i, row, f);
          _adjustRowInPlace(U, i, row, f);
        }
      }
    }

    _timers && _timers.stop('matrix triangulation');

    return { R, U, sign };
  };


  const _rowEchelonForm = M => {
    const A = cloneMatrix(M);
    const [nrows, ncols] = shapeOfMatrix(A);

    let row = 0;

    for (let col = 0; col < ncols; ++col) {
      let r = row;
      while (r < nrows && sops.eq(A[r][col], 0))
        ++r;

      if (r >= nrows)
        continue;

      if (r != row)
        [A[row], A[r]] = [A[r], A[row]];

      const p = A[row][col];
      for (let j = col; j < ncols; ++j)
        A[row][j] = sops.div(A[row][j], p);

      for (let i = 0; i < nrows; ++i) {
        if (i == row)
          continue;

        const f = A[i][col];
        for (let j = col; j < ncols; ++j)
          A[i][j] = sops.minus(A[i][j], sops.times(A[row][j], f));
      }

      ++row;
    }

    return A;
  };


  const _rank = A => {
    const [nrows, ncols] = shapeOfMatrix(A);
    let row = 0;
    for (let col = 0; col < ncols; ++col) {
      if (row < nrows && sops.sgn(A[row][col]) != 0)
        ++row;
    }
    return row;
  };


  const rank = A => _rank(triangulation(A).R);


  const determinant = A => {
    const [nrows, ncols] = shapeOfMatrix(A);
    if (nrows != ncols)
      throw new Error('must be a square matrix');

    const t = triangulation(A);
    return array(nrows)
      .map((_, i) => t.R[i][i])
      .reduce((a, x) => sops.times(a, x), t.sign);
  };


  const _solve = (R, v) => {
    _timers && _timers.start('linear equation system solve');

    const [n, m] = shapeOfMatrix(R);
    const [_, k] = shapeOfMatrix(v);
    const top = Math.min(n, m);

    const X = array(m).map(() => array(k));

    for (let j = 0; j < k; ++j) {
      for (let i = top-1; i >= 0; --i) {
        let right = v[i][j];
        for (let nu = i+1; nu < top; ++nu) {
          right = sops.minus(right, sops.times(R[i][nu], X[nu][j]));
        }

        if (sops.sgn(right) == 0)
          X[i][j] = right;
        else if (sops.sgn(R[i][i]) == 0)
          return null;
        else
          X[i][j] = sops.div(right, R[i][i]);
      }
    }

    _timers && _timers.stop('linear equation system solve');

    return X;
  };


  const solve = (A, b) => {
    if (shapeOfMatrix(A)[0] != shapeOfMatrix(b)[0])
      throw new Error('matrix shapes must match');

    const t = triangulation(A);

    return _solve(t.R, matrixProduct(t.U, b));
  };


  const inverse = A => {
    const [nrows, ncols] = shapeOfMatrix(A);
    if (nrows != ncols)
      throw new Error('must be a square matrix');

    return solve(A, identity(nrows));
  };


  const isDiagonal = A => {
    const [n, m] = shapeOfMatrix(A);
    for (let i = 0; i < n; ++i) {
      for (let j = 0; j < m; ++j) {
        if (i != j && sops.ne(A[i][j], 0))
          return false;
      }
    }
    return true;
  };


  const smithNormalForm = A => {
    const [n, m] = shapeOfMatrix(A);
    let D = A;
    let P = identity(n);
    let Q = identity(m);
    let t;

    do {
      t = triangulation(D, true);
      P = matrixProduct(t.U, P);
      D = transposedMatrix(t.R);
      t = triangulation(D, true);
      Q = matrixProduct(t.U, Q);
      D = transposedMatrix(t.R);
    } while (!(overField || isDiagonal(D)))

    return { P, D, Q: transposedMatrix(Q) };
  };


  const nullSpace = A => {
    const { P, D, Q } = smithNormalForm(A);
    const [m] = shapeOfMatrix(Q);
    const r = _rank(D);
    const M = matrix(r, m-r).concat(identity(m-r));
    return matrixProduct(Q, M);
  };


  const _solution = (A, b, modZ) => {
    const [n, m] = shapeOfMatrix(A);
    const [_, k] = shapeOfMatrix(b);

    const { P, D, Q } = smithNormalForm(A);
    const v = matrixProduct(P, b);
    const y = matrix(m, k);

    for (let i = 0; i < n; ++i) {
      const d = i < m ? D[i][i] : 0;
      for (let j = 0; j < k; ++j) {
        const r = v[i][j];
        if (sops.eq(d, 0)) {
          if (!(sops.eq(r, 0)
                || (modZ
                    && sops.isInteger(r))
                || (!sops.isRational(r)
                    && sops.le(sops.abs(r), epsilon))))
          {
            return null;
          }
        }
        else if (i < m) {
          y[i][j] = sops.div(r, d);
        }
      }
    }

    return matrixProduct(Q, y);
  };


  const solution = (A, b) => {
    if (shapeOfMatrix(A)[0] != shapeOfMatrix(b)[0])
      throw new Error('matrix shapes must match');

    return _solution(A, b, false);
  };


  const solutionModZ = (A, b) => {
    if (shapeOfMatrix(A)[0] != shapeOfMatrix(b)[0])
      throw new Error('matrix shapes must match');

    return _solution(A, b, true);
  };


  const _rowProduct = (A, i, j) => {
    const [nrows, ncols] = shapeOfMatrix(A)
    return array(ncols)
      .map((_, k) => sops.times(A[i][k], A[j][k]))
      .reduce((a, x) => sops.plus(a, x));
  };

  const _normalizeRowInPlace = (A, i) => {
    const norm = Math.sqrt(sops.toJS(_rowProduct(A, i, i)));

    const row = A[i];
    for (const j in row)
      row[j] = sops.div(row[j], norm);
  };

  const orthonormalized = A => {
    const [nrows, ncols] = shapeOfMatrix(A)
    const O = cloneMatrix(A);

    array(nrows).forEach((_, i) => {
      array(i).forEach((_, j) => {
        _adjustRowInPlace(O, i, j, sops.negative(_rowProduct(O, i, j)))
      });
      _normalizeRowInPlace(O, i);
    });

    return O;
  };

  const cleanup = A => {
    const [nrows, ncols] = shapeOfMatrix(A);
    let sup = 0;
    for (let i = 0; i < nrows; ++i) {
      for (let j = 0; j < ncols; ++j) {
        const val = sops.abs(A[i][j]);
        if (sops.gt(val, sup))
          sup = val;
      }
    }
    const delta = sops.times(sup, epsilon);
    const cleaned = x => {
      if (sops.le(sops.abs(x), delta))
        return 0;
      else if (sops.le(sops.abs(sops.minus(sops.round(x),x)), epsilon))
        return sops.round(x);
      else
        return x;
    };

    return map.M(cleaned)(A);
  };


  const methods = {
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
      Vector: mapFold.V(x => sops.times(x, x), sops.plus),
      Matrix: mapFold.M(x => sops.times(x, x), sops.plus)
    },

    norm: {
      Vector: v => sops.sqrt(methods.squareNorm.Vector(v)),
      Matrix: m => sops.sqrt(methods.squareNorm.Matrix(m))
    },

    transposed: {
      Vector: v => v.map(x => [x]),
      Matrix: transposedMatrix
    },

    triangulation: {
      Matrix: M => triangulation(M, false)
    },

    rowEchelonForm: {
      Matrix: _rowEchelonForm
    },

    rank: {
      Matrix: rank
    },

    determinant: {
      Matrix: determinant
    },

    orthonormalized: {
      Matrix: orthonormalized
    },

    solve: {
      Matrix: {
        Vector: (m, v) => solve(m, methods.transposed.Vector(v)),
        Matrix: solve
      }
    },

    inverse: {
      Matrix: inverse
    },

    nullSpace: {
      Matrix: nullSpace
    },

    solution: {
      Matrix: { Matrix: solution }
    },

    solutionModZ: {
      Matrix: { Matrix: solutionModZ }
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

  if (epsilon) {
    methods.cleanup = {
      Vector: v => cleanup([v])[0],
      Matrix: m => cleanup(m)
    }
  }

  return sops.register(methods);
};
