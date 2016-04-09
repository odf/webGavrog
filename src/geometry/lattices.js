import { floatMatrices } from '../arithmetic/types';

const ops = floatMatrices;
const eps = Math.pow(2, -50);

const lift    = op => (...args) => args.reduce((a, b) => op(a, b));
const sum     = lift(ops.plus);
const product = lift(ops.times);


const gaussReduced = (u, v, G = ops.identityMatrix(2)) => {
  const vs   = [u, v];
  const dot  = (i, j) => product(vs[i], G, vs[j]);
  const norm = i => dot(i, i);

  while (true) {
    const [i, j] = ops.lt(norm(0), norm(1)) ? [0, 1] : [1, 0];
    const t = ops.round(ops.div(dot(0, 1), norm(i)));
    vs[j] = ops.minus(vs[j], product(t, vs[i]));
    if (ops.ge(norm(j), product(norm(i), 1-eps)))
      break;
  }

  if (ops.gt(dot(0, 1), 0))
    vs[1] = ops.negative(vs[1]);

  return vs;
};


const sellingReduced = (u, v, w, G = ops.identityMatrix(3)) => {
  const vs   = [u, v, w, ops.negative(sum(u, v, w))];
  const dot  = (i, j) => product(vs[i], G, vs[j]);

  const _sellingStep = () => {
    for (let i = 0; i < 3; ++i) {
      for (let j = i+1; j < 4; ++j) {
	if (ops.gt(dot(i, j), eps)) {
	  for (let k = 0; k < 4; ++k) {
	    if (k != i && k != j) {
	      vs[k] = sum(vs[k], vs[i]);
	    }
	  }
	  vs[i] = ops.negative(vs[i]);
	  return true;
	}
      }
    }
  };

  while (_sellingStep()) {
  }

  return vs.slice(0, 3);
};


const dirichletVectors = (basis, G) => {
  switch (basis.length) {
  case 0:
  case 1:
    return basis;
  case 2: {
    const vs = gaussReduced(...basis, G);
    return [vs[0], vs[1], sum(vs[0], vs[1])];
  }
  case 3: {
    const vs = sellingReduced(...basis, G);
    return [
      vs[0], vs[1], vs[2],
      sum(vs[0], vs[1]), sum(vs[0], vs[2]), sum(vs[1], vs[2]),
      sum(vs[0], vs[1], vs[2])
    ]
  }
  }
};


const reducedLatticeBasis = (vs, G = ops.identityMatrix(vs.length)) => {
  const dot = (v, w) => product(v, G, w);
  const abs = v => v.map(x => Math.abs(x));
  const dif = (v, w) => (v > w) - (v < w);
  const cmp = (v, w) => ops.minus(dot(v, v), dot(w, w)) || dif(abs(w), abs(v));

  const dim = vs[0].length;
  const tmp = dirichletVectors(vs, G).sort(cmp);
  const A = [];

  for (let k = 0, i = 0; i < dim; ++i) {
    while (k < tmp.length) {
      let w = tmp[k++];
      if (w < ops.times(0, w))
        w = ops.negative(w);
      if (i > 0 && ops.gt(dot(A[0], w), 0))
        w = ops.negative(w);
      A[i] = w;
      if (ops.rank(A) > i)
        break;
    }
  }

  return A;
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  console.log(reducedLatticeBasis([[16,3], [5,1]]));
  console.log(reducedLatticeBasis([[1,0,0], [1,1,0], [1,1,1]]));
}
