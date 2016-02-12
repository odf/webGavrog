export function methods(scalarOps, scalarTypes) {

  const squareNormV = v =>
    v.map(x => scalarOps.times(x, x)).reduce((s, x) => scalarOps.plus(s, x));

  const plusVV = (v, w) => {
    const n = v.length;
    if (w.length != n)
      throw new Error('vector length mismatch');
    return v.map((x, i) => x + w[i]);
  };

  const plusMM = (a, b) => {
    const n = a.length;
    if (b.length != n)
      throw new Error('matrix size mismatch');
    return a.map((v, i) => plusVV(v, b[i]));
  };

  const plusVS = (v, s) => v.map(x => scalarOps.plus(x, s));
  const plusMS = (m, s) => m.map(v => plusVS(v, s));

  const minusVV = (v, w) => {
    const n = v.length;
    if (w.length != n)
      throw new Error('vector length mismatch');
    return v.map((x, i) => x - w[i]);
  };

  const minusMM = (a, b) => {
    const n = a.length;
    if (b.length != n)
      throw new Error('matrix size mismatch');
    return a.map((v, i) => minusVV(v, b[i]));
  };

  const minusVS = (v, s) => v.map(x => scalarOps.minus(x, s));
  const minusMS = (m, s) => m.map(v => minusVS(v, s));

  const methods = {
    negative: {
      Vector: v => v.map(x => scalarOps.negative(x)),
      Matrix: m => m.map(v => v.map(x => scalarOps.negative(x)))
    },
    squareNorm: {
      Vector: squareNormV,
      Matrix: m => m.map(squareNormV).reduce((s, x) => scalarOps.plus(s, x))
    },
    plus: {
      Vector: { Vector: plusVV },
      Matrix: { Matrix: plusMM }
    },
    minus: {
      Vector: { Vector: minusVV },
      Matrix: { Matrix: minusMM }
    }
  };

  for (const [name, opVS, opMS] of [
    ['plus' , plusVS , plusMS ],
    ['minus', minusVS, minusMS]
  ]) {
    for (const sType of scalarTypes) {
      methods[name]['Vector'][sType] = opVS;
      methods[name]['Matrix'][sType] = opMS;
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

  console.log(ops.negative(V));
  console.log(ops.negative(M));
  console.log(ops.squareNorm(V));
  console.log(ops.squareNorm(M));
  console.log(ops.plus(V, [3, 2, 1]));
  console.log(ops.plus(V, 2));
  console.log(ops.minus(V, [0, 1, 2]));
  console.log(ops.minus(V, 1));
  console.log(ops.plus(M, [[9, 8, 7], [6, 5, 4]]));
  console.log(ops.plus(M, 2));
  console.log(ops.minus(M, [[0, 1, 2], [3, 4, 5]]));
  console.log(ops.minus(M, 1));
}
