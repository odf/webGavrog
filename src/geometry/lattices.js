import { floatMatrices } from '../arithmetic/types';

const ops = floatMatrices;
const eps = Math.pow(2, -50);

const trim = x => Math.abs(x) < eps ? 0 : x;
const lift = op => (...args) => args.reduce((a, b) => op(a, b));
const sum  = lift(ops.plus);


const gaussReduced = (u, v, dot = ops.times) => {
  const vs   = [u, v];
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


const sellingReduced = (u, v, w, dot = ops.times) => {
  const vs   = [u, v, w, ops.negative(sum(u, v, w))];
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


const dirichletVectors = (basis, dot = ops.times) => {
  switch (basis.length) {
  case 0:
  case 1:
    return basis;
  case 2: {
    const vs = gaussReduced(...basis, dot);
    return [vs[0], vs[1], sum(vs[0], vs[1])];
  }
  case 3: {
    const vs = sellingReduced(...basis, dot);
    return [
      vs[0], vs[1], vs[2],
      sum(vs[0], vs[1]), sum(vs[0], vs[2]), sum(vs[1], vs[2]),
      sum(vs[0], vs[1], vs[2])
    ]
  }
  }
};


const reducedLatticeBasis = (vs, dot = ops.times) => {
  const abs = v => v.map(x => Math.abs(x));
  const dif = (v, w) => (v > w) - (v < w);
  const cmp = (v, w) => ops.minus(dot(v, v), dot(w, w)) || dif(abs(w), abs(v));

  const dim = vs[0].length;
  const tmp = dirichletVectors(vs, dot).sort(cmp);
  const A = [];

  for (let k = 0, i = 0; i < dim; ++i) {
    while (k < tmp.length) {
      let w = tmp[k++];
      if (w < ops.times(0, w))
        w = ops.negative(w);
      if (i > 0 && ops.gt(dot(A[0], w), 0))
        w = ops.negative(w);
      A[i] = w.map(trim);
      if (ops.rank(A) > i)
        break;
    }
  }

  return A;
};


const shiftedIntoDirichletDomain = (pos, dirichletVecs, dot = ops.times) => {
  let p = pos;
  let changed;

  do {
    changed = false;

    for (const v of dirichletVecs) {
      const t = ops.div(dot(p, v), dot(v, v));
      if (t <= -0.5 || t > 0.5+eps) {
        p = ops.minus(p, ops.times(ops.round(t), v));
        changed = true;
      }
    }
  } while (changed);

  return p;
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  console.log(reducedLatticeBasis([[16,3], [5,1]]));
  console.log(reducedLatticeBasis([[1,0,0], [1,1,0], [1,1,1]]));

  console.log(shiftedIntoDirichletDomain([3.2, -1.4], [[1,0],[0,1],[1,1]]));
}
