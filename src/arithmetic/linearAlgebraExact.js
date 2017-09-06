export const extend = (matrixOps, overField) => {
  const ops = matrixOps;


  const extendBasis = (v, bs) => {
    const [nrows, ncols] = bs == null ? [0, v.length] : ops.shape(bs);
    if (v.length != ncols)
      throw Error("shapes don't match");

    let rowBs = 0;
    let colBs = 0;
    let colV = 0;

    while (rowBs < nrows && colBs < ncols) {
      const b = bs[rowBs];
      while (colBs < ncols && ops.eq(b[colBs], 0))
        ++colBs;

      while (colV < ncols && ops.eq(v[colV], 0))
        ++colV;

      if (colV < colBs || colV >= ncols || colBs >= ncols)
        break;
      else if (colV == colBs) {
        if (overField || ops.eq(0, ops.mod(v[colV], b[colV]))) {
          v = ops.minus(v, ops.times(b, ops.div(v[colV], b[colV])));
        }
        else {
          const [x, r, s, t, u] = ops.gcdex(b[colV], v[colV]);
          bs[rowBs] = ops.plus(ops.times(b, r), ops.times(v, s));
          if (ops.lt(ops.times(r, u), ops.times(s, t)))
            bs[rowBs] = ops.negative(bs[rowBs]);
          v = ops.plus(ops.times(b, t), ops.times(v, u));
        }
      }

      ++rowBs;
    }

    while (colV < ncols && ops.eq(v[colV], 0))
      ++colV;

    if (colV < ncols) {
      if ((nrows - rowBs) % 2 != 0)
        v = ops.negative(v);

      if (nrows == 0)
        return [v];
      else
        return bs.slice(0, rowBs).concat([v], bs.slice(rowBs));
    }
    else
      return bs;
  };


  const triangularBasis = rows => {
    let bs = null;
    for (const v of rows)
      bs = extendBasis(v, bs);
    return bs;
  };


  const rank = rows => {
    const bs = triangularBasis(rows);
    return bs == null ? 0 : bs.length;
  };


  const determinant = rows => {
    const [nrows, ncols] = ops.shape(rows);
    if (nrows != ncols)
      throw new Error('must be a square matrix');

    const bs = triangularBasis(rows);

    if (bs == null || bs.length < nrows)
      return 0;
    else
      return bs.map((v, i) => v[i]).reduce((a, x) => ops.times(a, x));
  };


  const reducedBasis = rows => {
    const div = overField ? ops.div : ops.idiv;
    const bs = triangularBasis(rows);

    if (bs == null)
      return null;

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
        if (overField || ops.ge(bs[i][col], p) || ops.lt(bs[i][col], 0))
          bs[i] = ops.minus(bs[i], ops.times(bs[row], div(bs[i][col], p)));
      }
    }

    return bs;
  };


  const _solveDiophantine = (vec, val) => {
    if (vec.length == 1) {
      if (ops.eq(ops.mod(val, vec[0]), 0))
        return [ops.div(val, vec[0])];
      else
        return null;
    }
    else {
      const [x, a, b, c, d] = ops.gcdex(vec[0], vec[1]);
      const t = _solveDiophantine([x].concat(vec.slice(2)), val);

      if (t == null)
        return null;
      else
        return [ops.times(a, t[0]), ops.times(b, t[0])].concat(t.slice(1));
    }
  };


  const _leadingPositions = bs => {
    const result = [];

    if (bs != null) {
      let col = 0;
      for (let row = 0; row < bs.length; ++row) {
        while (ops.eq(bs[row][col], 0))
          ++col;
        result.push(col);
      }
    }

    return result;
  };


  const solve = (lft, rgt) => {
    const [rowsRgt, colsRgt] = ops.shape(lft);
    const [rowsLft, colsLft] = ops.shape(lft);
    if (rowsLft != rowsRgt)
      throw new Error('left and right side must have equal number of rows');

    const bs = reducedBasis(lft.map((v, i) => v.concat(rgt[i])));
    if (bs == null)
      return ops.matrix(rowsRgt, colsLft);

    const [rows, cols] = ops.shape(bs);
    const leading = _leadingPositions(bs);

    if (leading[rows - 1] >= colsLft)
      return null;

    leading.push(colsLft);

    const result = [];

    for (let j = colsLft; j < cols; ++j) {
      let out = [];

      for (let k = rows - 1; k >= 0; --k) {
        const b = bs[k];
        const [from, to] = [leading[k], leading[k + 1]];
        const s = ops.minus(b[j], ops.times(out, b.slice(to, colsLft)));

        if (overField) {
          out = ops.vector(to - from).concat(out);
          out[0] = ops.div(s, b[from]);
        }
        else {
          const w = _solveDiophantine(b.slice(from, to), s);
          if (w == null)
            return null;
          else
            out = w.concat(out);
        }
      }

      if (leading[0] > 0)
        out = ops.vector(leading[0]).concat(out);

      result.push(out);
    }

    return ops.transposed(result);
  };


  const leftNullSpace = mat => {
    const [nrows, ncols] = ops.shape(mat);
    const I = ops.identityMatrix(nrows);
    const ext = reducedBasis(mat.map((v, i) => v.concat(I[i])));
    const leading = _leadingPositions(ext);
    const k = leading.findIndex(x => x >= ncols);

    if (k >= 0)
      return ext.slice(k).map(v => v.slice(ncols));
    else
      return null;
  };


  const nullSpace = mat => {
    const lns = leftNullSpace(ops.transposed(mat));
    if (lns == null)
      return null;
    else
      return ops.transposed(lns);
  };


  const methods = {
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
      Matrix: reducedBasis
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
        Matrix: solve
      }
    },

    leftNullSpace: {
      Null: _ => null,
      Matrix: leftNullSpace
    },

    nullSpace: {
      Null: _ => null,
      Matrix: nullSpace
    }
  };


  return ops.register(methods);
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const types = require('./types');
  const opsO = types.rationalMatrices;
  const opsF = extend(types.rationalMatrices, true);
  const opsM = extend(types.rationalMatrices, false);

  const I = [[1,0,0],[0,1,0],[0,0,1]];
  const B = [[1,2,3],[4,5,6],[7,8,0]];

  const testIn = (A, ops) => {
    const [n, m] = opsO.shape(A);

    console.log(`  basis = ${ops.triangularBasis(A)}`);
    console.log(`  reduced = ${ops.reducedBasis(A)}`);
    console.log(`  rank(A): ${opsO.rank(A)} <-> ${ops.rank(A)}`);
    if (n == m)
      console.log(
        `  det(A) : ${opsO.determinant(A)} <-> ${ops.determinant(A)}`);

    const Ainv = ops.solve(A, I);
    if (Ainv == null)
      console.log(`  no inverse`);
    else if (ops.eq(ops.times(A, Ainv), I))
      console.log(`  inverse check okay - got ${Ainv}`);
    else
      console.log(`  inverse check failed -`,
                  `${A} * ${Ainv} = ${ops.times(A, Ainv)}`);

    const N = ops.nullSpace(A);
    if (N == null)
      console.log(`  empty nullspace`);
    else if (ops.eq(ops.times(A, N), ops.times(A, ops.times(0, N))))
      console.log(`  nullspace check okay - got ${N}`);
    else
      console.log(`  nullspace check failed -`,
                  `${A} * ${N} = ${ops.times(A, N)}`);

    const M = ops.solve(A, ops.times(A, B));
    console.log(`  solving ${A} * M = ${ops.times(A, B)}:`);
    console.log(`  M = ${M}`);

    if (M == null)
      console.log(`  no solution`);
    else if (ops.eq(ops.times(A, M), ops.times(A, B)))
      console.log(`  check okay!`);
    else
      console.log(`  check failed -`,
                  `${ops.times(A, M)} should be ${ops.times(A, B)}`);
  };

  const test = A => {
    console.log(`A = ${A}`);
    console.log();
    console.log(`over field:`);
    testIn(A, opsF);
    console.log();
    console.log(`over module:`);
    testIn(A, opsM);
    console.log();
    console.log();
    console.log();
  };

  test([[0,0,0],[0,0,0],[0,0,0]]);
  test([[1,2,3],[0,4,5],[6,0,7]]);
  test([[2,3,4],[5,6,7],[8,9,0]]);
  test([[9,8,7],[6,5,4],[3,2,1]]);
  test([[1,2,3],[0,1,4],[0,0,1]]);
  test([[1,1,1],[0,1,1],[0,0,1]]);
}
