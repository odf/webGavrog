import * as lattices from '../geometry/lattices';
import { points } from '../geometry/types';
const ops = points;


export default function fromPointCloud({ rawPoints, edges, basis, gram }) {
  const dot = (v, w) => ops.times(v, ops.times(gram, w));
  const dvs = ops.times(2, lattices.dirichletVectors(basis, dot));

  const pts = rawPoints.map(p => {
    const s = lattices.shiftIntoDirichletDomain(p, dvs, dot);
  });
};
