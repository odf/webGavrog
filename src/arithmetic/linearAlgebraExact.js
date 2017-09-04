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


  const rank = rows => triangularBasis(rows).length;


  const determinant = rows => {
    const [nrows, ncols] = ops.shape(rows);
    if (nrows != ncols)
      throw new Error('must be a square matrix');

    const bs = triangularBasis(rows);

    if (bs.length < nrows)
      return 0;
    else
      return bs.map((v, i) => v[i]).reduce((a, x) => ops.times(a, x));
  };


  const reducedBasis = rows => {
    const div = overField ? ops.div : ops.idiv;
    const bs = triangularBasis(rows);

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


  const methods = {
    extendBasis: {
      Vector: {
        Null: extendBasis,
        Matrix: extendBasis
      }
    },
    triangularBasis: { Matrix: triangularBasis },
    reducedBasis: { Matrix: reducedBasis },
    rank: { Matrix: rank },
    determinant: { Matrix: determinant }
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

  const test = A => {
    console.log(`A = ${A}`);
    console.log(`over field:`);
    console.log(`  basis = ${opsF.triangularBasis(A)}`);
    console.log(`  reduced = ${opsF.reducedBasis(A)}`);
    console.log(`  rank(A): ${opsO.rank(A)} <-> ${opsF.rank(A)}`);
    console.log(`  det(A) : ${opsO.determinant(A)} <-> ${opsF.determinant(A)}`);
    console.log(`over module:`);
    console.log(`  basis = ${opsM.triangularBasis(A)}`);
    console.log(`  reduced = ${opsM.reducedBasis(A)}`);
    console.log(`  rank(A): ${opsO.rank(A)} <-> ${opsM.rank(A)}`);
    console.log(`  det(A) : ${opsO.determinant(A)} <-> ${opsM.determinant(A)}`);
    console.log();
  };

  test([[1,2,3],[0,4,5],[6,0,7]]);
  test([[9,8,7],[6,5,4],[3,2,1]]);
  test([[2,3,4],[5,6,7],[8,9,0]]);
}
