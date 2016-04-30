import * as lattices from '../geometry/lattices';
import { points } from '../geometry/types';
const ops = points;


const flatMap   = (fn, xs) => xs.reduce((t, x) => t.concat(fn(x)), []);
const cartesian = (xs, ys) => flatMap(x => ys.map(y => [x, y]), xs);


export default function fromPointCloud(rawPoints, edges, gram) {
  const dot    = (v, w) => ops.times(v, ops.times(gram, w));
  const basis  = ops.identityMatrix(gram.length);
  const dvs    = lattices.dirichletVectors(basis, dot);
  const dvs2   = ops.times(2, dvs);
  const origin = ops.times(0, dvs[0]);

  const points = cartesian(rawPoints, [origin].concat(dvs))
    .map(([pos, shift]) => {
      const p = ops.plus(pos, shift);
      const s = lattices.shiftIntoDirichletDomain(p, dvs2, dot);
      return [pos, ops.plus(shift, s)];
    });
  console.log(points);
};


if (require.main == module) {
  fromPointCloud(
    [[0.4,-0.1]], [], [[1,0], [0,1]]
  );
}
