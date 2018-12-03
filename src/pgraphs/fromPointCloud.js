import { lattices } from '../geometry/lattices';
import { pointsF }  from '../geometry/types';

const ops = pointsF;


const norm     = (v, dot)    => ops.sqrt(dot(v, v));
const distance = (p, q, dot) => norm(ops.minus(p, q), dot);
const sortBy   = (a, key)    => a.sort((x, y) => ops.cmp(x[key], y[key]));

const withDistances = (pos, points, dot) =>
  points.map(p => ({point: p, dist: distance(pos, p.pos, dot) }));

const withClosestDistances = (pos, points, dot, limit) =>
  sortBy(withDistances(pos, points, dot), 'dist').slice(0, limit);

const withRelevantDistances = (p, points, dot) =>
  withClosestDistances(p.pos, points, dot, p.degree+1)
  .filter(q => q.point.id != p.id)
  .slice(0, p.degree)
  .map(q => ({ base: p, neighbor: q.point, dist: q.dist }));

const allDistances = (points, nrSeeds, dot) => {
  const tmp = points.slice(0, nrSeeds)
        .map(p => withRelevantDistances(p, points, dot));
  return sortBy([].concat(...tmp), 'dist');
};

const induceEdges = (points, nrSeeds, graph, dot = ops.times) => {
  allDistances(points, nrSeeds, dot).forEach(
    ({ base: p, neighbor: q, dist: d }) => {
      if (graph.degree(p) < p.degree || graph.degree(q) < q.degree)
        graph.addEdge(p, q);
    });
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
