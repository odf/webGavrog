import * as lattices from '../geometry/lattices';
import { points } from '../geometry/types';
const ops = points;


export default function fromPointCloud({ rawPoints, edges, basis, gram }) {
  const dot = (v, w) => ops.times(v, ops.times(gram, w));
  const dvs = ops.times(2, lattices.dirichletVectors(basis, dot));

  const pts = rawPoints.map(p => {
    const pp = lattices.shiftedIntoDirichletDomain(p, dvs, dot);
    const shift = ops.minus(pp, p);
    
  });
};
