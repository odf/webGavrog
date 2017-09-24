export const extend = (matrixOps, overField=true, eps=null) => {
  const ops = matrixOps;


  const _cleanup = (v, limit) =>
    v.map((x, k) => ops.le(ops.abs(x), ops.abs(limit[k])) ? 0 : x);


  const extendBasis = (v, bs) => {
    if (bs && bs.length)
      bs = bs.slice();

    for (const row in bs || []) {
      let b = bs[row];
      const colB = b.findIndex(x => ops.ne(x, 0));
      const colV = v.findIndex(x => ops.ne(x, 0));

      if (v.length != b.length)
        throw Error("shapes don't match");

      if (colV < colB) {
        if (colV >= 0)
          bs.splice(row, 0, (bs.length - row) % 2 ? ops.negative(v) : v);
        return bs;
      }
      else if (colV == colB) {
        if (ops.abs(v[colV]) > ops.abs(b[colV])) {
          [b, v] = [v, ops.negative(b)];
          bs[row] = b;
        }
        if (overField || ops.eq(0, ops.mod(v[colV], b[colV]))) {
          const w = ops.minus(v, ops.times(b, ops.div(v[colV], b[colV])));
          v = eps ? _cleanup(w, ops.times(v, eps * v.length)) : w;
        }
        else {
          const [x, r, s, t, u] = ops.gcdex(b[colV], v[colV]);
          const det = ops.minus(ops.times(r, u), ops.times(s, t));
          bs[row] = ops.times(det, ops.plus(ops.times(b, r), ops.times(v, s)));
          v = ops.plus(ops.times(b, t), ops.times(v, u));
        }
      }
    }

    return ops.sgn(v) == 0 ? bs : (bs || []).concat([v]);
  };


  const triangularBasis = rows =>
    rows.reduce((bs, v) => extendBasis(v, bs), null);


  const rank = rows => (triangularBasis(rows) || []).length;


  const determinant = rows => {
    const [nrows, ncols] = ops.shape(rows);
    if (nrows != ncols)
      throw new Error('must be a square matrix');

    const bs = triangularBasis(rows);

    if (bs == null || bs.length < nrows)
      return 0;
    else
      return bs.reduce((a, v, i) => ops.times(a, v[i]), 1);
  };


  const reducedBasis = (mat, right=null) => {
    const div = overField ? ops.div : ops.idiv;
    const t = right == null ? mat : mat.map((v, i) => v.concat(right[i]));
    const bs = triangularBasis(t);

    if (bs == null)
      return right == null ? null : [null, null];

    let col = 0;
    for (let row = 0; row < bs.length; ++row) {
      while (ops.eq(bs[row][col], 0))
        ++col;

      if (ops.lt(bs[row][col], 0))
        bs[row] = ops.negative(bs[row]);

      if (overField && ops.ne(bs[row][col], 1))
        bs[row] = div(bs[row], bs[row][col]);

      const p = bs[row][col];

      for (let i = 0; i < row; ++i) {
        if (overField || ops.ge(bs[i][col], p) || ops.lt(bs[i][col], 0)) {
          const w = ops.minus(bs[i], ops.times(bs[row], div(bs[i][col], p)));
          bs[i] = eps ? _cleanup(w, ops.times(bs[i], eps * bs[i].length)) : w;
        }
      }
    }

    if (right == null)
      return bs;
    else {
      const [n, m] = ops.shape(mat);
      return [bs.map(v => v.slice(0, m)), bs.map(v => v.slice(m))];
    }
  };


  const solve = (lft, rgt) => {
    const [rowsLft, colsLft] = ops.shape(lft);
    const [rowsRgt, colsRgt] = ops.shape(rgt);
    if (rowsLft != rowsRgt)
      throw new Error('left and right side must have equal number of rows');

    [lft, rgt] = reducedBasis(lft, rgt);

    if (lft == null)
      return ops.matrix(colsLft, colsRgt);
    else if (rank(lft) < lft.length)
      return null;

    const [n, m] = ops.shape(lft);
    const [B, U] = reducedBasis(ops.transposed(lft), ops.identityMatrix(m))
      .map(t => ops.transposed(t));

    const y = [];
    for (const i in rgt) {
      const v = ops.minus(rgt[i], ops.times(B[i].slice(0, i), y));
      if (!overField && v.some(x => ops.ne(ops.mod(x, B[i][i]), 0)))
        return null;

      y.push(v.map(x => ops.div(x, B[i][i])));
    }

    return ops.times(U, y.concat(ops.matrix(m - n, y[0].length)));
  };


  const leftNullSpace = mat => {
    const [nrows, ncols] = ops.shape(mat);
    const [lft, rgt] = reducedBasis(mat, ops.identityMatrix(nrows));
    const k = lft.findIndex(v => v.every(x => ops.eq(x, 0)));

    if (k >= 0)
      return rgt.slice(k);
    else
      return null;
  };


  const methods = {
    __context__: () => `linearAlgebra(${matrixOps.__context__()})`,

    extendBasis: {
      Vector: {
        Null: extendBasis,
        Matrix: extendBasis
      }
    },

    triangularBasis: {
      Null: _ => null,
      Matrix: triangularBasis
    },

    reducedBasis: {
      Null: _ => null,
      Matrix: mat => reducedBasis(mat)
    },

    rank: {
      Null: _ => 0,
      Matrix: rank
    },

    determinant: {
      Null: _ => 0,
      Matrix: determinant
    },

    solve: {
      Matrix: {
        Matrix: (lft, rgt) => solve(lft, rgt)
      }
    },

    inverse: {
      Null: _ => null,
      Matrix: mat => solve(mat, ops.identityMatrix(mat.length))
    },

    leftNullSpace: {
      Null: _ => null,
      Matrix: leftNullSpace
    },

    nullSpace: {
      Null: _ => null,
      Matrix: mat => ops.transposed(leftNullSpace(ops.transposed(mat)))
    }
  };


  return ops.register(methods);
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const suite = (ops, name) => {
    const test = (A, v) => {
      const b = ops.times(A, v);

      console.log(`A = ${A}`);
      console.log(`  reduced => ${ops.reducedBasis(A)}`);
      console.log(`v = ${v}`);
      console.log(`b := A * v = ${b}`);

      const x = ops.solve(A, b);
      console.log(`A * x = b ~> x = ${x}`);
      console.log(`check A * x: ${ops.times(A, x)}`);

      const n = ops.nullSpace(A);
      console.log(`nullspace: ${ops.transposed(n)}`);
      if (n)
        console.log(`nullspace check ${ops.times(A, n)}`);

      console.log();
    };

    const testInv = A => {
      console.log(`A = ${A}`);
      const Ainv = ops.solve(A, ops.identityMatrix(A.length));
      console.log(`Ainv = ${Ainv}`);
      console.log(`check: A * Ainv = ${ops.times(A, Ainv)}`);
      console.log();
    };

    console.log(`=== ${name} ===`);
    console.log();

    test([[18,12,14],[8,10,7],[5,10,5]], [[18],[21],[12]]);
    test([[1,0,-1,2]], [[1],[2],[3],[4]]);
    test([[13,18,4],[10,17,3],[3,1,1]], [[18],[10],[0]]);
    test([[6,3],[0,5]], [[2],[3]]);
    test([[5,1,2],[10,8,5],[5,7,3]], [[3],[7],[0]]);
    test([[5,1,2],[10,8,5],[5,7,3]], [[ops.div(3, 5)],[7],[0]]);
    test([[0,0,0],[ 0,0,0],[0,0,0]], [[0],[0],[0]]);

    testInv([[1,2,0,1],[0,1,1,0],[0,0,1,2]]);

    console.log();
  };

  const types = require('./types');
  suite(types.rationalLinearAlgebra, "Rationals as field");
  suite(types.rationalLinearAlgebraModular, "Rationals as ring");
  suite(types.numericalLinearAlgebra, "Numerical with JS floats");
}
