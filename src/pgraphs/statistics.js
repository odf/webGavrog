import { serialize as encode } from '../common/pickler';
import { coordinateChangesF as opsF } from '../geometry/types';
import * as periodic from '../pgraphs/periodic';
import fromPointCloud from '../pgraphs/fromPointCloud';


const norm = (v, dot) => opsF.sqrt(dot(v, v));
const normalized = (v, dot) => opsF.div(v, norm(v, dot));
const clamp = (val, lo, hi) => Math.max(lo, Math.min(val, hi));


const stats = xs => {
  let sum = 0.0;
  let minimum = Infinity;
  let maximum = -Infinity;

  for (const x of xs) {
    sum += x;
    minimum = x < minimum ? x : minimum;
    maximum = x > maximum ? x : maximum;
  }

  const average = sum / xs.length;

  return { minimum, maximum, average };
};


const edgeVector = (edge, pos) =>
  opsF.minus(opsF.plus(edge.shift, pos[edge.tail]), pos[edge.head]);


export const edgeStatistics = (graph, pos, dot) =>
  stats(graph.edges.map(edge => norm(edgeVector(edge, pos), dot)));


export const angleStatistics = (graph, pos, dot) => {
  const angles = [];

  for (const v of periodic.vertices(graph)) {
    const vectors = periodic.incidences(graph)[v]
      .map(e => normalized(edgeVector(e, pos), dot));

    for (let i = 0; i < vectors.length - 1; ++i) {
      for (let j = i + 1; j < vectors.length; ++j) {
        const arg = clamp(dot(vectors[i], vectors[j]), -1.0, 1.0);
        angles.push(Math.acos(arg) / Math.PI * 180.0);
      }
    }
  }

  return stats(angles);
};


export const shortestNonEdge = (graph, pos, dot) => {
  const nodes = periodic.vertices(graph).map(v => ({
    id: v,
    pos: opsF.point(pos[v]),
    degree: periodic.incidences(graph)[v].length + 1
  }));

  const seen = {};
  for (const e of graph.edges) {
    const v = edgeVector(e, pos);
    seen[encode([e.head, v])] = true;
    seen[encode([e.tail, opsF.negative(v)])] = true;
  }

  const closest = fromPointCloud(nodes, [], dot);

  let minimum = Infinity;
  for (const [head, tail, shift] of closest) {
    const v = edgeVector(periodic.makeEdge(head, tail, shift), pos);
    if (!seen[encode([head, v])] && norm(v, dot) < minimum)
      minimum = norm(v, dot);
  }

  return minimum;
};
