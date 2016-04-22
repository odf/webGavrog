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
  .filter(q => q.point.index != p.index)
  .slice(0, p.degree)
  .map(q => ({ base: p, neighbor: q.point, dist: q.dist }));

const allDistances = (points, dot = ops.times) => {
  const tmp = points.map(p => withRelevantDistances(p, points, dot));
  return sortBy([].concat(...tmp), 'dist');
};


if (require.main == module) {
  const points = [
    { index: 1, pos: [ 0, 0, 0], degree: 4 },
    { index: 2, pos: [ 1, 1, 1], degree: 3 },
    { index: 3, pos: [ 1,-1,-1], degree: 3 },
    { index: 4, pos: [-1, 1,-1], degree: 3 },
    { index: 5, pos: [-1,-1, 1], degree: 3 }
  ];

  allDistances(points).forEach(d => console.log(d));
}
