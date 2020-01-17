import * as pickler from '../common/pickler';

export const extend = pointAndVectorOps => {

  const V = pointAndVectorOps;

  const scalarToString = x => x.toString();
  const vectorToString = v => '[' + v.map(scalarToString).join(', ') + ']';


  class AffineTransformation {
    constructor(linear, shift) {
      const [n, m] = V.shape(linear);
      if (n != m || n != shift.length)
        throw new Error('size mismatch');

      this.linear = linear;
      this.shift  = shift;
    }

    toString() {
      const coordsLin = '[' + this.linear.map(vectorToString).join(', ') + ']';
      const coordsShift = vectorToString(this.shift);

      return `AffineTransformation(${coordsLin}, ${coordsShift})`;
    }

    get __typeName() { return 'AffineTransformation'; }
  };


  pickler.register(
    'AffineTransformation',
    ({ linear, shift }) =>
      ({ linear: pickler.pickle(linear), shift: pickler.pickle(shift) }),
    ({ linear, shift }) =>
      new AffineTransformation(
        pickler.unpickle(linear), pickler.unpickle(shift)
      )
  );


  const I = n => V.identityMatrix(n);


  const make = (linear, shift) => {
    if (shift == null || V.sgn(shift) == 0)
      return linear;
    else
      return new AffineTransformation(linear, shift);
  };


  const compose = (t1, t2) => make(
    V.times(t1.linear, t2.linear),
    V.plus(t1.shift, V.times(t1.linear, t2.shift))
  );

  const inverse = t => {
    const A = V.inverse(t.linear);
    if (A != null)
      return make(A, V.negative(V.times(A, t.shift)));
  };

  const applyToPoint = (t, p) =>
    V.point(V.plus(V.times(t.linear, V.vector(p)), t.shift));

  const compare = (m1, s1, m2, s2) => V.cmp(m1, m2) || V.cmp(s1, s2);


  const methods = {
    __context__: () =>
      `affineTransformations(${pointAndVectorOps.__context__()})`,

    dimension: {
      AffineTransformation: t => t.shift.length
    },

    linearPart: {
      AffineTransformation: t => t.linear,
      Matrix: m => m
    },

    shiftPart: {
      AffineTransformation: t => t.shift,
      Matrix: m => V.vector(m.length)
    },

    affineTransformation: {
      Matrix: {
        Vector: (A, t) => make(A, t)
      }
    },

    shift: {
      Vector : v => make(I(v.length), v)
    },

    inverse: {
      AffineTransformation: inverse
    },

    times: {
      AffineTransformation: {
        AffineTransformation: compose,
        Matrix: (T, M) => make(V.times(T.linear, M), T.shift),
        Point : applyToPoint,
        Vector: (t, v) => V.times(t.linear, v)
      },
      Matrix: {
        AffineTransformation: (M, T) =>
          make(V.times(M, T.linear), V.times(M, T.shift))
      }
    },

    cmp: {
      AffineTransformation: {
        AffineTransformation: (S, T) =>
          compare(S.linear, S.shift, T.linear, T.shift),

        Matrix: (S, M) =>
          compare(S.linear, S.shift, M, V.vector(M.length))
      },
      Matrix: {
        AffineTransformation: (M, T) =>
          compare(M, V.vector(M.length), T.linear, T.shift)
      }
    }
  };

  return V.register(methods);
};
