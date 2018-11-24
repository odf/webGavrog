import * as pickler from '../common/pickler';
import * as periodic from '../pgraphs/periodic';
import * as symmetries from '../pgraphs/symmetries';
import * as unitCells from '../geometry/unitCells';

import embed from '../pgraphs/embedding';
import fromPointCloud from '../pgraphs/fromPointCloud';

import {
  coordinateChangesQ,
  coordinateChangesF
} from '../geometry/types';

const opsQ = coordinateChangesQ;
const opsF = coordinateChangesF;


const encode = pickler.serialize;
const decode = pickler.deserialize;


const sum = v => v.reduce((x, y) => x + y);


const dotProduct = gram => (v, w) => {
  let s = 0;
  for (const i in v)
    for (const j in w)
      s += v[i] * gram[i][j] * w[j];
  return s;
};


const coordinateChangeAsFloat = cc => {
  const tQ = cc.oldToNew;
  const tF = opsF.affineTransformation(
    opsQ.toJS(opsQ.linearPart(tQ)), opsQ.toJS(opsQ.shiftPart(tQ)));

  return opsF.coordinateChange(tF);
};


const mapGramMatrix = (t, gram) => {
  const M = opsF.inverse(opsF.linearPart(t.oldToNew));
  return opsF.times(opsF.transposed(M), opsF.times(gram, M));
};


const countZeros = s => s.filter(x => opsF.lt(opsF.abs(x), 1e-6)).length;


const compareCoords = (a, b) => {
  if (a < 0 && b >= 0)
    return 1;
  else if (a >= 0 && b < 0)
    return -1;
  else if (Math.abs(Math.abs(a) - Math.abs(b)) < 1e-6)
    return 0;
  else
    return Math.abs(a) - Math.abs(b);
};


const comparePoints = (p, q) => {
  if (opsF.sgn(p) < 0 && opsF.sgn(q) >= 0)
    return 1;
  else if (opsF.sgn(q) < 0 && opsF.sgn(p) >= 0)
    return -1;
  else if (countZeros(q) != countZeros(p))
    return countZeros(q) - countZeros(p);
  else if (compareCoords(opsF.times(p, p), opsF.times(q, q)))
    return compareCoords(opsF.times(p, p), opsF.times(q, q));
  else {
    for (let i = 0; i < p.length; ++i) {
      if (compareCoords(p[i], q[i]))
        return compareCoords(p[i], q[i]);
    }
    return 0;
  }
};


const compareEdges = ([p, v], [q, w]) =>
      comparePoints(p, q) || comparePoints(opsF.plus(p, v), opsF.plus(q, w));


const centeringLatticePoints = toStd => {
  const lattice = opsQ.transposed(opsQ.linearPart(toStd.oldToNew));

  const origin = opsQ.vector(opsQ.dimension(lattice));
  const latticePoints = [origin];
  const seen = { [encode(origin)]: true };

  for (let i = 0; i < latticePoints.length; ++i) {
    const v = latticePoints[i];
    for (const w of lattice) {
      const s = opsQ.mod(opsQ.plus(v, w), 1);
      if (!seen[encode(s)]) {
        latticePoints.push(s);
        seen[encode(s)] = true;
      }
    }
  }

  return latticePoints;
};


const nodeRepresentatives = (graph, syms, pos, toStd, centeringShifts) => (
  symmetries.nodeOrbits(graph, syms).map(orbit => {
    const rawPts = orbit.map(v => opsF.point(pos[v]));
    const pts = rawPts.map(p => opsF.vector(opsF.modZ(opsF.times(toStd, p))));
    const allPts = [].concat(
      ...pts.map(p => centeringShifts.map(v => opsF.mod(opsF.plus(p, v), 1))));

    return [allPts.sort(comparePoints)[0], orbit[0]];
  })
);


const edgeRepresentatives = (graph, syms, pos, toStd, centeringShifts) => (
  symmetries.edgeOrbits(graph, syms).map(orbit => {
    const rawEdges = [].concat(...orbit.map(e => {
      const [p, q] = [pos[e.head], pos[e.tail]];
      const v = opsF.minus(opsF.plus(e.shift, q), p);
      return [[opsF.point(p), v], [opsF.point(q), opsF.negative(v)]];
    }));
    const edges = rawEdges.map(([p, s]) => [
      opsF.vector(opsF.modZ(opsF.times(toStd, p))),
      opsF.times(toStd, s)
    ]);
    const allEdges = [].concat(
      ...edges.map(([p, s]) => centeringShifts.map(v => [
        opsF.mod(opsF.plus(p, v), 1),
        s
      ])));

    return allEdges.sort(compareEdges)[0].concat(orbit.length);
  })
);


const edgeStatistics = (ereps, gram) => {
  const dot = dotProduct(gram);

  const lengths = ereps.map(([_, v, wgt]) => opsF.sqrt(dot(v, v)));
  const weights = ereps.map(([_, v, wgt]) => wgt);

  const minimum = Math.min(...lengths);
  const maximum = Math.max(...lengths);
  const average = opsF.times(lengths, weights) / sum(weights)

  return { minimum, maximum, average };
};


const angleStatistics = (graph, syms, pos, toStd, gram) => {
  const dot = dotProduct(gram);
  const adj = periodic.adjacencies(graph);
  const angles = [];

  for (const v of periodic.vertices(graph)) {
    const neighbors = periodic.allIncidences(graph, v, adj);
    const pv = pos[v];

    for (let i = 0; i < neighbors.length - 1; ++i) {
      const { tail: u, shift: su } = neighbors[i];
      const du = opsF.times(toStd, opsF.minus(opsF.plus(su, pos[u]), pv));
      const lu = opsF.sqrt(dot(du, du));

      for (let j = i + 1; j < neighbors.length; ++j) {
        const { tail: w, shift: sw } = neighbors[j];
        const dw = opsF.times(toStd, opsF.minus(opsF.plus(sw, pos[w]), pv));
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


const shortestNonEdge = (graph, syms, pos, toStd, gram) => {
  const dot = dotProduct(gram);
  const adj = periodic.adjacencies(graph);

  const nodes = periodic.vertices(graph).map(v => ({
    id: v,
    pos: opsF.times(toStd, opsF.point(pos[v])),
    degree: adj[v].length + 1
  }));

  const seen = {};
  for (const e of graph.edges) {
    const p = pos[e.head];
    const q = pos[e.tail];
    const v = opsF.times(toStd, opsF.minus(opsF.plus(e.shift, q), p));
    seen[encode([e.head, v])] = true;
    seen[encode([e.tail, opsF.negative(v)])] = true;
  }

  const closest = fromPointCloud(nodes, [], dot);

  const extra = [];
  for (const [head, tail, shift] of closest) {
    const p = pos[head];
    const q = pos[tail];
    const v = opsF.times(toStd, opsF.minus(opsF.plus(shift, q), p));
    if (!seen[encode([head, v])])
      extra.push(opsF.sqrt(dot(v, v)));
  }

  return Math.min(...extra);
};


export const embeddingData = (graph, sgInfo, syms, options) => {
  const toStd = coordinateChangeAsFloat(sgInfo.toStd);
  const embedding = embed(graph, options.relaxPositions);

  // TODO correct to reduced unit cell for monoclinic and triclinic setting
  const gram = mapGramMatrix(toStd, embedding.gram);
  const cellParameters = unitCells.unitCellParameters(gram);
  const cellVolume = unitCells.unitCellVolume(gram);

  // TODO if translational freedom, shift one of the nodes to a nice place
  const pos = embedding.positions;
  const posType = options.relaxPositions ? 'Relaxed' : 'Barycentric';
  const centering = centeringLatticePoints(sgInfo.toStd).map(v => opsQ.toJS(v));

  const nodeReps = nodeRepresentatives(graph, syms, pos, toStd, centering);
  const edgeReps = edgeRepresentatives(graph, syms, pos, toStd, centering);

  const edgeStats = edgeStatistics(edgeReps, gram);
  const angleStats = angleStatistics(graph, syms, pos, toStd, gram);

  const shortestSeparation = shortestNonEdge(graph, syms, pos, toStd, gram);

  return {
    cellParameters,
    cellVolume,
    nodeReps,
    edgeReps,
    edgeStats,
    angleStats,
    posType,
    shortestSeparation
  };
};
