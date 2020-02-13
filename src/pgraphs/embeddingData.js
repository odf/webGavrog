import * as symmetries from '../pgraphs/symmetries';
import * as stats from '../pgraphs/statistics';
import * as unitCells from '../spacegroups/unitCells';
import * as spacegroups from '../spacegroups/spacegroups';

import {
  coordinateChangesQ as opsQ,
  coordinateChangesF as opsF
} from '../geometry/types';


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
    opsQ.toJS(opsQ.linearPart(tQ)),
    opsQ.toJS(opsQ.shiftPart(tQ))
  );

  return opsF.coordinateChange(tF);
};


const countZeros = xs => {
  let n = 0;
  for (const x of xs) {
    if (opsF.lt(opsF.abs(x), 1e-6))
      ++n;
  }
  return n;
};


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
  else {
    return (
      countZeros(q) - countZeros(p) ||
        compareCoords(opsF.times(p, p), opsF.times(q, q)) ||
        p.reduce((a, _, i) => a || compareCoords(p[i], q[i]), 0)
    );
  }
};


const compareEdges = ([p, v], [q, w]) =>
  comparePoints(p, q) || comparePoints(opsF.plus(p, v), opsF.plus(q, w));


const nodeRepresentatives = (graph, syms, pos, toStd, centeringShifts) => {
  const result = [];

  for (const orbit of symmetries.nodeOrbits(graph, syms)) {
    let best = null;

    for (const v of orbit) {
      const p0 = opsF.vector(opsF.times(toStd, opsF.point(pos[v])));

      for (const s of centeringShifts) {
        const p = opsF.mod(opsF.plus(p0, s), 1);
        if (best == null || comparePoints(p, best) < 0)
          best = p;
      }
    }

    result.push([best, orbit[0]]);
  }

  return result;
};


const edgeRepresentatives = (graph, syms, pos, toStd, centeringShifts) => {
  const result = [];

  for (const orbit of symmetries.edgeOrbits(graph, syms)) {
    let best = null;

    for (const e of orbit) {
      const p = opsF.vector(opsF.times(toStd, opsF.point(pos[e.head])));
      const q = opsF.vector(opsF.times(toStd, opsF.point(pos[e.tail])));
      const d = opsF.plus(opsF.times(toStd, e.shift), opsF.minus(q, p));

      for (const [v, t] of [[p, d], [q, opsF.negative(d)]]) {
        for (const s of centeringShifts) {
          const candidate = [opsF.mod(opsF.plus(v, s), 1), t];
          if (best == null || compareEdges(candidate, best) < 0)
            best = candidate;
        }
      }
    }

    result.push(best.concat(orbit.length));
  }

  return result;
};


export const embeddingData = (graph, toStdRaw, syms, embedding) => {
  const toStd = coordinateChangeAsFloat(toStdRaw);

  // TODO correct to reduced unit cell for monoclinic and triclinic setting
  const cellGram = unitCells.mapGramMatrix(toStd, embedding.gram);
  const cellBasis = unitCells.invariantBasis(cellGram);
  const cellParameters = unitCells.unitCellParameters(cellGram);
  const cellVolume = unitCells.unitCellVolume(cellGram);

  // TODO if translational freedom, shift one of the nodes to a nice place
  const pos = embedding.positions;
  const centering = spacegroups.centeringLatticePoints(toStdRaw)
        .map(v => opsQ.toJS(v));

  const nodeReps = nodeRepresentatives(graph, syms, pos, toStd, centering);
  const edgeReps = edgeRepresentatives(graph, syms, pos, toStd, centering);

  const dot = dotProduct(embedding.gram);
  const edgeStats = stats.edgeStatistics(graph, pos, dot);
  const angleStats = stats.angleStatistics(graph, pos, dot);
  const shortestSeparation = stats.shortestNonEdge(graph, pos, dot);

  const shiftSpace = spacegroups.shiftSpace(syms.map(s => s.transform)) || [];
  const degreesOfFreedom = embedding.params.length - shiftSpace.length;

  return {
    cellGram,
    cellBasis,
    cellParameters,
    cellVolume,
    nodeReps,
    edgeReps,
    edgeStats,
    angleStats,
    shortestSeparation,
    degreesOfFreedom
  };
};
