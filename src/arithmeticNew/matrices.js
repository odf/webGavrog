export function methods(scalarOps, scalarTypes) {

  const mapM = f => m => m.map(v => v.map(f));

  const vectorSquareNorm = v =>
    v.map(x => scalarOps.times(x, x)).reduce((s, x) => scalarOps.plus(s, x));

  const methods = {
    negative: {
      Vector: v => v.map(x => scalarOps.negative(x)),
      Matrix: mapM(x => scalarOps.negative(x))
    },
    squareNorm: {
      Vector: v => vectorSquareNorm(v),
      Matrix: m =>
        m.map(vectorSquareNorm).reduce((s, x) => scalarOps.plus(s, x))
    }
  };

  return methods;
};


if (require.main == module) {
  const a = require('./base').arithmetic()
    .register(require('./integers').methods());

  const ops = a.register(methods(a.ops(), ['Integer', 'LongInt'])).ops();

  console.log(ops.squareNorm([[1,2,3], [4,5,6]]));
}
