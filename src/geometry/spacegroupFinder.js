import { affineTransformationsQ } from './types';
import { reducedLatticeBasis } from './lattices';
const V = affineTransformationsQ;


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


const operator = s => {
  const parts = s.replace(/\s+/g, '').split(',');
  const d = parts.length;

  if (d > 3)
    throw new Error('only up to 3 coordinates are recognized');

  const M = ops.matrix(d, d);
  const v = ops.vector(d);

  for (let i = 0; i < d; ++i) {
    for (const term of parts[i].split(/(?=[+-])/)) {
      const [matched, sign, coeff, axis] =
            term.match(/^([+-])?(\d+(?:\/\d+)?)?(?:\*?([xyz]))?$/) || [];

      if (!matched)
        throw new Error(`illegal term ${term} in coordinate ${i}`);

      let val;
      if (coeff)
        val = ops.rational(coeff);
      else
        val = 1;
      if (sign == '-')
        val = ops.negative(val);

      if (axis) {
        const j = 'xyz'.indexOf(axis);
        if (j >= d)
          throw new Error(`no ${axis}-axis in ${d}-dimensional operator`);
        M[i][j] = ops.plus(M[i][j], val);
      }
      else
        v[i] = ops.plus(v[i], val);
    }
  }

  return ops.affineTransformation(M, v);
};


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

  const R = V.minus(M, V.identityMatrix(d));
  const Z = V.transposed(V.nullSpace(R) || []);

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


const vectorsOrthogonal = (v, w) => V.eq(0, V.times(v, w));


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


const basisNormalizer = {};


basisNormalizer[CS_0D] =
basisNormalizer[CS_1D] =
basisNormalizer[CS_2D_OBLIQUE] = b => ({ basis: b, centering: 'p' });


basisNormalizer[CS_2D_RECTANGULAR] = b => {
  if (V.ne(0, b[0][0]) && V.ne(0, b[0][1]))
    return {
      basis: [ V.times([[0, 0], [0, 2]], b[0]),
               V.times([[2, 0], [0, 0]], b[0]) ],
      centering: 'c'
    };
  else if (V.ne(0, b[1][0]) && V.ne(0, b[1][1]))
    return {
      basis: [ V.times([[0, 0], [0, 2]], b[1]),
               V.times([[2, 0], [0, 0]], b[1]) ],
      centering: 'c'
    };
  else if (V.eq(0, b[0][1]))
    return { basis: [ b[1], V.negative(b[0]) ], centering: 'p' };
  else
    return { basis: [ b[0], b[1] ], centering: 'p' };
};


basisNormalizer[CS_2D_SQUARE] = b => ({
  basis: [ b[0], V.times([[0, -1], [1, 0]], b[0]) ],
  centering: 'p'
});


basisNormalizer[CS_2D_HEXAGONAL] = b => ({
  basis: [ b[0], V.times([[0, -1], [1, -1]], b[0]) ],
  centering: 'p'
});


basisNormalizer[CS_3D_CUBIC] = b => {
  const r = V.abs(b[0].find(x => V.ne(0, x)));
  const n = b[0].filter(x => V.ne(0, x)).length;

  const [a, c] = (n == 1) ?
    [r, 'P'] :
    [V.times(r, 2), (n == 2) ? 'F' : 'I'];

  return { basis: [[a, 0, 0], [0, a, 0], [0, 0, a]], centering: c };
};


basisNormalizer[CS_3D_HEXAGONAL] = b => {
  const [u, w] = vectorsCollinear([0, 0, 1], b[0]) ?
    [b[2], b[0]] : vectorsCollinear([0, 0, 1], b[1]) ?
    [b[0], b[1]] :
    [b[0], b[2]];

  const v = V.times([[0, -1, 0], [1, -1, 0], [0, 0, 1]], u);

  return { basis: [u, v, w], centering: 'P' };
};


basisNormalizer[CS_3D_TRIGONAL] = b => {
  const basis = vectorsCollinear([0, 0, 1], b[0]) ?
    [b[1], b[2], b[0]] : vectorsCollinear([0, 0, 1], b[1]) ?
    [b[0], b[2], b[1]] :
    [b[0], b[1], b[2]];

  const r =
    basis.find(v => !vectorsCollinear([0, 0, 1], v) && V.ne(0, v[2]));

  if (r) {
    if (V.lt(r[2], 0)) {
      basis[0] = V.times([[2, -1, 0], [1, 1, 0], [0, 0, 0]], r);
      basis[2] = V.times([[0, 0, 0], [0, 0, 0], [0, 0, -3]], r);
    }
    else {
      basis[0] = V.times([[1, 1, 0], [-1, 2, 0], [0, 0, 0]], r);
      basis[2] = V.times([[0, 0, 0], [0, 0, 0], [0, 0, 3]], r);
    }
  }

  basis[1] = V.times([[0, -1, 0], [1, -1, 0], [0, 0, 1]], basis[0]);

  return { basis, centering: r ? 'R' : 'P' };
};


basisNormalizer[CS_3D_TETRAGONAL] = b => {
  const basis = [b[0], b[1], b[2]];
  let centering = 'P';

  if (vectorsCollinear([0, 0, 1], basis[0])) {
    [basis[0], basis[2]] = [basis[1], basis[0]];
    if (!vectorsOrthogonal([0, 0, 1], basis[0])) {
      centering = 'I';
      basis[0] = V.times([[1, -1, 0], [1, 1, 0], [0, 0, 0]], basis[0]);
    } 
  }
  else if (vectorsOrthogonal([0, 0, 1], basis[0])) {
    if (!vectorsOrthogonal([0, 0, 1], basis[1]))
      basis[2] = basis[1];

    if (!vectorsCollinear([0, 0, 1], basis[2])) {
      centering = 'I';
      basis[2] = V.times([[0, 0, 0], [0, 0, 0], [0, 0, 2]], basis[2]);
    }
  }
  else {
    centering = 'I';
    basis[2] = V.times([[0, 0, 0], [0, 0, 0], [0, 0, 2]], basis[0]);
    basis[0] = V.times([[1, -1, 0], [1, 1, 0], [0, 0, 0]], basis[0]);
  }

  basis[1] = V.times([[0, -1, 0], [1, 0, 0], [0, 0, 1]], basis[0]);

  return { basis, centering };
};


basisNormalizer[CS_3D_ORTHORHOMBIC] = basis => {
  const d = basis.map(v => v.filter(x => V.ne(0, x)).length);
  const x = [1, 0, 0];
  const y = [0, 1, 0];
  const z = [0, 0, 1];
  const copy = [basis[0], basis[1], basis[2]];
  const left = [basis[1], basis[2], basis[0]];
  const right = [basis[2], basis[0], basis[1]];

  let v;
  if (d[0] == 3)
    v = copy;
  else if (d[1] == 3)
    v = left;
  else if (d[2] == 3)
    v = right;
  else if (d[0] == 2 && vectorsOrthogonal(z, basis[0]))
    v = copy;
  else if (d[1] == 2 && vectorsOrthogonal(z, basis[1]))
    v = left;
  else if (d[2] == 2 && vectorsOrthogonal(z, basis[2]))
    v = right;
  else if (d[0] == 2 && vectorsOrthogonal(y, basis[0]))
    v = copy;
  else if (d[1] == 2 && vectorsOrthogonal(y, basis[1]))
    v = left;
  else if (d[2] == 2 && vectorsOrthogonal(y, basis[2]))
    v = right;
  else if (vectorsCollinear(x, basis[0]))
    v = copy;
  else if (vectorsCollinear(x, basis[1]))
    v = left;
  else if (vectorsCollinear(x, basis[2]))
    v = right;
  else
    v = copy;

  const n = v[0].filter(x => V.ne(0, x)).length;

  let a, b, c, centering;
  if (n == 3) {
    [a, b, c] = V.times(2, v[0]);
    centering = 'I';
  }
  else if (n == 2) {
    const p = v.findIndex(x => V.eq(0, x));
    const v1p = V.abs(v[1][p]);
    const v2p = V.abs(v[2][p]);

    let m;
    if (V.eq(0, v2p) || (V.ne(0, v1p) && V.gt(v2p, v1p))) {
      [v[1], v[2]] = [v[2], v[1]];
      m = d[1];
    }
    else
      m = d[2];

    if (p == 1) {
      a = V.times(v[0][0], 2);
      b = V.times(v[2][1], m);
      c = V.times(v[0][2], 2);
      centering = m == 2 ? 'F' : 'B';
    }
    else {
      a = V.times(v[0][0], 2);
      b = V.times(v[0][1], 2);
      c = V.times(v[2][2], m);
      centering = m == 2 ? 'F' : 'C';
    }
  }
  else {
    const v11 = V.abs(v[1][1]);
    const v21 = V.abs(v[2][1]);

    let m;
    if (V.eq(0, v11) || (V.ne(0, v21) && V.gt(v11, v21))) {
      [v[1], v[2]] = [v[2], v[1]];
      m = d[2];
    }
    else
      m = d[1];

    a = v[0][0];
    if (m == 2) {
      [_, b, c] = V.times(v[1], 2);
      centering = 'A';
    }
    else {
      if (!V.ne(0, v[1][1])) {
        b = v[1][1];
        c = v[2][2];
      }
      else {
        b = v[2][1];
        c = v[1][2];
      }
    }
    centering = 'P';
  }

  if (centering == 'A')
    return { basis: [[0, b, 0], [0, 0, c], [a, 0, 0]], centering: 'C' };
  else if (centering == 'B')
    return { basis: [[0, 0, c], [a, 0, 0], [0, b, 0]], centering: 'C' };
  else
    return { basis: [[a, 0, 0], [0, b, 0], [0, 0, c]], centering };
};


basisNormalizer[CS_3D_MONOCLINIC] = b => {
  const z = [0, 0, 1];
  let centering, v;

  if (vectorsCollinear(z, b[0]))
    v = [b[1], b[2], b[0]];
  else if (vectorsCollinear(z, b[1]))
    v = [b[0], V.times(-1, b[2]), b[1]];
  else
    v = [b[0], b[1], b[2]];

  if (vectorsOrthogonal(z, v[1]))
    v = [V.times(-1, v[1]), v[0], v[2]];
  else
    v = [v[2], v[0], v[1]];

  if (!vectorsOrthogonal(z, v[0]))
      v[0] = V.times([[1, 0, 0], [0, 1, 0], [0, 0, 0]], V.plus(v[0], v[1]));

  if (!vectorsCollinear(z, v[2])) {
    if (vectorsOrthogonal(z, v[1])) {
      if (vectorsCollinear(
        v[0], V.times([[2, 0, 0], [0, 2, 0], [0, 0, 0]], v[2])))
      {
        v[0] = v[1];
      }
      v[1] = v[2];
    }
    v[2] = V.times([[0, 0, 0], [0, 0, 0], [0, 0, 2]], v[2]);
  }

  if (!vectorsOrthogonal(z, v[1])) {
    v[1] = V.times([[2, 0, 0], [0, 2, 0], [0, 0, 0]], v[1]);
    centering = 'A';
  }
  else
    centering = 'P';

  return { basis: v, centering };
};


basisNormalizer[CS_3D_TRICLINIC] = b => ({ basis: b, centering: 'P' });


const normalizedBasis = (crystalSystem, basis) => {
  const reduced = reducedLatticeBasis(basis);
  const normalized = basisNormalizer[crystalSystem](reduced);

  if (V.le(V.determinant(normalized), 0)) {
    const n = normalized.length;
    normalized[n - 1] = V.negative(normalized[n - 1]);
  }

  return normalized;
};


const variations = (crystalSystem, centering) => {
  if (crystalSystem == CS_3D_MONOCLINIC) {
    if (centering == 'A')
      return [ "x,y,z", "-x,y-x,-z" ].map(operator);
    else
      return [ "x,y,z", "-y,x-y,z", "y-x,-x,z" ].map(operator);
  }
  else if (crystalSystem == CS_3D_ORTHORHOMBIC) {
    if (centering == 'C')
      return [ "x,y,z", "y,x,-z" ].map(operator);
    else
      return [
        "x,y,z", "z,x,y", "y,z,x", "y,x,-z", "x,z,-y", "z,y,-x"
      ].map(operator);
  }
  else if (crystalSystem == CS_3D_TRIGONAL) {
    if (centering == 'P')
      return [ "x,y,z", "x-y,x,z" ].map(operator);
    else
      return [ "x,y,z" ].map(operator);
  }
  else if (crystalSystem == CS_3D_CUBIC)
    return [ "x,y,z", "-y,x,z" ].map(operator);
  else if (crystalSystem == CS_3D_HEXAGONAL ||
           crystalSystem == CS_3D_TETRAGONAL)
    return [ "x,y,z" ].map(operator);
  else if (crystalSystem == CS_2D_RECTANGULAR)
    return [ "x,y", "y,-x" ].map(operator);
  else
    return [ "x,y" ].map(operator);
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
