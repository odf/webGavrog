import { affineTransformations } from './types';
const V = affineTransformations;


const CS_0D              = "Crystal System 0d";
const CS_1D              = "Crystal System 1d";

const CS_2D_OBLIQUE      = "Crystal System 2d Oblique";
const CS_2D_RECTANGULAR  = "Crystal System 2d Rectangular";
const CS_2D_SQUARE       = "Crystal System 2d Square";
const CS_2D_HEXAGONAL    = "Crystal System 2d Hexagonal";

const CS_3D_CUBIC        = "Crystal System 3d Cubic";
const CS_3D_ORTHORHOMBIC = "Crystal System 3d Orthorhombic";
const CS_3D_HEXAGONAL    = "Crystal System 3d Hexagonal";
const CS_3D_TETRAGONAL   = "Crystal System 3d Tetragonal";
const CS_3D_TRIGONAL     = "Crystal System 3d Trigonal";
const CS_3D_MONOCLINIC   = "Crystal System 3d Monoclinic";
const CS_3D_TRICLINIC    = "Crystal System 3d Triclinic";


const matrixOrder = (M, max) => {
  const I = V.identityMatrix(V.dimension(M));
  let A = M;
  for (let i = 1; i <= max; ++i) {
    if (V.eq(A, I))
      return i;
    A = V.times(A, M);
  }
  return 0;
};


const detSgn = M => V.sgn(V.determinant(M));


const operatorAxis = op => {
  const d = V.dimension(op);

  let M = V.linearPart(op);
  if (d % 2 != 0 && detSgn(M) < 0)
    M = V.negative(M);

  const Z = V.transposed(V.nullSpace(V.minus(M, V.identityMatrix(d))));

  if (Z.length != 1)
    return null;
  else {
    const v = Z[0];
    return V.lt(v, V.vector(d)) ? V.negative(v) : v;
  }
};


const vectorsCollinear = (v, w) =>
  V.eq(V.times(V.times(v, w), V.times(v, w)),
       V.abs(V.times(V.times(v, v), V.times(w, w))));


const operatorType = op => {
  const dimension = V.dimension(op);
  const A = V.linearPart(op);
  const direct = detSgn(A) >= 0;
  const M = (dimension % 2 == 1 && !direct) ? V.negative(A) : A;
  const t = V.shiftPart(op);
  const order = matrixOrder(M, 6);

  let clockwise = true;

  if (dimension == 2) {
    if (!direct)
      clockwise = false;
    else if (order == 0 || order > 2) {
      const v = [1, 0];
      const vM = V.times(M, v);
      clockwise = detSgn([v, vM]) >= 0;
    }
  }
  else if (dimension == 3) {
    if (order == 0 || order > 2) {
      const a = operatorAxis(M);
      if (a) {
        const v = (V.eq(0, a[1]) && V.eq(0, a[2])) ? [0, 1, 0] : [1, 0, 0];
        const vM = V.times(M, v);
        clockwise = detSgn([a, v, vM]) >= 0;
      }
    }
  }

  return { dimension, direct, order, clockwise };
};


const crystalSystemAndBasis2d = ops => {
  const opsWithTypes = ops.map(op => Object.assign(operatorType(op), { op }));
  const mirrors = opsWithTypes.filter(op => !op.direct);
  const spin = opsWithTypes
    .filter(op => op.direct && op.clockwise)
    .reduce((op1, op2) => op2.order > op1.order ? op2 : op1);

  const n = spin.order;
  const R = V.linearPart(spin.op);

  let crystalSystem;

  if (n == 6)
    crystalSystem = CS_2D_HEXAGONAL;
  else if (n == 4)
    crystalSystem = CS_2D_SQUARE;
  else if (n == 3)
    crystalSystem = CS_2D_HEXAGONAL;
  else if (mirrors.length)
    crystalSystem = CS_2D_RECTANGULAR;
  else
    crystalSystem = CS_2D_OBLIQUE;

  const x = mirrors.length ? operatorAxis(mirrors[0].op) : [1, 0];
  let y;

  if (n >= 3)
    y = n == 6 ? V.times(R, V.times(R, x)) : V.times(R, x);
  else if (mirrors.length > 1)
    y = operatorAxis(mirrors[1].op);
  else {
    const t = x[0] == 0 ? [1, 0] : [0, 1];
    y = mirrors.length ? V.minus(t, V.times(mirrors[0].op, t)) : t;
  }

  const basis = detSgn([x, y]) < 0 ? [x, V.negative(y)] : [x, y];

  return { crystalSystem, basis };
};


const isIn = (val, expected) =>
  expected.constructor == Array ? expected.indexOf(val) >= 0 : val == expected;


const crystalSystemAndBasis3d = ops => {
  const opsWithTypes = ops.map(op => Object.assign(operatorType(op), { op }));
  const ofType = (order, direct, clockwise) => opsWithTypes.filter(op => (
    isIn(op.order, order)
      && isIn(op.direct, direct)
      && isIn(op.clockwise, clockwise)));

  const mirrors    = ofType([2, 3, 4, 6], false, true);
  const inversions = ofType(1, false, true);
  const directGood = inversions.length ? true : [true, false];

  const twoFold    = ofType(2, directGood, true);
  const threeFold  = ofType(3, true, true);
  const fourFold   = ofType(4, directGood, true);
  const sixFold    = ofType(6, directGood, true);

  let crystalSystem, x, y, z, R;

  if (sixFold.length > 0) {
    const A = V.linearPart(sixFold[0].op)
    crystalSystem = CS_3D_HEXAGONAL;
    z = operatorAxis(A);
    R = V.times(A, A);
  }
  else if (fourFold.length > 1) {
    crystalSystem = CS_3D_CUBIC;
    z = operatorAxis(fourFold[0].op);
    R = V.linearPart(threeFold[0].op);
    x = V.times(R, z);
    y = V.times(R, x);
  }
  else if (fourFold.length > 0) {
    crystalSystem = CS_3D_TETRAGONAL;
    R = V.linearPart(fourFold[0].op);
    z = operatorAxis(R);
  }
  else if (threeFold.length > 1) {
    crystalSystem = CS_3D_CUBIC;
    z = operatorAxis(twoFold[0].op);
    R = V.linearPart(threeFold[0].op);
    x = V.times(R, z);
    y = V.times(R, x);
  }
  else if (threeFold.length > 0) {
    crystalSystem = CS_3D_TRIGONAL;
    R = V.linearPart(threeFold[0].op);
    z = operatorAxis(R);
  }
  else if (twoFold.length > 1) {
    crystalSystem = CS_3D_ORTHORHOMBIC;
    x = operatorAxis(twoFold[0].op);
    y = operatorAxis(twoFold[1].op);
    z = operatorAxis(twoFold[2].op);
  }
  else if (twoFold.length > 0) {
    crystalSystem = CS_3D_MONOCLINIC;
    z = operatorAxis(twoFold[0].op);
  }
  else {
    crystalSystem = CS_3D_TRICLINIC;
    z = [0, 0, 1];
  }

  if (x == null) {
    for (const { op } of twoFold) {
      const t = operatorAxis(op);
      if (!vectorsCollinear(z, t)) {
        x = t;
        break;
      }
    }
  }

  if (x == null) {
    x = vectorsCollinear(z, [1, 0, 0]) ? [0, 1, 0] : [1, 0, 0];
    if (mirrors.length > 0)
      x = V.plus(x, V.times(V.linearPart(mirrors[0].op), x));
    else if (twoFold.length > 0)
      x = V.minus(x, V.times(V.linearPart(twoFold[0].op), x));
    else if (crystalSystem == CS_3D_TRIGONAL)
      x = V.minus(x, V.times(R, x));
  }

  if (y == null) {
    if (R != null)
      y = V.times(R, x);
    else {
      y = V.crossProduct(z, x);
      if (mirrors.length > 0)
        y = V.plus(y, V.times(V.linearPart(mirrors[0].op), y));
      else if (twoFold.length > 0)
        y = V.minus(y, V.times(V.linearPart(twoFold[0].op), y));
    }
  }

  const basis = detSgn([x, y, z]) < 0 ? [x, y, V.negative(z)] : [x, y, z];

  return { crystalSystem, basis };
};


if (require.main == module) {
  const testOp = A => {
    console.log(`A = ${JSON.stringify(A)}`);
    console.log(`  axis     : ${JSON.stringify(operatorAxis(A))}`);

    const { dimension, order, direct, clockwise } = operatorType(A);
    console.log(`  dimension: ${dimension}`);
    console.log(`  order    : ${order}`);
    console.log(`  direct   : ${direct}`);
    console.log(`  clockwise: ${clockwise}`);
    console.log();
  };

  const testGroup2d = ops => {
    console.log(`ops = ${JSON.stringify(ops)}`);
    const { crystalSystem, basis } = crystalSystemAndBasis2d(ops);
    console.log(`  ${crystalSystem}`);
    console.log(`  basis: ${ JSON.stringify(basis) }`);
    console.log();
  };

  const testGroup3d = ops => {
    console.log(`ops = ${JSON.stringify(ops)}`);
    const { crystalSystem, basis } = crystalSystemAndBasis3d(ops);
    console.log(`  ${crystalSystem}`);
    console.log(`  basis: ${ JSON.stringify(basis) }`);
    console.log();
  };

  testOp([[1, 0], [0, 1]]);
  testOp([[1, 0], [0, -1]]);
  testOp([[0, -1], [1, 0]]);
  testOp([[0, 1], [-1, 0]]);
  testOp([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  testOp([[-1, 0, 0], [0, -1, 0], [0, 0, -1]]);
  testOp([[0, 0, 1], [1, 0, 0], [0, 1, 0]]);
  testOp([[0, 1, 0], [0, 0, 1], [1, 0, 0]]);
  testOp([[0, 0, -1], [-1, 0, 0], [0, -1, 0]]);
  testOp([[0, -1, 0], [0, 0, -1], [-1, 0, 0]]);

  testGroup2d([V.affineTransformation([[1, 0], [0, 1]], [1, 0])]);

  testGroup2d([[[ 1, 0], [0,  1]],
               V.affineTransformation([[-1, 0], [0, -1]], [1, 0])]);

  testGroup2d([[[ 1, 0], [0,  1]],
               [[ 1, 0], [0, -1]]]);

  testGroup2d([[[ 1, 0], [0,  1]],
               [[ 1, 0], [0, -1]],
               [[-1, 0], [0,  1]],
               [[-1, 0], [0, -1]]]);

  testGroup2d([[[ 1,  0], [ 0,  1]],
               [[ 0, -1], [ 1,  0]],
               [[-1,  0], [ 0, -1]],
               [[ 0,  1], [-1,  0]]]);

  testGroup2d([[[ 1,  0], [ 0,  1]],
               [[ 0, -1], [ 1, -1]],
               [[-1,  0], [-1,  1]]]);

  testGroup2d([[[ 1,  0], [ 0,  1]],
               [[ 1, -1], [ 1,  0]],
               [[ 0, -1], [ 1, -1]],
               [[-1,  0], [ 0, -1]],
               [[-1,  1], [-1,  0]],
               [[ 0,  1], [-1,  1]]]);

  testGroup3d([[[ 1, 0, 0], [0,  1, 0], [0, 0,  1]],
               [[-1, 0, 0], [0, -1, 0], [0, 0, -1]]]);

  testGroup3d([[[1, 0, 0], [0, 1, 0], [0, 0,  1]],
               [[1, 0, 0], [0, 1, 0], [0, 0, -1]]]);

  testGroup3d([[[1, 0, 0], [0,  1, 0], [0, 0,  1]],
               [[1, 0, 0], [0,  1, 0], [0, 0, -1]],
               [[1, 0, 0], [0, -1, 0], [0, 0,  1]],
               [[1, 0, 0], [0, -1, 0], [0, 0, -1]]]);

  testGroup3d([[[1, 0, 0], [0, 1, 0], [0, 0, 1]],
               [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
               [[0, 0, 1], [1, 0, 0], [0, 1, 0]]]);

  testGroup3d([[[ 1,  0, 0], [ 0,  1, 0], [0, 0, 1]],
               [[ 0, -1, 0], [ 1,  0, 0], [0, 0, 1]],
               [[-1,  0, 0], [ 0, -1, 0], [0, 0, 1]],
               [[ 0,  1, 0], [-1,  0, 0], [0, 0, 1]]]);
}
