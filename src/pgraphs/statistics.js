import { serialize as encode } from '../common/pickler';
import { coordinateChangesF as opsF } from '../geometry/types';
import * as periodic from '../pgraphs/periodic';
import fromPointCloud from '../pgraphs/fromPointCloud';


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


export const edgeStatistics = (graph, pos, dot) => {
  const lengths = [];

  for (const e of graph.edges) {
    const p = pos[e.head];
    const q = pos[e.tail];
    const d = opsF.minus(opsF.plus(e.shift, q), p);
    lengths.push(opsF.sqrt(dot(d, d)));
  }

  return stats(lengths);
};


export const angleStatistics = (graph, pos, dot) => {
  const angles = [];

  for (const v of periodic.vertices(graph)) {
    const neighbors = periodic.incidences(graph)[v];

    for (let i = 0; i < neighbors.length - 1; ++i) {
      const du = edgeVector(neighbors[i], pos);
      const lu = opsF.sqrt(dot(du, du));

      for (let j = i + 1; j < neighbors.length; ++j) {
        const dw = edgeVector(neighbors[j], pos);
        const lw = opsF.sqrt(dot(dw, dw));

        const arg = dot(du, dw) / (lu * lw);
        const alpha = Math.acos(Math.max(-1, Math.min(arg, 1)));

        angles.push(alpha / Math.PI * 180.0);
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
    const p = pos[e.head];
    const q = pos[e.tail];
    const v = opsF.minus(opsF.plus(e.shift, q), p);
    seen[encode([e.head, v])] = true;
    seen[encode([e.tail, opsF.negative(v)])] = true;
  }

  const closest = fromPointCloud(nodes, [], dot);

  const extra = [];
  for (const [head, tail, shift] of closest) {
    const p = pos[head];
    const q = pos[tail];
    const v = opsF.minus(opsF.plus(shift, q), p);
    if (!seen[encode([head, v])])
      extra.push(opsF.sqrt(dot(v, v)));
  }

  return Math.min(...extra);
};
