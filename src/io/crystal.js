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


const mapNode = coordChange => p => ({
  name: p.name,
  degree: p.coordination,
  pos: opsF.modZ(opsF.times(coordChange, opsF.point(p.position)))
});


const mapEdge = (coordChange, nodes) => e => e.map(p => {
  if (opsF.typeOf(p) == 'Vector')
    return opsF.times(coordChange, opsF.point(p));
  else
    return (nodes.find(v => v.name == p) || {}).pos;
});


const applyOpsToNodes = (nodes, symOps, equalFn) => {
  const result = [];

  for (let repIndex = 0; repIndex < nodes.length; ++repIndex) {
    const { name, degree, pos: vpos } = nodes[repIndex];
    const inStabilizer = op => equalFn(vpos, common.applyToPoint(op, vpos));

    for (const operator of common.cosetReps(symOps, inStabilizer)) {
      const id = result.length;
      const pos = opsF.modZ(common.applyToPoint(operator, vpos));

      result.push({ id, name, pos, degree, repIndex, operator });
    }
  }

  return result;
};


const applyOpsToEdges = (edges, nodes, symOps, pointsEqFn, vectorsEqFn) => {
  const lookup = p => {
    for (const v of nodes) {
      if (pointsEqFn(p, v.pos)) {
        const shift = opsF.minus(p, v.pos).map(x => opsF.round(x));
        return [ v.id, shift ];
      }
    }
  };

  const result = [];

  for (const [src, dst] of edges) {
    const vec = opsF.minus(dst, src);

    const inStabilizer = op => (
      pointsEqFn(src, common.applyToPoint(op, src)) &&
        vectorsEqFn(vec, common.applyToVector(op, vec))
    );

    for (const op of common.cosetReps(symOps, inStabilizer)) {
      const imgSrc = opsF.modZ(common.applyToPoint(op, src));
      const imgVec = opsF.plus(imgSrc, common.applyToVector(op, vec));
      const [ nodeA, shiftA ] = lookup(imgSrc);
      const [ nodeB, shiftB ] = lookup(imgVec);

      result.push([ nodeA, nodeB, opsF.minus(shiftB, shiftA) ]);
    }
  }

  return result;
};


const completeEdgeList = (edges, nodes, gram) => {
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


export const netFromCrystal = spec => {
  const { name, group } = spec;
  const { warnings, errors, ops, toPrimitive, gram } = common.fromSpec(spec);

  const pointsEq = common.pointsAreCloseModZ(gram, 0.001);
  const vectorsEq = vectorsAreClose(gram, 0.001);

  const nodesIn = spec.nodes.map(mapNode(toPrimitive));
  const edgesIn = spec.edges.map(mapEdge(toPrimitive, nodesIn));
  const nodes = applyOpsToNodes(nodesIn, ops, pointsEq);
  const edges = applyOpsToEdges(edgesIn, nodes, ops, pointsEq, vectorsEq)
  const graph = makeGraph(completeEdgeList(edges, nodes, gram));

  return { name, group: group.name, nodes, graph, warnings, errors };
};
