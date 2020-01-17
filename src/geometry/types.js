import {
  rationalLinearAlgebra,
  numericalLinearAlgebra
} from '../arithmetic/types';


export const pointsQ = require('./points')
  .extend(rationalLinearAlgebra, ['Integer', 'LongInt', 'Fraction']);

export const affineTransformationsQ = require('./affineTransformations')
  .extend(pointsQ);

export const coordinateChangesQ = require('./coordinateChanges')
  .extend(affineTransformationsQ);


export const pointsF = require('./points')
  .extend(numericalLinearAlgebra, ['Integer', 'Float']);

export const affineTransformationsF = require('./affineTransformations')
  .extend(pointsF);

export const coordinateChangesF = require('./coordinateChanges')
  .extend(affineTransformationsF);


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const ops = coordinateChangesF;

  const t = ops.times(ops.shift([1,1,1]), [[1,1,0],[1,2,0],[0,0,1]]);

  //console.log(`${ops.div(ops.plus(ops.origin(3), [1,2,3]), ops.div(3, 2))}`);
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
}
