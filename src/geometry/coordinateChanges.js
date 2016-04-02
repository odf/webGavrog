export function methods(transformationOps) {

  const V = transformationOps;


  class CoordinateChange {
    constructor(oldToNew, newToOld = V.inverse(oldToNew)) {
      this.oldToNew = oldToNew;
      this.newToOld = newToOld;
    }

    toString() {
      return `CoordinateChange(${this.oldToNew})`;
    }

    get __typeName() { return 'CoordinateChange'; }
  };


  const applyToOp = (chg, op) =>
    V.times(chg.oldToNew, V.times(op, chg.newToOld))


  const methods = {
    dimension: {
      CoordinateChange: C => V.dimension(C.oldToNew)
    },

    coordinateChange: {
      Matrix: M => new CoordinateChange(M),
      AffineTransformation: T => new CoordinateChange(T)
    },

    inverse: {
      CoordinateChange: C => new CoordinateChange(T.newToOld, T.oldToNew)
    },

    times: {
      CoordinateChange: {
        Point : (C, p) => V.times(C.oldToNew, p),
        Vector: (C, v) => V.times(C.oldToNew, v),
        Matrix: applyToOp,
        AffineTransformation: applyToOp
      }
    }
  };

  return methods;
};
