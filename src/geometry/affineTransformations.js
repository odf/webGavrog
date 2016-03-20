export function methods(pointAndVectorOps, scalarTypes) {

  const V = pointAndVectorOps;

  const scalarToString = x => x.toString();
  const vectorToString = v => '[' + v.map(scalarToString).join(', ') + ']';


  class AffineTransformation {
    constructor(linear, shift = V.vector(V.shape(linear)[0])) {
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


  const I = n => V.identityMatrix(n);

  const compose = (t1, t2) => new AffineTransformation(
    V.times(t1.linear, t2.linear),
    V.plus(t1.shift, V.times(t1.linear, t2.shift))
  );

  const inverse = t => {
    const A = V.inverse(t.linear);
    if (A != null)
      return new AffineTransformation(A, V.negative(V.times(A, t.shift)));
  };

  const applyToPoint = (t, p) =>
    V.point(V.plus(V.times(t.linear, V.vector(p)), t.shift));


  const methods = {
    dimension: {
      AffineTransformation: t => V.shape(t.linear)[0]
    },

    affineTransformation: {
      Matrix: {
        Vector: (A, t) => new AffineTransformation(A, t)
      },
      Vector : v => new AffineTransformation(I(v.length), v),
      Integer: n => new AffineTransformation(I(n))
    },

    identityTransformation: {
      Integer: n => new AffineTransformation(I(n))
    },

    shift: {
      Vector : v => new AffineTransformation(I(v.length), v)
    },

    inverse: {
      AffineTransformation: inverse
    },

    times: {
      AffineTransformation: {
        AffineTransformation: compose,
        Matrix: (T, M) => compose(T, new AffineTransformation(M)),
        Point: applyToPoint,
        Vector: (t, v) => V.times(t.linear, v)
      },
      Matrix: {
        AffineTransformation: (M, T) => compose(new AffineTransformation(M), T)
      }
    }
  };

  return methods;
};
