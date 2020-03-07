import { lattices } from '../spacegroups/lattices';
import { opModZ, primitiveSetting } from '../spacegroups/spacegroups';
import * as unitCells from '../spacegroups/unitCells';

import { makeGraph } from '../pgraphs/periodic';
import fromPointCloud from '../pgraphs/fromPointCloud';

import {
  coordinateChangesQ as opsQ,
  coordinateChangesF as opsF
} from '../geometry/types';


const matrixError = (A, B) => opsF.norm(opsF.minus(A, B)) / opsF.norm(A);


const commonFromSpec = spec => {
  const warnings = spec.warnings.slice();
  const errors = spec.errors.slice();

  if (spec.group.error) {
    errors.push(spec.group.error);
    return { warnings, errors };
  }

  const { operators } = spec.group;
  const cellGram = unitCells.symmetrizedGramMatrix(spec.cellGram, operators);

  if (matrixError(cellGram, spec.cellGram) > 0.01) {
    const parms = unitCells.unitCellParameters(cellGram);
    warnings.push(`Unit cell resymmetrized to ${parms}`);
  }

  const primitive = primitiveSetting(operators);
  const ops = primitive.ops;
  const cell = opsQ.toJS(primitive.cell);
  const toPrimitive = opsQ.toJS(primitive.fromStd.oldToNew);

  const gram = unitCells.symmetrizedGramMatrix(
    opsF.times(cell, opsF.times(cellGram, opsF.transposed(cell))),
    ops.map(op => opsQ.transposed(opsQ.linearPart(op)))
  );

  return { warnings, errors, ops, toPrimitive, gram };
};


const subgroup = (symOps, inSubgroup) => {
  const sub = symOps.filter(inSubgroup).map(opModZ);

  for (const a of sub) {
    for (const b of sub) {
      if (!inSubgroup(opsQ.times(a, b)))
        throw new Error('inconsistent subgroup condition');
    }
  }

  return sub;
};


const cosetReps = (symOps, inSubgroup) => {
  const sub = subgroup(symOps, inSubgroup);
  const seen = {};
  const result = [];

  for (const op of symOps) {
    if (!seen[opModZ(op)]) {
      result.push(op);

      for (const t of sub)
        seen[opModZ(opsQ.times(op, t))] = true;
    }
  }

  return result;
};


const applyToVector = (op, vector) =>
  opsF.times(opsQ.toJS(opsQ.linearPart(op)), vector);


const applyToPoint = (op, point) => opsF.point(opsF.plus(
  applyToVector(op, opsF.vector(point)),
  opsQ.toJS(opsQ.shiftPart(op))
));


const dot = (v, w, gram) => {
  let s = 0;
  for (const i in v) {
    for (const j in w)
      s += v[i] * gram[i][j] * w[j];
  }
  return s;
};


const dotProduct = gram => (v, w) => dot(v, w, gram);


const pointsAreCloseModZ = (gram, maxDist) => {
  const limit = maxDist * maxDist;
  const eps = Math.pow(2, -40);
  const { dirichletVectors } = lattices(opsF, eps, dotProduct(gram));
  const vecs = dirichletVectors(opsF.identityMatrix(gram.length));

  return (p, q) => {
    const d = opsF.minus(p, q);
    let changed;

    do {
      changed = false;

      for (const v of vecs) {
        const t = dot(d, v, gram) / dot(v, v, gram);

        if (t < -0.5 || t > 0.5+eps) {
          const f = Math.round(t);

          for (let i = 0; i < d.length; ++i)
            d[i] -= f * v[i];

          changed = true;
        }
      }
    } while (changed);

    return dot(d, d, gram) < limit;
  };
};


const vectorsAreClose = (gram, maxDist) => {
  const limit = maxDist * maxDist;

  return (v, w) => {
    const d = opsF.minus(v, w);
    return dot(d, d, gram) < limit;
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
    const inStabilizer = op => equalFn(point, applyToPoint(op, point));

    for (const operator of cosetReps(symOps, inStabilizer)) {
      result.push({
        id: result.length,
        name: v.name,
        pos: opsF.modZ(applyToPoint(operator, point)),
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
      pointsEqFn(src, applyToPoint(op, src)) &&
        vectorsEqFn(vec, applyToVector(op, vec))
    );

    for (const operator of cosetReps(symOps, inStabilizer)) {
      const from = opsF.modZ(applyToPoint(operator, src));
      const to = opsF.plus(from, applyToVector(operator, vec));

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
    return fromPointCloud(nodesF, edges, dotProduct(gram));
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
  const { warnings, errors, ops, toPrimitive, gram } = commonFromSpec(spec);

  const pointsEq = pointsAreCloseModZ(gram, 0.001);
  const vectorsEq = vectorsAreClose(gram, 0.001);

  const nodesIn = spec.nodes.map(mapNode(toPrimitive));
  const edgesIn = spec.edges.map(mapEdge(toPrimitive, nodesIn));
  const nodes = applyOpsToNodes(nodesIn, ops, pointsEq);
  const edges = applyOpsToEdges(edgesIn, nodes, ops, pointsEq, vectorsEq)
  const graph = makeGraph(completeAndConvertEdges(edges, nodes, gram));

  return { name, group: group.name, nodes, graph, warnings, errors };
};
