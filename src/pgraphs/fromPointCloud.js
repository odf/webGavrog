import { lattices } from '../spacegroups/lattices';
import { pointsF as ops }  from '../geometry/types';


const induceEdges = (points, nrSeeds, graph, dot = ops.times) => {
  const pairsWithDistances = [];

  for (const p of points) {
    const candidates = [];

    for (const q of points) { //TODO use fewer points? (first nrSeeds incorrect)
      if (q.id > p.id) {
        const d = ops.minus(p, q);
        candidates.push([p, q, dot(d, d)]);
      }
    }
    candidates.sort((a, b) => a[2] - b[2]);

    for (let i = 0; i < p.degree; ++i)
      pairsWithDistances.push(candidates[i]);
  }
  pairsWithDistances.sort((a, b) => a[2] - b[2]);

  for (const [p, q, d] of pairsWithDistances) {
    if (graph.degree(p) < p.degree || graph.degree(q) < q.degree)
      graph.addEdge(p, q);
  }
};


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


const fromPointCloud = (rawPoints, explicitEdges, dot) => {
  const eps = Math.pow(2, -40);
  const { dirichletVectors, shiftIntoDirichletDomain } =
        lattices(ops, eps, dot);

  const basis  = ops.identityMatrix(ops.dimension(rawPoints[0].pos));
  const dvs    = dirichletVectors(basis);
  const dvs2   = ops.times(2, dvs);
  const origin = ops.times(0, dvs[0]);

  const points = cartesian([origin].concat(dvs), rawPoints).map(
    ([shift, { id, pos, degree }], i) => {
      const p = ops.plus(pos, shift);
      const s = shiftIntoDirichletDomain(ops.vector(p), dvs2);
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
  induceEdges(points, rawPoints.length, G, dot);
  return G.edges();
};


export default fromPointCloud;
