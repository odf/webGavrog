import { numericalLinearAlgebra } from '../arithmetic/types';


export const lattices = (ops, eps=0, dot=ops.times) => {
  const sum = (...args) => args.reduce((a, b) => ops.plus(a, b));
  const abs = v => ops.sgn(v) < 0 ? ops.negative(v) : v;
  const cmp = (v, w) => ops.cmp(v, w);


  const gaussReduced = (u, v) => {
    const vs = [u, v];
    const norm = v => dot(v, v);

    while (true) {
      const [i, j] = ops.lt(norm(vs[0]), norm(vs[1])) ? [0, 1] : [1, 0];
      const t = ops.round(ops.div(dot(vs[0], vs[1]), norm(vs[i])));
      vs[j] = ops.minus(vs[j], ops.times(t, vs[i]));
      if (ops.ge(norm(vs[j]), ops.times(norm(vs[i]), 1-eps)))
        break;
    }

    if (ops.gt(dot(vs[0], vs[1]), 0))
      vs[1] = ops.negative(vs[1]);

    return vs;
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


  const compareVectors = (v, w) =>
        ops.sgn(ops.minus(dot(v, v), dot(w, w))) || cmp(abs(w), abs(v));


  const reducedLatticeBasis = vs => {
    const dim = vs[0].length;
    const tmp = dirichletVectors(vs, dot).sort(compareVectors);
    const A = [];

    const _normalized = v => {
      let t = v.map(x => Math.abs(x) < eps ? 0 : x);
      if (ops.sgn(t) < 0)
        t = ops.negative(t);
      if (A.length > 0 && ops.gt(dot(A[0], t), 0))
        t = ops.negative(t);
      return t;
    };

    for (let k = 0, i = 0; k < tmp.length && i < dim; ++k) {
      A[i] = _normalized(tmp[k]);
      if (ops.rank(A) > i)
        ++i;
    }

    return A;
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
