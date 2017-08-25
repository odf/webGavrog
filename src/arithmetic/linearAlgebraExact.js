export const extendBasis = (v, bs, ops, overField=true) => {
  if (bs.length == 0) {
    if (v.findIndex(x => ops.ne(x, 0)) >= 0)
      bs.push(v);
  }
  else {
    const [nrows, ncols] = ops.shape(bs);
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
          const [x, r, s, t, u] = ops.gcdex(v[colV], b[colV]);
          bs[rowBs] = ops.plus(ops.times(v, r), ops.times(b, s));
          v = ops.plus(ops.times(v, t), ops.times(b, u));
        }
      }

      ++rowBs;
    }

    while (colV < ncols && ops.eq(v[colV], 0))
      ++colV;

    if (colV < ncols)
      bs.splice(rowBs, 0, v);
  }
};
