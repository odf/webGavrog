export const extendBasis = (v, bs, ops, overField=true) => {
  // properly implement the case overField=false

  if (bs.length == 0)
    bs.push(v);
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
      else if (colV == colBs)
        v = ops.minus(v, ops.times(b, ops.div(v[colV], b[colV])));

      ++rowBs;
    }

    if (colV < ncols)
      bs.splice(rowBs, 0, v);
  }
};
