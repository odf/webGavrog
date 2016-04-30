import * as lattices from '../geometry/lattices';
import { points } from '../geometry/types';
const ops = points;


const flatMap   = (fn, xs) => xs.reduce((t, x) => t.concat(fn(x)), []);
const cartesian = (xs, ys) => flatMap(x => ys.map(y => [x, y]), xs);
const vecabs    = v => v < ops.times(0, v) ? ops.negative(v) : v;


const graph = () => {
  const neighbors = [];

  const degree = i => (neighbors[i] || []).length;

  const contains = (adjs, j, s) => {
    for (const [k, v] of adjs) {
      if (k == j && v <= s && v >= s)
        return true;
    }
    return false;
  };

  const addNeighbor = (i, j, s) => {
    if (neighbors[i] == null)
      neighbors[i] = [];
    if (!contains(neighbors[i], j, s))
      neighbors[i].push([j, s]);
  };

  const addEdge = (i, j, s) => {
    if (i == j)
      addNeighbor(i, j, vecabs(s));
    else {
      addNeighbor(i, j, s);
      addNeighbor(j, i, ops.negative(s));
    }
  };

  const edges = () => {
    const result = [];
    neighbors.forEach((ws, i) => {
      ws.forEach(([j, s]) => {
        if (i <= j)
          result.push([i, j, s]);
      });
    });
    return result;
  };

  return { addEdge, degree, edges };
};


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
  const G = graph();
  G.addEdge(1, 2, [0,0,0]);
  G.addEdge(2, 1, [0,0,0]);
  G.addEdge(1, 2, [1,0,0]);
  G.addEdge(1, 2, [0,1,0]);
  G.addEdge(1, 2, [0,0,1]);
  console.log(G.degree(1));
  console.log(G.degree(2));
  console.log(G.edges());
  console.log();

  fromPointCloud(
    [[0.4,-0.1]], [], [[1,0], [0,1]]
  );
}
