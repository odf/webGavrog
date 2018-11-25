import * as pickler from '../common/pickler';
import * as periodic from '../pgraphs/periodic';

import fromPointCloud from '../pgraphs/fromPointCloud';

import { coordinateChangesF } from '../geometry/types';
const opsF = coordinateChangesF;


const encode = pickler.serialize;


const sum = v => v.reduce((x, y) => x + y);


export const edgeStatistics = (graph, pos, dot) => {
  const lengths = [];

  for (const e of graph.edges) {
    const p = pos[e.head];
    const q = pos[e.tail];
    const d = opsF.minus(opsF.plus(e.shift, q), p);
    lengths.push(opsF.sqrt(dot(d, d)));
  }

  const minimum = Math.min(...lengths);
  const maximum = Math.max(...lengths);
  const average = sum(lengths) / lengths.length;

  return { minimum, maximum, average };
};


export const angleStatistics = (graph, pos, dot) => {
  const adj = periodic.adjacencies(graph);
  const angles = [];

  for (const v of periodic.vertices(graph)) {
    const neighbors = periodic.allIncidences(graph, v, adj);
    const pv = pos[v];

    for (let i = 0; i < neighbors.length - 1; ++i) {
      const { tail: u, shift: su } = neighbors[i];
      const du = opsF.minus(opsF.plus(su, pos[u]), pv);
      const lu = opsF.sqrt(dot(du, du));

      for (let j = i + 1; j < neighbors.length; ++j) {
        const { tail: w, shift: sw } = neighbors[j];
        const dw = opsF.minus(opsF.plus(sw, pos[w]), pv);
        const lw = opsF.sqrt(dot(dw, dw));

        angles.push(Math.acos(dot(du, dw) / (lu * lw)) / Math.PI * 180.0);
      }
    }
  }

  const minimum = Math.min(...angles);
  const maximum = Math.max(...angles);
  const average = sum(angles) / angles.length;

  return { minimum, maximum, average };
};


export const shortestNonEdge = (graph, pos, dot) => {
  const adj = periodic.adjacencies(graph);

  const nodes = periodic.vertices(graph).map(v => ({
    id: v,
    pos: opsF.point(pos[v]),
    degree: adj[v].length + 1
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
