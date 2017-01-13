import { affineTransformations } from './types';
const ops = affineTransformations;


const isLinear = op => ops.typeOf(op) == 'Matrix';

const linearPart = op => isLinear(op)
  ? op : ops.linearPart(op);
const shiftPart = op => isLinear(op)
  ? ops.vector(ops.dimension(op)) : ops.shiftPart(op);


const matrixOrder = (M, max) => {
  const I = ops.identityMatrix(ops.dimension(M));
  let A = M;
  for (let i = 1; i <= max; ++i) {
    if (ops.eq(A, I))
      return i;
    A = ops.times(A, M);
  }
  return 0;
};


const rotationAxis = M => {
  const d = ops.dimension(M);

  if (d % 2 != 0 && ops.lt(ops.determinant(M), 0))
    return rotationAxis(ops.negative(M));

  const Z = ops.transposed(ops.nullSpace(ops.minus(M, ops.identityMatrix(d))));

  if (Z.length != 1)
    return null;
  else {
    const v = Z[0];
    return ops.lt(v, ops.vector(d)) ? ops.negative(v) : v;
  }
};


const operatorType = op => {
  const M = linearPart(op);
  const t = shiftPart(op);
  const dimension = ops.dimension(op);
  const direct = ops.ge(ops.determinant(M), 0);
  const order = matrixOrder(M, 6);
  let clockwise = true;

  if (dimension == 2) {
    if (!direct)
      clockwise = false;
    else if (order == 0 || order > 2) {
      const v = [1, 0];
      const vM = ops.times(M, v);
      clockwise = ops.gt(ops.determinant([v, vM]), 0);
    }
  }
  else if (dimension == 3) {
    if (order == 0 || order > 2) {
      const axis = rotationAxis(M);
      if (axis) {
        const v = (ops.eq(0, axis[1]) && ops.eq(0, axis[2]))
          ? [0, 1, 0] : [1, 0, 0];
        const vM = ops.times(M, v);
        clockwise = ops.gt(ops.determinant([axis, v, vM]), 0);
      }
    }
  }

  return { dimension, direct, order, clockwise };
};


if (require.main == module) {
  const test = A => {
    console.log(`A = ${JSON.stringify(A)}`);
    console.log(`  axis     : ${JSON.stringify(rotationAxis(A))}`);

    const type = operatorType(A);
    console.log(`  dimension: ${type.dimension}`);
    console.log(`  order    : ${type.order}`);
    console.log(`  direct   : ${type.direct}`);
    console.log(`  clockwise: ${type.clockwise}`);
    console.log();
  }

  test([[1, 0], [0, 1]]);
  test([[1, 0], [0, -1]]);
  test([[0, -1], [1, 0]]);
  test([[0, 1], [-1, 0]]);
  test([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  test([[0, 0, 1], [1, 0, 0], [0, 1, 0]]);
  test([[0, 1, 0], [0, 0, 1], [1, 0, 0]]);
  test([[0, 0, -1], [-1, 0, 0], [0, -1, 0]]);
}
