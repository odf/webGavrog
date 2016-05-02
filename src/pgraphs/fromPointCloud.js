import * as lattices from '../geometry/lattices';
import { points }    from '../geometry/types';
import induceEdges   from '../geometry/induceEdges';


const ops = points;


const graph = () => {
  const neighbors = [];

  const degree = i => {
    const nbrs = neighbors[i] || [];
    return nbrs.length + nbrs.filter(([j, _]) => j == i).length;
  };

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
      addNeighbor(i, j, s < ops.times(0, s) ? ops.negative(s) : s);
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


const pgraph = () => {
  const G = graph();

  const addEdge = (p, q) => {
    G.addEdge(p.originalId, q.originalId, ops.minus(q.shift, p.shift));
  };

  return {
    addEdge     : addEdge,
    addPlainEdge: ([i, j, s]) => G.addEdge(i, j, s),
    degree      : p  => G.degree(p.originalId),
    edges       : G.edges
  };
};


const flatMap   = (fn, xs) => xs.reduce((t, x) => t.concat(fn(x)), []);
const cartesian = (xs, ys) => flatMap(x => ys.map(y => [x, y]), xs);


export default function fromPointCloud(rawPoints, explicitEdges, gram) {
  const dot    = (v, w) => ops.times(v, ops.times(gram, w));
  const basis  = ops.identityMatrix(gram.length);
  const dvs    = lattices.dirichletVectors(basis, dot);
  const dvs2   = ops.times(2, dvs);
  const origin = ops.times(0, dvs[0]);

  const points = cartesian(rawPoints, [origin].concat(dvs))
    .map(([{ id, pos, degree }, shift], i) => {
      const p = ops.plus(pos, shift);
      const s = lattices.shiftIntoDirichletDomain(p, dvs2, dot);
      return {
        id: i,
        pos: ops.plus(p, s),
        degree,
        shift: ops.plus(shift, s),
        originalId: id,
        originalPosition: pos
      };
    });

  const G = pgraph();
  explicitEdges.forEach(G.addPlainEdge);
  induceEdges(points, G, dot);
  return G.edges();
};


if (require.main == module) {
  const sqrt2 = Math.sqrt(2);

  const points = [
    { id: 1, pos: [  0.125,  0.125,  0.125 ], degree: 4 },
    { id: 2, pos: [ -0.125, -0.125, -0.125 ], degree: 4 }
  ];

  const gram = [
    [sqrt2, 1.0, 1.0],
    [1.0, sqrt2, 1.0],
    [1.0, 1.0, sqrt2]
  ];

  console.log(fromPointCloud(points, [[1, 2, [0, 0, 0]]], gram));
}
