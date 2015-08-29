import * as I from 'immutable';


export default function matrix(scalar, zero, one) {

  const Matrix = I.Record({
    nrows: undefined,
    ncols: undefined,
    data : undefined
  });

  Matrix.prototype.toString = function() {
    return '<'+this.nrows+'x'+this.ncols+' matrix: '+this.data+'>';
  };

  const get = (A, i, j) => A.data.getIn([i, j]);

  const _make = function _make(data) {
    if (data.size == 0 || data.first().size == 0)
      throw new Error('both dimensions must be positive');

    return new Matrix({
      nrows: data.size,
      ncols: data.first().size,
      data : I.List(data.map(I.List))
    });
  };

  const make = function make(data) {
    const tmp = I.List(data.map(I.List));
    const m = tmp.map(row => row.size).max();
    return _make(tmp.map(row => row.concat(I.Repeat(zero, m - row.size))));
  };

  const constant = function constant(nrows, ncols, value) {
    const x = value === undefined ? zero : value;
    return _make(I.List(I.Repeat(I.List(I.Repeat(x, ncols)), nrows)));
  };

  const identity = function identity(n) {
    const zrow = I.List(I.Repeat(zero, n));
    return _make(I.Range(0, n).map(i => zrow.set(i, one)));
  };

  const transposed = function transposed(A) {
    return _make(
      I.Range(0, A.ncols).map(j => (
        I.Range(0, A.nrows).map(i => (
          get(A, i, j)))))
    );
  };

  const set = function set(A, i, j, x) {
    return _make(A.data.setIn([i, j], x));
  };

  const update = function update(A, i, j, fn) {
    return _make(A.data.updateIn([i, j], fn));
  };

  const plus = function plus(A, B) {
    if (A.nrows != B.nrows || A.ncols != B.ncols)
      throw new Error('shapes do not match');

    return _make(
      I.Range(0, A.nrows).map(i => (
        I.Range(0, A.ncols).map(j => (
          scalar.plus(get(A, i, j), get(B, i, j))))))
    );
  };

  const minus = function minus(A, B) {
    if (A.nrows != B.nrows || A.ncols != B.ncols)
      throw new Error('shapes do not match');

    return _make(
      I.Range(0, A.nrows).map(i => (
        I.Range(0, A.ncols).map(j => (
          scalar.minus(get(A, i, j), get(B, i, j))))))
    );
  };

  const scaled = function scaled(f, A) {
    return _make(A.data.map(row => row.map(x => scalar.times(f, x))));
  };

  const times = function times(A, B) {
    if (A.ncols != B.nrows)
      throw new Error('shapes do not match');

    return _make(
      I.Range(0, A.nrows).map(i => (
        I.Range(0, B.ncols).map(j => (
          I.Range(0, A.ncols)
            .map(k => scalar.times(get(A, i, k), get(B, k, j)))
            .reduce(scalar.plus, zero)))))
    );
  };


  const _findPivot = function _findPivot(A, row, col, overField) {
    let best = row;
    for (let i = row; i < A.nrows; ++i) {
      const x = scalar.abs(get(A, i, col));
      if (scalar.sgn(x) != 0) {
        const d = scalar.cmp(x, scalar.abs(get(A, best, col)));
        if (overField ? d > 0 : d < 0)
          best = i;
      }
    }
    return best;
  };

  const _swapRows = function _swapRows(A, i, j) {
    return _make(A.data.set(i, A.data.get(j)).set(j, A.data.get(i)));
  };

  const _negateRow = function _negateRow(A, i) {
    return _make(A.data.set(i, A.data.get(i).map(scalar.negative)));
  };

  const _truncate = function _truncate(x, a) {
    const d = scalar.times(a, scalar.epsilon);
    if (scalar.cmp(scalar.abs(x), scalar.abs(d)) < 0)
      return zero;
    else
      return x;
  };

  const _adjustRow = function _adjustRow(A, i, j, f) {
    const fn0 = k => scalar.plus(get(A, i, k), scalar.times(get(A, j, k), f));
    const fn  = scalar.epsilon ? k => _truncate(fn0(k), get(A, i, k)) : fn0;

    return _make(A.data.set(i, I.Range(0, A.ncols).map(fn)));
  };

  const _Triangulation = I.Record({
    R: undefined,
    U: undefined,
    sign: undefined
  });

  const triangulation = function triangulation(A, overField) {
    const divide = overField ? scalar.div : scalar.idiv;

    let R = A;
    let U = identity(R.nrows);
    let col = 0;
    let sign = 1;

    for (let row = 0; row < R.nrows; ++row) {
      let cleared = false;

      while (!cleared && col < R.ncols) {
        const pivotRow = _findPivot(R, row, col, overField);
        const pivot = get(R, pivotRow, col);

        if (scalar.sgn(pivot) == 0) {
          ++col;
          continue;
        }

        if (pivotRow != row) {
          R = _swapRows(R, row, pivotRow);
          U = _swapRows(U, row, pivotRow);
          sign *= -1;
        }

        if (scalar.sgn(pivot) < 0) {
          R = _negateRow(R, row);
          U = _negateRow(U, row);
          sign *= -1;
        }

        cleared = true;

        for (let k = row + 1; k < R.nrows; ++k) {
          if (scalar.sgn(get(R, k, col)) != 0) {
            const f = scalar.negative(divide(get(R, k, col), get(R, row, col)));

            R = _adjustRow(R, k, row, f);
            U = _adjustRow(U, k, row, f);

            if (overField)
              R = set(R, k, col, zero);
            else
              cleared = scalar.sgn(get(R, k, col)) == 0;
          }
        }

        if (cleared)
          ++col;
      }
    }

    return new _Triangulation({ R: R, U: U, sign: sign });
  };


  const _rank = function _rank(R) {
    let row = 0;
    for (let col = 0; col < R.ncols; ++col)
      if (row < R.nrows && scalar.sgn(get(R, row, col)) != 0)
        ++row;
    return row;
  };


  const rank = function rank(A) {
    return _rank(triangulation(A, true).R);
  };


  const _determinant = function _determinant(t) {
    return I.Range(0, t.R.nrows)
      .map(i => get(t.R, i, i))
      .reduce(scalar.times, t.sign);
  };


  const determinant = function determinant(A) {
    if (A.nrows != A.ncols)
      throw new Error('must be a square matrix');

    return _determinant(triangulation(A, true));
  };


  const _solve = function _solve(R, v) {
    const n = R.nrows;
    const m = R.ncols;
    const k = v.ncols;
    const top = Math.min(n, m);

    let X = constant(m, k);

    for (let j = 0; j < k; ++j) {
      for (let i = top-1; i >= 0; --i) {
        const x = I.Range(i+1, top)
          .map(nu => scalar.times(get(R, i, nu), get(X, nu, j)))
          .reduce(scalar.plus, zero);
        const right = scalar.minus(get(v, i, j), x);

        if (scalar.sgn(right) == 0)
          X = set(X, i, j, right);
        else if (scalar.sgn(get(R, i, i)) == 0)
          return null;
        else
          X = set(X, i, j, scalar.div(right, get(R, i, i)));
      }
    }

    return X;
  };


  const solve = function solve(A, b) {
    if (A.nrows != b.nrows)
      throw new Error('matrix shapes must match');

    const t = triangulation(A, true);

    return _solve(t.R, times(t.U, b));
  };


  const inverse = function inverse(A) {
    if (A.nrows != A.ncols)
      throw new Error('must be a square matrix');

    return solve(A, identity(A.nrows));
  };


  const _nullSpace = function _nullSpace(R) {
    const n = R.nrows;
    const m = R.ncols;
    const r = _rank(R);
    const d = m - r;

    if (d == 0)
      return null;
    else if (r == 0)
      return identity(m);

    const B = make(
      I.Range(0, r).map(i => (
        I.Range(0, d).map(j => (
          (j + r >= n) ? 0 : scalar.negative(get(R, i, j + r))))))
    );

    const S = _solve(make(R.data.slice(0,r)), B);
    return make(S.data.slice(0, r).concat(identity(d).data));
  };


  const nullSpace = function nullSpace(A) {
    return _nullSpace(triangulation(A, true).R);
  };


  const _rowProduct = function _rowProduct(A, i, j) {
    return I.Range(0, A.ncols)
      .map(k => scalar.times(get(A, i, k), get(A, j, k)))
      .reduce(scalar.plus, zero);
  };

  const _normalizeRow = function _normalizeRow(A, i) {
    const norm = Math.sqrt(scalar.toJS(_rowProduct(A, i, i)));
    return _make(A.data.set(i, A.data.get(i).map(x => scalar.div(x, norm))));
  };

  const orthonormalized = function orthonormalized(A) {
    I.Range(0, A.nrows).forEach(i => {
      I.Range(0, i).forEach(j => {
        A = _adjustRow(A, i, j, scalar.negative(_rowProduct(A, i, j)))
      });
      A = _normalizeRow(A, i);
    });
    return A;
  };


  return {
    make         : make,
    constant     : constant,
    identity     : identity,
    transposed   : transposed,
    set          : set,
    update       : update,
    get          : get,
    plus         : plus,
    minus        : minus,
    scaled       : scaled,
    times        : times,
    triangulation: triangulation,
    rank         : rank,
    determinant  : determinant,
    solve        : solve,
    inverse      : inverse,
    nullSpace    : nullSpace,
    orthonormalized: orthonormalized
  };
};


if (require.main == module) {
  let M = matrix(require('./number'), 0, 1);

  console.log(M.constant(3, 4));
  console.log(M.constant(3, 4, 5));
  console.log(M.identity(3));
  console.log(M.transposed(M.constant(3, 4, 5)));
  console.log(M.set(M.identity(3), 0, 1, 4));
  console.log(M.transposed(M.set(M.identity(3), 0, 1, 4)));
  console.log();

  const testTriangulation = function testTriangulation(A) {
    const t = M.triangulation(A);
    console.log('A = '+A);
    console.log('t.U = '+t.U);
    console.log('t.R = '+t.R);
    console.log('t.sign = '+t.sign);
    console.log('t.U * A = '+M.times(t.U, A));
    console.log('rk(A) = '+M.rank(A));
    console.log('det(A) = '+M.determinant(A));
    console.log();
  };

  testTriangulation(M.make([[1,2,3],[6,5,4],[7,8,9]]));
  testTriangulation(M.make([[1],[2,3],[4,5,6]]));

  const testSolve = function testSolve(A, b) {
    const x = M.solve(A, b);
    console.log('A = '+A);
    console.log('b = '+b);
    console.log('x = '+x);
    console.log('A * x = '+M.times(A, x));
    console.log();
  };

  testSolve(M.make([[1,2,3],[0,4,5],[0,0,6]]),
            M.make([[1],[1],[1]]));
  testSolve(M.make([[1,2,3],[0,4,5],[0,0,6]]),
            M.make([[1],[2,3],[4,5,6]]));

  const testInverse = function testInverse(A) {
    const B = M.inverse(A);
    console.log('A = '+A);
    console.log('R = '+M.triangulation(A, true).R);
    if (B) {
      console.log('A^-1 = '+B);
      console.log('A * A^-1 = '+M.times(A, B));
    }
    console.log('nullspace: '+M.nullSpace(A));
    console.log();
  };

  testInverse(M.make([[1],[2,3],[4,5,6]]));
  testInverse(M.make([[1,2,3],[0,4,5],[0,0,6]]));
  testInverse(M.make([[1,2,3],[4,5,6],[7,8,9]]));
  testInverse(M.make([[1,2,3],[2,4,6],[3,6,9]]));


  M = matrix(require('./float'), 0, 1);

  testInverse(M.make([[1],[2,3],[4,5,6]]));
  testInverse(M.make([[1,2,3],[0,4,5],[0,0,6]]));
  testInverse(M.make([[1,2,3],[4,5,6],[7,8,9]]));
  testInverse(M.make([[1,2,3],[2,4,6],[3,6,9]]));

  const testOrthonormalize = function testOrthonormalize(A) {
    console.log('A = '+A);
    const O = M.orthonormalized(A);
    console.log('O = '+O);
    console.log('O * O^t = '+M.times(O, M.transposed(O)));
    console.log();
  };

  testOrthonormalize(M.make([[1],[2,3],[4,5,6]]));
  testOrthonormalize(M.make([[1,2,3],[0,4,5],[0,0,6]]));
}
