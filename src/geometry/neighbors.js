import { points } from './types';
const ops = points;

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

const allDistances = (points, dot) => {
  const tmp = points.map(p => withRelevantDistances(p, points, dot));
  return sortBy([].concat(...tmp), 'dist');
};


export function inducedEdges(points, dot = ops.times) {
  const edges = [];
  const neighbors = {};
  points.forEach(p => neighbors[p.id] = []);

  const unsaturated = p => neighbors[p.id].length < p.degree;

  allDistances(points, dot).forEach(({ base: p, neighbor: q, dist: d }) => {
    if (unsaturated(p) && unsaturated(q) && neighbors[q.id].indexOf(p.id) < 0) {
      edges.push([p.id, q.id]);
      neighbors[p.id].push(q.id);
      neighbors[q.id].push(p.id);
    }
  });

  return edges;
};


if (require.main == module) {
  const points = [
    { id: 1, pos: [ 1, 1, 1], degree: 4 },
    { id: 2, pos: [ 1,-1,-1], degree: 4 },
    { id: 3, pos: [-1, 1,-1], degree: 4 },
    { id: 4, pos: [-1,-1, 1], degree: 4 },
    { id: 5, pos: [ 2, 2, 2], degree: 4 },
    { id: 6, pos: [ 2,-2,-2], degree: 4 },
    { id: 7, pos: [-2, 2,-2], degree: 4 },
    { id: 8, pos: [-2,-2, 2], degree: 4 }
  ];

  console.log(inducedEdges(points).map(e => e.sort()).sort());
}
