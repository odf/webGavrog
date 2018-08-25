export const extend = transformationOps => {

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
    __context__: () => `coordinateChanges(${transformationOps.__context__()})`,

    dimension: {
      CoordinateChange: C => V.dimension(C.oldToNew)
    },

    coordinateChange: {
      Matrix: M => new CoordinateChange(M),
      AffineTransformation: T => new CoordinateChange(T)
    },

    inverse: {
      CoordinateChange: C => new CoordinateChange(C.newToOld, C.oldToNew)
    },

    times: {
      CoordinateChange: {
        Point : (C, p) => V.times(C.oldToNew, p),
        Vector: (C, v) => V.times(C.oldToNew, v),
        Matrix: applyToOp,
        AffineTransformation: applyToOp,
        CoordinateChange: (C, D) => new CoordinateChange(
          V.times(C.oldToNew, D.oldToNew), V.times(D.newToOld, C.newToOld))
      }
    }
  };

  return V.register(methods);
};
