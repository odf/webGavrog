import { numericalLinearAlgebra } from '../arithmetic/types';


export const lattices = (ops, eps=0, dot=ops.times) => {
  const sum = (u, v, w) => w ? ops.plus(ops.plus(u, v), w) : ops.plus(u, v);
  const abs = v => ops.sgn(v) < 0 ? ops.negative(v) : v;


  const gaussReduced = (u, v) => {
    const norm = v => dot(v, v);
    if (ops.lt(norm(v), norm(u)))
      [u, v] = [v, u];

    while (ops.lt(norm(u), ops.times(norm(v), 1 - eps))) {
      const t = ops.round(ops.div(dot(u, v), norm(u)));
      [u, v] = [ops.minus(v, ops.times(t, u)), u];
    }

    if (ops.gt(dot(u, v), 0))
      v = ops.negative(v);

    return [u, v];
  };


  const sellingReduced = (u, v, w) => {
    const vs = [u, v, w, ops.negative(sum(u, v, w))];
    let changed;

    do {
      changed = false;

      for (let i = 0; i < 3; ++i) {
        for (let j = i+1; j < 4; ++j) {
	  if (ops.gt(dot(vs[i], vs[j]), eps)) {
	    for (let k = 0; k < 4; ++k) {
	      if (k != i && k != j) {
	        vs[k] = sum(vs[k], vs[i]);
	      }
	    }
	    vs[i] = ops.negative(vs[i]);
	    changed = true;
	  }
        }
      }
    } while (changed);

    return vs.slice(0, 3);
  };


  const dirichletVectors = basis => {
    switch (basis.length) {
    case 0:
    case 1:
      return basis;
    case 2: {
      const vs = gaussReduced(...basis);
      return [vs[0], vs[1], sum(vs[0], vs[1])];
    }
    case 3: {
      const vs = sellingReduced(...basis);
      return [
        vs[0], vs[1], vs[2],
        sum(vs[0], vs[1]), sum(vs[0], vs[2]), sum(vs[1], vs[2]),
        sum(vs[0], vs[1], vs[2])
      ]
    }
    }
  };


  const reducedLatticeBasis = vs => {
    const cmp = (v, w) => (
      ops.cmp(dot(v, v), dot(w, w)) || ops.cmp(abs(w), abs(v))
    );
    const dim = vs[0].length;
    const A = [];
    let i = 0;

    for (const v of dirichletVectors(vs, dot).sort(cmp)) {
      const t = abs(v.map(x => Math.abs(x) < eps ? 0 : x));
      A[i] = (A[0] && ops.gt(dot(A[0], t), 0)) ? ops.negative(t) : t;

      if (ops.rank(A) > i) {
        ++i;
        if (i >= dim)
          return A;
      }
    }
  };


  const shiftIntoDirichletDomain = (pos, dVecs) => {
    let s = ops.times(0, pos);
    let changed;

    do {
      changed = false;

      for (const v of dVecs) {
        const t = ops.div(dot(ops.plus(pos, s), v), dot(v, v));
        if (t < -0.5 || t > 0.5+eps) {
          s = ops.minus(s, ops.times(ops.round(t), v));
          changed = true;
        }
      }
    } while (changed);

    return s;
  };


  return { dirichletVectors, reducedLatticeBasis, shiftIntoDirichletDomain };
};


export const {
  dirichletVectors,
  reducedLatticeBasis,
  shiftIntoDirichletDomain
} =
  lattices(numericalLinearAlgebra, Math.pow(2, -40));


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  console.log(`${reducedLatticeBasis([[16,3], [5,1]])}`);
  console.log(`${reducedLatticeBasis([[1,0,0], [1,1,0], [1,1,1]])}`);

  console.log(shiftIntoDirichletDomain([3.2, -1.4], [[1,0],[0,1],[1,1]]));
}
