const matrices = require('../arithmetic/types').matrices;

export const points = require('./points')
  .extend(matrices, ['Integer', 'LongInt', 'Fraction', 'Float']);

export const affineTransformations = require('./affineTransformations')
  .extend(points);

export const coordinateChanges = require('./coordinateChanges')
  .extend(affineTransformations);


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const ops = coordinateChanges;

  const t = ops.times(ops.shift([1,1,1]), [[1,1,0],[1,2,0],[0,0,1]]);

  console.log(`${ops.div(ops.plus(ops.origin(3), [1,2,3]), ops.div(3, 2))}`);
  console.log(`${ops.minus(ops.point([2,4,0]), ops.point([0,1,1]))}`);
  console.log(`${ops.minus(ops.point([2,4,0]), [0,1,1])}`);
  console.log(`${ops.times([[1,2],[3,4]], ops.point([1,2]))}`);
  console.log(`${t}`);
  console.log(`${ops.times(t, ops.inverse(t))}`);
  console.log(`${ops.times(t, ops.point([1,2,3]))}`);
  console.log(`${ops.times(t, [1,2,3])}`);
  console.log(`${ops.inverse(t)}`);
  console.log(`${ops.times(ops.inverse(t), ops.point([4,6,4]))}`);
  console.log(`${ops.times(ops.inverse(t), [3,5,3])}`);
  console.log(`${ops.inverse(ops.shift([1,2,3]))}`);
  console.log(`${ops.inverse(ops.shift([1.1,2,3]))}`);

  console.log(`${
    ops.times(
      ops.coordinateChange(ops.times(3, ops.identityMatrix(3))),
      ops.shift([1,2,3]))
  }`);

  const testRepr = x => {
    const xr = ops.repr(x);
    console.log();
    console.log(JSON.stringify(xr));
    console.log(JSON.stringify(ops.fromRepr(xr)));
  };

  testRepr(ops.point(ops.div([1, 2, 3], 3)));
  testRepr(t);
  testRepr(ops.coordinateChange(t));
}
