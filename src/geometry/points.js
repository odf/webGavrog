export function methods(vectorOps, scalarTypes) {

  const V = vectorOps;


  class Point {
    constructor(coords) {
      this.coords = coords;
    }

    toString() {
      return 'Point(' + this.coords.map(x => x.toString()).join(', ') + ')';
    }

    get __typeName() { return 'Point'; }
  };


  const array = n => Array(n).fill(0);

  const methods = {
    origin: {
      Integer: n => new Point(array(n))
    },

    point: {
      Vector: v => new Point(v)
    },

    vector: {
      Point: p => p.coords
    },

    dimension: {
      Point: p => p.coords.length
    },

    negative: {
      Point: p => new Point(V.negative(p.coords))
    },

    plus: {
      Vector: {
        Point: (v, p) => new Point(V.plus(v, p.coords))
      },
      Point: {
        Vector: (p, v) => new Point(V.plus(p.coords, v))
      }
    },

    minus: {
      Point: {
        Vector: (p, v) => new Point(V.minus(p.coords, v)),
        Point: (p, q) => V.minus(p.coords, q.coords)
      }
    },
  };

  for (const name of ['times', 'div']) {
    methods[name] = { Point: {} };
    for (const sType of scalarTypes) {
      methods[name]['Point'][sType] =
        (p, x) => new Point(V[name](p.coords, x));
    }
  }

  for (const sType of scalarTypes) {
    methods.times[sType] = {
      Point: (x, p) => new Point(V[name](x, p.coords))
    }
  }

  return methods;
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const base = require('../arithmetic/base');
  const vops = require('../arithmetic/types').matrices;

  const a = base.arithmetic();
  a.register(methods(vops, ['Integer', 'LongInt', 'Fraction']));

  const pops = a.ops();

  console.log(`${pops.div(pops.plus(pops.origin(3), [1,2,3]), 3)}`);
  console.log(`${pops.minus(pops.point([2,4,0]), pops.point([0,1,1]))}`);
  console.log(`${pops.minus(pops.point([2,4,0]), [0,1,1])}`);
}
