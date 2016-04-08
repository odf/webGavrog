import { floatMatrices } from '../arithmetic/types';

const ops = floatMatrices;
const eps = Math.pow(2, -50);


const gaussReduced = (v1, v2, G = ops.identityMatrix(2)) => {
  const vs   = [v1, v2];
  const dot  = (i, j) => ops.times(ops.times(vs[i], G), vs[j]);
  const norm = i => dot(i, i);

  while (true) {
    const [i, j] = ops.lt(norm(0), norm(1)) ? [0, 1] : [1, 0];
    const t = ops.round(ops.div(dot(0, 1), norm(i)));
    vs[j] = ops.minus(vs[j], ops.times(t, vs[i]));
    if (ops.ge(norm(j), ops.times(norm(i), 1-eps)))
      break;
  }

  if (ops.gt(dot(0, 1), 0))
    vs[1] = ops.negative(vs[1]);

  return vs;
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  console.log(gaussReduced([16,3], [5,1]));
}
