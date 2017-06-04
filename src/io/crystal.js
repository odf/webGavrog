import * as spacegroups from '../geometry/spacegroups';
import * as lattices from '../geometry/lattices';
import * as pg from '../pgraphs/periodic';
import * as sgtable from './sgtable';
import * as delaney from '../dsymbols/delaney';
import * as derived from '../dsymbols/derived';

import fromPointCloud from '../pgraphs/fromPointCloud';

import { coordinateChanges } from '../geometry/types';
const V = coordinateChanges;


let _timers = null;

export function useTimers(timers) {
  _timers = timers;
};


const matrixError = (A, B) => V.div(V.norm(V.minus(A, B)), V.norm(A));
const eps = Math.pow(2, -50);
const trim = x => Math.abs(x) < eps ? 0 : x;
const acosdeg = x => Math.acos(x) / Math.PI * 180.0;
const flatMap = (fn, xs) => xs.reduce((t, x, i) => t.concat(fn(x, i)), []);


const mapNode = coordinateChange => ({ name, coordination, position }, i) => ({
  name,
  index: i,
  coordination,
  positionInput: position,
  positionPrimitive: V.modZ(V.times(coordinateChange, V.point(position)))
});


const findNode = (nodes, name) => {
  for (const v of nodes)
    if (v.name == name)
      return v;
};


const mapEnd = (coordinateChange, nodes) => p => {
  if (V.typeOf(p) == 'Vector') {
    return {
      positionInput: p,
      positionPrimitive: V.times(coordinateChange, V.point(p))
    }
  }
  else {
    const { positionInput, positionPrimitive } = findNode(nodes, p) || {};
    return { nodeGiven: p, positionInput, positionPrimitive };
  };
};


const mapEdge = (coordinateChange, nodes) => {
  const emap = mapEnd(coordinateChange, nodes);

  return ([from, to], index) => ({
    index,
    from: emap(from),
    to: emap(to)
  });
};


const unitCellParameters = G => {
  if (V.dimension(G) == 2) {
    const a = Math.sqrt(G[0][0]);
    const b = Math.sqrt(G[1][1]);
    return [a, b, acosdeg(G[0][1] / a / b)];
  }
  else if (V.dimension(G) == 3) {
    const a = Math.sqrt(G[0][0]);
    const b = Math.sqrt(G[1][1]);
    const c = Math.sqrt(G[2][2]);
    const alpha = acosdeg(G[1][2] / b / c);
    const beta  = acosdeg(G[0][2] / a / c);
    const gamma = acosdeg(G[0][1] / a / b);
    return [a, b, c, alpha, beta, gamma].map(trim);
  }
};


const dotProduct = gram => {
  const G = V.toJS(gram);

  return (v, w) => {
    let s = 0;
    for (const i in v)
      for (const j in w)
        s += v[i] * G[i][j] * w[j];
    return s;
  };
};


const shiftIntoDirichletDomain = (pos, dirichletVecs, dot) => {
  const eps = Math.pow(2, -40);
  const adjust = (p, v, f) => p.map((x, i) => x - f * v[i]);
  const vecsWithLengths = dirichletVecs.map(v => [v, dot(v, v)]);

  let p = pos.slice();
  let changed;

  do {
    changed = false;

    for (const [v, lv] of vecsWithLengths) {
      const t = dot(p, v) / lv;
      if (t < -0.5 || t > 0.5+eps) {
        p = adjust(p, v, Math.round(t));
        changed = true;
      }
    }
  } while (changed);

  return p;
};


const pointsAreCloseModZ = (gram, maxDist) => {
  const n = V.dimension(gram);
  const limit = V.times(maxDist, maxDist);
  const dot = dotProduct(gram);
  const vecs = lattices.dirichletVectors(V.identityMatrix(n), dot);

  return (p, q) => {
    const d0 = p.coords.map((x, i) => (V.toJS(x) - V.toJS(q.coords[i])) % 1);
    const d = shiftIntoDirichletDomain(d0, vecs, dot);
    return dot(d, d) < limit;
  };
};


const vectorsAreClose = (gram, maxDist) => {
  const n = V.dimension(gram);
  const limit = V.times(maxDist, maxDist);
  const dot = dotProduct(gram);

  return (v, w) => {
    const d = V.toJS(V.minus(v, w));
    return V.le(dot(d, d), limit);
  };
};


const lookupPointModZ = (p, nodes, areEqualFn) => {
  for (const i in nodes) {
    const q = nodes[i].pos;
    if (areEqualFn(p, q)) {
      return {
        node: nodes[i].id,
        shift: V.minus(p, q).map(x => V.round(x))
      };
    }
  }

  return { pos: p };
};


const operatorCosets = (ops, subgroup) => {
  const seen = {};
  const result = [];

  for (const op of ops) {
    if (!seen[spacegroups.opModZ(op)]) {
      result.push(op);
      for (const t of subgroup) {
        seen[spacegroups.opModZ(V.times(op, t))] = true;
      }
    }
  }

  return result;
};


const pointStabilizer = (point, ops, areEqualFn) => {
  const stabilizer = ops.filter(op => areEqualFn(point, V.times(op, point)));

  for (const A of stabilizer) {
    for (const B of stabilizer) {
      if (!areEqualFn(point, V.times(V.times(A, V.inverse(B)), point))) {
        return null;
      }
    }
  }

  return stabilizer.map(spacegroups.opModZ);
};


const edgeStabilizer = (pos, vec, ops, pointsEqualFn, vectorsEqualFn) => {
  const goodOp = op => (
    pointsEqualFn(pos, V.times(op, pos))
      && vectorsEqualFn(vec, V.times(V.linearPart(op), vec)));

  const stabilizer = ops.filter(goodOp);

  for (const A of stabilizer) {
    for (const B of stabilizer) {
      if (!goodOp(V.times(A, V.inverse(B)))) {
        return null;
      }
    }
  }

  return stabilizer.map(spacegroups.opModZ);
};


const nodeImages = (ops, equalFn) => (v, index) => {
  const { name, coordination, positionInput, positionPrimitive } = v;
  const stabilizer = pointStabilizer(positionPrimitive, ops, equalFn);
  const cosetReps = operatorCosets(ops, stabilizer);

  return cosetReps.map(op => ({
    pos: V.modZ(V.times(op, positionPrimitive)),
    degree: coordination,
    repIndex: index,
    operator: op
  }));
};


const edgeImages = (ops, nodes, pntsEqualFn, vecsEqualFn) => (e, index) => {
  const { from: { positionPrimitive: src },
          to: { positionPrimitive: dst } } = e;
  const vec = V.minus(dst, src);

  const stabilizer = edgeStabilizer(
    src, vec, ops, pntsEqualFn, vecsEqualFn)

  const cosetReps = operatorCosets(ops, stabilizer);

  return cosetReps
    .map(operator => {
      const from = V.modZ(V.times(operator, src));
      const to = V.plus(from, V.times(V.linearPart(operator), vec));

      return {
        from: lookupPointModZ(from, nodes, pntsEqualFn),
        to: lookupPointModZ(to, nodes, pntsEqualFn),
        repIndex: index,
        operator
      };
    });
};


const applyOpsToNodes = (nodes, ops, equalFn) =>
  flatMap(nodeImages(ops, equalFn), nodes)
  .map(({ pos, degree, repIndex, operator }, id) => ({
    id, pos, degree, repIndex, operator
  }))


const applyOpsToEdges = (edges, nodes, ops, pointsEqFn, vectorsEqFn) =>
  flatMap(edgeImages(ops, nodes, pointsEqFn, vectorsEqFn), edges)
  .map(({ from, to, repIndex, operator }, id) => ({
    id, from, to, repIndex, operator
  }));


const applyOpsToCorners = (faces, ops, pointsEqFn) => {
  const corners = [];

  for (const f of faces) {
    for (const p of f) {
      if (corners.findIndex(q => pointsEqFn(p, q)) < 0) {
        const stabilizer = pointStabilizer(p, ops, pointsEqFn);
        for (const op of operatorCosets(ops, stabilizer))
          corners.push(V.modZ(V.times(op, p)));
      }
    }
  }

  return corners;
};


const normalizedFace = face => {
  let best = null;
  let bestShift = null;

  const less = (f1, f2) => {
    for (const i in f1) {
      const d = f1[i].index - f2[i].index;
      if (d != 0)
        return d < 0;

      for (const j in f1[i].shift) {
        const d = f1[i].shift[j] - f2[i].shift[j];
        if (d != 0)
          return d < 0;
      }
    }
    return false;
  };

  for (const i in face) {
    const s = face[i].shift;
    const fa = face.slice(i).concat(face.slice(0, i))
      .map(({ index, shift }) => ({ index, shift: V.minus(shift, s) }));
    const fb = [fa[0]].concat(fa.slice(1).reverse());

    if (best == null || less(fa, best)) {
      best = fa;
      bestShift = s;
    }
    if (less(fb, best)) {
      best = fb;
      bestShift = s;
    }
  }

  return { face: best, shift: bestShift };
};


const applyOpsToFaces = (faces, corners, ops, pointsEqFn) => {
  const seen = {};
  const result = [];

  const lookup = p => {
    for (const i in corners) {
      const q = corners[i];
      if (pointsEqFn(p, q))
        return { index: i, shift: V.minus(p, q).map(x => V.round(x)) };
    }
    return [];
  };

  for (const f of faces) {
    for (const op of ops) {
      const fMapped = f.map(p => lookup(V.times(op, p)));
      const fNormal = normalizedFace(fMapped);
      const key = JSON.stringify(fNormal.face);

      if (!seen[key]) {
        seen[key] = true;
        result.push(fNormal);
      }
    }
  }

  return result;
};


const projection = (dir, origin) => p => {
  const d = V.minus(p, origin);
  return V.plus(origin, V.minus(d, V.times(V.times(dir, d), dir)));
};


const normalized = v => V.div(v, V.norm(v));


const sectorNormals = vs => {
  const n = vs.length;
  const edges = vs.map((v, i) => [v, vs[(i + 1) % n]]);
  const plus = (v, w) => V.plus(v, w);

  const faceNormal = normalized(
    edges.map(([v, w]) => V.crossProduct(v, w)).reduce(plus));
  const centroid = V.div(vs.reduce(plus), vs.length);

  const proj = projection(faceNormal, centroid);
  const midPoint = (v, w) => V.div(V.plus(v, w), 2);

  return edges.map(([v, w]) => {
    const c = midPoint(v, w);
    const d = midPoint(centroid, proj(c));
    return normalized(V.crossProduct(V.minus(w, v), V.minus(d, c)));
  });
};


const collectEdges = faces => {
  const facesAtEdge = {};

  faces.forEach(({ face, shift }, i) => {
    const n = face.length;
    const edges = face.map((v, i) => [v, face[(i + 1) % n]]);

    edges.forEach(([{index: v1, shift: s1}, {index: v2, shift: s2}], j) => {
      const key = JSON.stringify([v1, v2, V.minus(s2, s1)]);
      const keyInv = JSON.stringify([v2, v1, V.minus(s1, s2)]);

      if (facesAtEdge[key])
        facesAtEdge[key].push([i, j, false]);
      else if (facesAtEdge[keyInv])
        facesAtEdge[keyInv].push([i, j, true]);
      else
        facesAtEdge[key] = [[i, j, false]];
    });
  });

  return facesAtEdge;
};


const op2PairingsForPlainMode = (corners, faces, offsets) => {
  const explicitFaces = faces.map(f => f.face.map(
    item => V.plus(V.vector(corners[item.index]), item.shift)));

  const normals = explicitFaces.map(sectorNormals)
  const facesAtEdge = collectEdges(faces);
  const getNormal = ([i, j, rev]) => V.times(normals[i][j], rev ? -1 : 1);

  const result = [];
  for (const key of Object.keys(facesAtEdge)) {
    const [v, w, s] = JSON.parse(key);
    const d = normalized(V.minus(V.plus(corners[w], s), corners[v]));
    const n0 = getNormal(facesAtEdge[key][0]);

    const incidences = facesAtEdge[key].map(([i, j, reverse]) => {
      const n = getNormal([i, j, reverse]);
      const angle = Math.acos(Math.max(-1, Math.min(1, V.times(n0, n))));

      if (V.lt(V.determinant(V.cleanup([d, n0, n])), 0))
        return [i, j, reverse, 2 * Math.PI - angle];
      else
        return [i, j, reverse, angle];
    });

    incidences.sort((a, b) => a[3] - b[3]);
    const m = incidences.length;

    incidences.forEach(([face1, edge1, rev1, angle1], i) => {
      const [face2, edge2, rev2, angle2] = incidences[(i + 1) % m];
      const [offset1, size1] = [offsets[face1], faces[face1].face.length];
      const [offset2, size2] = [offsets[face2], faces[face2].face.length];

      let a, b, c, d;

      if (rev1) {
        const k = offset1 + 2 * (size1 + edge1);
        a = k + 1;
        b = k;
      } else {
        const k = offset1 + 2 * edge1;
        a = k;
        b = k + 1;
      }

      if (rev2) {
        const k = offset2 + 2 * edge2;
        c = k + 1;
        d = k;
      } else {
        const k = offset2 + 2 * (size2 + edge2);
        c = k;
        d = k + 1;
      }

      result.push([a, c]);
      result.push([b, d]);
    });
  }

  return result;
};


const buildTiling = (corners, faces) => {
  const pairings = [[], [], [], []];
  const faceOffsets = [];
  let offset = 1;

  for (const { face } of faces) {
    const n = face.length;

    for (let i = 0; i < 4 * n; i += 2)
      pairings[0].push([offset + i, offset + i + 1]);

    for (let i = 1; i < 2 * n; i += 2) {
      const i1 = (i + 1) % (2 * n);
      pairings[1].push([offset + i, offset + i1]);
      pairings[1].push([offset + i + 2 * n, offset + i1 + 2 * n]);
    }

    for (let i = 0; i < 2 * n; ++i)
      pairings[3].push([offset + i, offset + i + 2 * n]);

    faceOffsets.push(offset);
    offset += 4 * n;
  }

  pairings[2] = op2PairingsForPlainMode(corners, faces, faceOffsets);

  return delaney.build(3, offset - 1,
                       (ds, i) => pairings[i],
                       (ds, i) => ds.elements().map(D => [D, 1]));
};


const convertEdge = ({ from, to }) =>
  [from.node, to.node, V.minus(to.shift, from.shift)];


const degreesSatisfied = (nodes, edges) => {
  const left = nodes.map(v => v.degree);
  for (const [i, j, _] of edges) {
    --left[i];
    --left[j];
  }

  return left.every(n => n <= 0);
};


const withInducedEdges = (nodes, givenEdges, gram) =>
  fromPointCloud(nodes, givenEdges, dotProduct(gram));


export function netFromCrystal(spec) {
  _timers && _timers.start('netFromCrystal');

  const { name, group, cellGram: G0, nodes, edges } = spec;
  const warnings = spec.warnings.slice();
  const errors = spec.errors.slice();

  if (group.error) {
    errors.push(group.error);
    return { warnings, errors };
  }

  const { name: groupName, transform, operators } = group;
  const cellGram = spacegroups.resymmetrizedGramMatrix(G0, operators);
  if (matrixError(cellGram, G0) > 0.01) {
    warnings.push(`Unit cell resymmetrized to ${unitCellParameters(cellGram)}`);
  }

  const primitive = spacegroups.primitiveSetting(operators);
  const toPrimitive = primitive.fromStd.oldToNew;
  const primitiveGram = spacegroups.resymmetrizedGramMatrix(
    V.times(primitive.cell, V.times(cellGram, V.transposed(primitive.cell))),
    primitive.ops);

  const nodesMapped = nodes.map(mapNode(toPrimitive));
  const edgesMapped = edges.map(mapEdge(toPrimitive, nodesMapped));

  const pointsEq = pointsAreCloseModZ(primitiveGram, 0.001);
  const vectorsEq = vectorsAreClose(primitiveGram, 0.001);

  const allNodes = applyOpsToNodes(
    nodesMapped, primitive.ops, pointsEq);
  const explicitEdges = applyOpsToEdges(
    edgesMapped, allNodes, primitive.ops, pointsEq, vectorsEq);

  const convertedEdges = explicitEdges.map(convertEdge);
  const allEdges = degreesSatisfied(allNodes, convertedEdges)
    ? convertedEdges
    : withInducedEdges(allNodes, convertedEdges, primitiveGram);
  const graph = pg.make(allEdges);

  _timers && _timers.stop('netFromCrystal');

  return {
    name,
    group: group.name,
    cellGram,
    primitiveCell: primitive.cell,
    primitiveGram,
    toPrimitive,
    nodeReps: nodesMapped,
    explicitEdgeReps: edgesMapped,
    nodes: allNodes,
    explicitEdges,
    graph,
    warnings,
    errors
  };
};


export const tilingFromFacelist = spec => {
  _timers && _timers.start('tilingFromFacelist');

  const { name, group, cellGram: G0, faces, tiles } = spec;
  const warnings = spec.warnings.slice();
  const errors = spec.errors.slice();

  if (group.error) {
    errors.push(group.error);
    return { warnings, errors };
  }

  const { name: groupName, transform, operators } = group;
  const cellGram = spacegroups.resymmetrizedGramMatrix(G0, operators);
  if (matrixError(cellGram, G0) > 0.01) {
    warnings.push(`Unit cell resymmetrized to ${unitCellParameters(cellGram)}`);
  }

  const primitive = spacegroups.primitiveSetting(operators);
  const toPrimitive = primitive.fromStd.oldToNew;
  const primitiveGram = spacegroups.resymmetrizedGramMatrix(
    V.times(primitive.cell, V.times(cellGram, V.transposed(primitive.cell))),
    primitive.ops);

  const facesMapped = faces.map(
    f => f.map(p => V.times(toPrimitive, V.point(p))));

  const pointsEq = pointsAreCloseModZ(primitiveGram, 0.001);
  const allCorners = applyOpsToCorners(facesMapped, primitive.ops, pointsEq);
  const allFaces = applyOpsToFaces(
    facesMapped, allCorners, primitive.ops, pointsEq);

  const ds = buildTiling(allCorners, allFaces);

  // TODO also support the case were tiles are given explicitly

  _timers && _timers.stop('tilingFromFacelist');

  return {
    name,
    group: group.name,
    cellGram,
    primitiveCell: primitive.cell,
    primitiveGram,
    toPrimitive,
    symbol: derived.minimal(ds),
    cover: ds,
    warnings,
    errors
  };
};


if (require.main == module) {
  const cgd = require('./cgd');
  const pgr = require('../pgraphs/periodic');
  const sym = require('../pgraphs/symmetries');
  const inv = require('../pgraphs/invariant');

  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const invariant = G => {
    if (sym.isMinimal(G))
      return inv.invariant(G);
    else
      return inv.invariant(sym.minimalImage(G));
  };

  const input = `
CRYSTAL
  NAME srs
  GROUP I4132
  CELL 2.82843 2.82843 2.82843 90.0000 90.0000 90.0000
  NODE 1 3  0.12500 0.12500 0.12500
  EDGE  0.12500 0.12500 0.12500   0.12500 -0.12500 0.37500
END

CRYSTAL
  NAME dia
  GROUP Fd-3m:2
  CELL 2.30940 2.30940 2.30940 90.0000 90.0000 90.0000
  NODE 1 4  0.12500 0.12500 0.62500
  EDGE  0.12500 0.12500 0.62500   0.37500 0.37500 0.37500
END

CRYSTAL
  NAME pcu
  GROUP Pm-3m
  CELL 1.00000 1.00000 1.00000 90.0000 90.0000 90.0000
  NODE 1 6  0.00000 0.00000 0.00000
  EDGE  0.00000 0.00000 0.00000   0.00000 0.00000 1.00000
END

CRYSTAL
  NAME bcu
  GROUP Im-3m
  CELL 1.15470 1.15470 1.15470 90.0000 90.0000 90.0000
  NODE 1 8  0.00000 0.00000 0.00000
  EDGE  0.00000 0.00000 0.00000   0.50000 0.50000 0.50000
END

CRYSTAL
  NAME nbo
  GROUP Im-3m
  CELL 2.00000 2.00000 2.00000 90.0000 90.0000 90.0000
  NODE 1 4  0.00000 0.00000 0.50000
  EDGE  0.00000 0.00000 0.50000   0.00000 0.50000 0.50000
END
`;

  for (const b of cgd.default(input)) {
    for (const key in b) {
      console.log(`${key}:`);

      const val = b[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item.constructor == Object) {
            for (const k in item) {
              console.log(`    ${k}: ${JSON.stringify(item[k])}`);
            }
            console.log();
          }
          else {
            console.log(`    ${JSON.stringify(item)}`);
          }
        }
      }
      else {
        console.log(`    ${JSON.stringify(val)}`);
      }
      console.log();
    }

    console.log('invariant:');
    const inv = invariant(b.graph);
    for (const [head, tail, shift] of inv) {
      console.log(`    ${head} ${tail} ${shift.join(' ')}`);
    }

    console.log();
    console.log();
  }
};
