import { makeGraph } from '../pgraphs/periodic';
import fromPointCloud from '../pgraphs/fromPointCloud';
import { coordinateChangesF as opsF } from '../geometry/types';
import * as common from './common';


const vectorsAreClose = (gram, maxDist) => {
  const limit = maxDist * maxDist;

  return (v, w) => {
    const d = opsF.minus(v, w);
    return common.dot(d, d, gram) < limit;
  };
};


const lookupPointModZ = (p, nodes, areEqualFn) => {
  for (const { pos: q, id: node } of nodes) {
    if (areEqualFn(p, q)) {
      const shift = opsF.minus(p, q).map(x => opsF.round(x));
      return { node, shift };
    }
  }

  return { pos: p };
};


const applyOpsToNodes = (nodes, symOps, equalFn) => {
  const result = [];

  for (let repIndex = 0; repIndex < nodes.length; ++repIndex) {
    const v = nodes[repIndex];
    const point = v.positionPrimitive;
    const inStabilizer = op => equalFn(point, common.applyToPoint(op, point));

    for (const operator of common.cosetReps(symOps, inStabilizer)) {
      result.push({
        id: result.length,
        name: v.name,
        pos: opsF.modZ(common.applyToPoint(operator, point)),
        degree: v.coordination,
        repIndex,
        operator
      });
    }
  }

  return result;
};


const applyOpsToEdges = (edges, nodes, symOps, pointsEqFn, vectorsEqFn) => {
  const result = [];

  for (let repIndex = 0; repIndex < edges.length; ++repIndex) {
    const e = edges[repIndex];
    const src = e.from.positionPrimitive;
    const vec = opsF.minus(e.to.positionPrimitive, src);

    const inStabilizer = op => (
      pointsEqFn(src, common.applyToPoint(op, src)) &&
        vectorsEqFn(vec, common.applyToVector(op, vec))
    );

    for (const operator of common.cosetReps(symOps, inStabilizer)) {
      const from = opsF.modZ(common.applyToPoint(operator, src));
      const to = opsF.plus(from, common.applyToVector(operator, vec));

      result.push({
        from: lookupPointModZ(from, nodes, pointsEqFn),
        to: lookupPointModZ(to, nodes, pointsEqFn),
        repIndex,
        operator
      });
    }
  }

  return result;
};


const completeAndConvertEdges = (edgesIn, nodes, gram) => {
  const edges = edgesIn.map(
    ({ from, to }) => [from.node, to.node, opsF.minus(to.shift, from.shift)]
  );

  const left = nodes.map(v => v.degree);
  for (const [i, j, _] of edges) {
    --left[i];
    --left[j];
  }

  if (left.some(n => n > 0)) {
    const pointAsFloat = pos => opsF.point(opsF.vector(pos));
    const nodesF = nodes.map(
      ({ id, pos, degree }) => ({ id, pos: pointAsFloat(pos), degree })
    );
    return fromPointCloud(nodesF, edges, common.dotProduct(gram));
  }
  else
    return edges;
};


const mapNode = coordChange => (
  ({ name, coordination, position }, i) => ({
    name,
    index: i,
    coordination,
    positionInput: position,
    positionPrimitive: opsF.modZ(opsF.times(coordChange, opsF.point(position)))
  })
);


const mapEdge = (coordChange, nodes) => {
  const mapEnd = p => {
    if (opsF.typeOf(p) == 'Vector') {
      return {
        positionInput: p,
        positionPrimitive: opsF.times(coordChange, opsF.point(p))
      }
    }
    else {
      const { positionInput, positionPrimitive } = (
        nodes.find(v => v.name == p) || {}
      );
      return { nodeGiven: p, positionInput, positionPrimitive };
    };
  };

  return ([from, to], index) => ({
    index,
    from: mapEnd(from),
    to: mapEnd(to)
  });
};


export const netFromCrystal = spec => {
  const { name, group } = spec;
  const { warnings, errors, ops, toPrimitive, gram } = common.fromSpec(spec);

  const pointsEq = common.pointsAreCloseModZ(gram, 0.001);
  const vectorsEq = vectorsAreClose(gram, 0.001);

  const nodesIn = spec.nodes.map(mapNode(toPrimitive));
  const edgesIn = spec.edges.map(mapEdge(toPrimitive, nodesIn));
  const nodes = applyOpsToNodes(nodesIn, ops, pointsEq);
  const edges = applyOpsToEdges(edgesIn, nodes, ops, pointsEq, vectorsEq)
  const graph = makeGraph(completeAndConvertEdges(edges, nodes, gram));

  return { name, group: group.name, nodes, graph, warnings, errors };
};
