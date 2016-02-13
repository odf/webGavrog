export function methods(scalarOps, scalarTypes) {

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

  const array = (len, val = 0) => Array(len).fill(val);

  const transposedMatrix = m => {
    const [nrows, ncols] = shapeOfMatrix(m);
    return array(ncols).map((_, j) => array(nrows).map((_, i) => m[i][j]));
  };


  const matrixProduct = (A, B) => {
    const [nrowsA, ncolsA] = shapeOfMatrix(A);
    const [nrowsB, ncolsB] = shapeOfMatrix(B);

    if (ncolsA != nrowsB)
      throw new Error('shapes do not match');

    return (
      array(nrowsA).map((_, i) => (
        array(ncolsB).map((_, j) => (
          array(ncolsA)
            .map((_, k) => scalarOps.times(A[i][k], B[k][j]))
            .reduce((a, x) => scalarOps.plus(a, x)))))));
  };


  const methods = {
    shape: {
      Vector: v => [v.length],
      Matrix: shapeOfMatrix
    },
    negative: {
      Vector: map.V(scalarOps.negative),
      Matrix: map.M(scalarOps.negative)
    },
    squareNorm: {
      Vector: mapFold.V(x => scalarOps.times(x, x), scalarOps.plus),
      Matrix: mapFold.M(x => scalarOps.times(x, x), scalarOps.plus)
    },
    transposed: {
      Vector: v => v.map(x => [x]),
      Matrix: transposedMatrix
    },
    times: {
      Vector: {
        Vector: (v, w) => matrixProduct([v], methods.transposed.Vector(w)),
        Matrix: (v, m) => matrixProduct([v], m)
      },
      Matrix: {
        Vector: (m, v) => matrixProduct(m, methods.transposed.Vector(v)),
        Matrix: matrixProduct
      }
    }
  };

  for (const name of ['plus', 'minus']) {
    methods[name] = {
      Vector: { Vector: map.VV(scalarOps[name]) },
      Matrix: { Matrix: map.MM(scalarOps[name]) }
    };

    for (const sType of scalarTypes) {
      methods[name]['Vector'][sType] = map.VS(scalarOps[name]);
      methods[name]['Matrix'][sType] = map.MS(scalarOps[name]);
      methods[name][sType] = {
        Vector: map.SV(scalarOps[name]),
        Matrix: map.SM(scalarOps[name])
      }
    }
  }

  return methods;
};


if (require.main == module) {
  const a = require('./base').arithmetic()
    .register(require('./integers').methods());

  const ops = a.register(methods(a.ops(), ['Integer', 'LongInt'])).ops();

  const V = [1, 2, 3];
  const M = [[1, 2, 3], [4, 5, 6]];

  console.log(ops.shape(V));
  console.log(ops.negative(V));
  console.log(ops.transposed(V));
  console.log(ops.squareNorm(V));
  console.log(ops.plus(V, [3, 2, 1]));
  console.log(ops.plus(V, 2));
  console.log(ops.minus(V, [0, 1, 2]));
  console.log(ops.minus(V, 1));
  console.log(ops.minus(1, V));

  console.log();
  console.log(ops.negative(M));
  console.log(ops.shape(M));
  console.log(ops.transposed(M));
  console.log(ops.squareNorm(M));
  console.log(ops.plus(M, [[9, 8, 7], [6, 5, 4]]));
  console.log(ops.plus(M, 2));
  console.log(ops.minus(M, [[0, 1, 2], [3, 4, 5]]));
  console.log(ops.minus(M, 1));
  console.log(ops.minus(1, M));

  console.log();
  console.log(ops.times(V, V));
  console.log(ops.times(M, V));
  console.log(ops.times(V, ops.transposed(M)));
  console.log(ops.times(M, ops.transposed(M)));
}
