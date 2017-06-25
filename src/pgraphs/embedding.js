import * as pg from './periodic';
import * as symmetries from './symmetries';
import * as sg from '../geometry/spacegroups';
import Partition from '../common/partition';
import amoeba from '../algorithms/amoeba';

import { matrices } from '../arithmetic/types';
const ops = matrices;


const encode = value => pg.ops.serialize(value);
const decode = value => pg.ops.deserialize(value);


const _avg = xs => ops.div(xs.reduce((a, b) => ops.plus(a, b)), xs.length);


const _projectiveMatrix = (linear, shift) =>
  linear.map(row => row.concat(0)).concat([shift.concat(1)]);


const _nodeSymmetrizer = (v, syms, positions) => {
  const stab = syms.filter(a => a.src2img[v] == v).map(phi => phi.transform);
  const pos = positions.get(v);
  const dim = ops.dimension(pos);

  const s = _avg(stab.map(a => a.concat([ops.minus(pos, ops.times(pos, a))])));
  const m = s.slice(0, dim);
  const t = s[dim];

  if (ops.ne(ops.plus(ops.times(pos, m), t), pos))
    throw Error(`${pos} * ${[m, t]} = ${ops.plus(ops.times(pos, m), t)}`);

  return _projectiveMatrix(m, t);
};


const _normalizedInvariantSpace = P => {
  const I = ops.identityMatrix(ops.dimension(P));
  const A = ops.transposed(ops.nullSpace(ops.transposed(ops.minus(P, I))));

  const [nr, nc] = ops.shape(A);
  const k = A.findIndex(r => ops.ne(r[nc - 1], 0));

  if (k >= 0) {
    const t = ops.div(A[k], A[k][nc - 1]);
    A[k] = A[nr - 1];
    A[nr - 1] = t;

    for (let i = 0; i < nr - 1; ++i)
      A[i] = ops.minus(A[i], ops.times(A[nr - 1], A[i][nc - 1]));
  }

  if (ops.ne(ops.times(A, P), A))
    throw Error(`${A} * ${P} = ${ops.times(A, P)}`);

  return A;
};


const _coordinateParametrization = graph => {
  const syms = symmetries.symmetries(graph).symmetries;
  const positions = pg.barycentricPlacement(graph);

  const nodeInfo = {};
  let next = 0;

  for (const v of pg.vertices(graph)) {
    if (nodeInfo[v] != null)
      continue;

    const pv = positions.get(v);
    const sv = _nodeSymmetrizer(v, syms, positions);
    const cv = _normalizedInvariantSpace(sv);

    nodeInfo[v] = { index: next, configSpace: cv, symmetrizer: sv };

    for (const sym of syms) {
      const w = sym.src2img[v];

      if (nodeInfo[w] != null)
        continue;

      const pw = positions.get(w);

      const a = sym.transform;
      const t = _projectiveMatrix(a, ops.minus(pw, ops.times(pv, a)));

      const cw = ops.times(cv, t);
      const sw = _nodeSymmetrizer(w, syms, positions);

      if (ops.ne(ops.times(cw, sw), cw))
        throw Error(`${cw} * ${sw} = ${ops.times(cw, sw)}`);

      nodeInfo[w] = { index: next, configSpace: cw, symmetrizer: sw };
    }

    next += cv.length - 1;
  }

  return nodeInfo;
};


const _last = a => a.slice(-1)[0];


const _positionFromParameters = (parms, cfg) => {
  if (cfg.length > 1) {
    const M = cfg.slice(0, -1);
    return ops.plus(_last(cfg), ops.times(parms, M)[0]).slice(0, -1);
  }
  else
    return cfg[0].slice(0, -1);
};


const _parametersForPosition = (pos, cfg, symmetrizer) => {
  if (cfg.length > 1) {
    const M = cfg.slice(0, -1);
    const p = ops.minus(ops.times(pos.concat(1), symmetrizer), _last(cfg));
    return ops.transposed(
      ops.solution(ops.transposed(M), ops.transposed(p)))[0];
  }
  else
    return [];
};


const _gramMatrixFromParameters = (parms, cfg) => {
  const a = ops.times(parms, cfg);
  const n = Math.sqrt(2 * a.length + 0.25) - 0.5;

  const G = ops.matrix(n, n);
  let k = 0;

  for (let i = 0; i < n; ++i) {
    for (let j = i; j < n; ++j) {
      G[i][j] = G[j][i] = a[k];
      ++k;
    }
  }

  for (let i = 0; i < n; ++i) {
    if (ops.lt(G[i][i], 0))
      G[i][i] = 0;
  }

  for (let i = 0; i < n; ++i) {
    for (let j = i + 1; j < n; ++j) {
      const t = ops.sqrt(ops.times(G[i][i], G[j][j]));
      if (ops.gt(G[i][j], t))
        G[i][j] = G[j][i] = t;
    }
  }

  return G;
};



const _parametersForGramMatrix = (gram, cfg, syms) => {
  const G = sg.resymmetrizedGramMatrix(gram, syms);
  const n = ops.shape(G)[0];

  const a = [];
  for (let i = 0; i < n; ++i) {
    for (let j = i; j < n; ++j) {
      a.push(G[i][j]);
    }
  }

  return ops.transposed(
    ops.solution(ops.transposed(cfg), ops.transposed(a)))[0];
};


function* _pairs(list) {
  for (const i in list)
    for (const j in list)
      if (j > i)
        yield [list[i], list[j]];
};


const _configurationFromParameters = (
  graph,
  params,
  gramSpace,
  positionSpace
) => {
  const gramParams = params.slice(0, gramSpace.length);
  const gram = _gramMatrixFromParameters(gramParams, gramSpace);

  const positions = {};
  for (const v of pg.vertices(graph)) {
    const { index, configSpace } = positionSpace[v];
    const start = gramSpace.length + index;
    const stop = start + configSpace.length - 1;
    const slice = params.slice(start, stop);

    positions[v] = _positionFromParameters(slice, configSpace);
  }

  return { gram, positions };
};


const _parametersForConfiguration = (
  graph,
  gram,
  positions,
  gramSpace,
  positionSpace,
  symOps
) => {
  const pieces = [_parametersForGramMatrix(gram, gramSpace, symOps)];

  for (const v of pg.vertices(graph)) {
    const pos = positions.get(v);
    const { configSpace, symmetrizer } = positionSpace[v];
    pieces.push(_parametersForPosition(pos, configSpace, symmetrizer));
  }

  return Array.concat.apply(null, pieces);
};


const _angleOrbits = (graph, syms, adj, pos) => {
  const angles = [];
  let p = Partition();

  for (const v of pg.vertices(graph)) {
    for (const [inc1, inc2] of _pairs(pg.allIncidences(graph, v, adj))) {
      const u = inc1.tail;
      const w = inc2.tail;
      const s = ops.minus(inc2.shift, inc1.shift);
      const a = pg.makeEdge(u, w, s).canonical();
      angles.push(a);

      for (const phi of syms) {
        const ux = phi.src2img[u];
        const wx = phi.src2img[w];

        const t = phi.transform;
        const du = ops.minus(ops.times(pos.get(u), t), pos.get(ux));
        const dw = ops.minus(ops.times(pos.get(w), t), pos.get(wx));
        const sx = ops.plus(ops.times(s, t), ops.minus(dw, du));

        const b = pg.makeEdge(ux, wx, sx).canonical();
        p = p.union(encode(a), encode(b));
      }
    }
  }

  return p.classes(angles.map(encode)).map(cl => cl.map(decode));
};


const innerProduct = gram => {
  const G = ops.toJS(gram);

  return (v, w) => {
    let s = 0;
    for (const i in v)
      for (const j in w)
        s += v[i] * G[i][j] * w[j];
    return s;
  };
};


const _edgeLength = (params, positionSpace, gram, fixedPositions) => {
  const position = fixedPositions ?
    v => fixedPositions[v] :
    v => {
      const { index, configSpace } = positionSpace[v];
      const paramsForV = params.slice(index, index + configSpace.length - 1);

      return _positionFromParameters(paramsForV, configSpace);
    };

  const dot = innerProduct(gram);

  return edge => {
    const pv = position(edge.head);
    const pw = position(edge.tail);
    const diff = ops.toJS(ops.minus(ops.plus(pw, edge.shift), pv));

    return Math.sqrt(Math.max(0, dot(diff, diff)));
  };
};


const sum = v => v.reduce((x, y) => x + y);


const _energyEvaluator = (
  positionSpace,
  gramSpace,
  edgeOrbits,
  angleOrbits,
  volumeWeight,
  penaltyWeight,
  fixedPositions=null
) => {
  return params => {
    const gramParams = params.slice(0, gramSpace.length);
    const positionParams = params.slice(gramSpace.length);

    const gram = _gramMatrixFromParameters(gramParams, gramSpace);

    const edgeLength = _edgeLength(
      positionParams, positionSpace, gram, fixedPositions);

    const weightedLengths = edgeOrbits.concat(angleOrbits).map(orb => ({
      length: edgeLength(orb[0]),
      weight: orb.length
    }));

    const weightedEdgeLengths = weightedLengths.slice(0, edgeOrbits.length);
    const edgeWeightSum = sum(weightedEdgeLengths.map(({ weight }) => weight));

    const avgEdgeLength = 1.0 / edgeWeightSum * sum(
      weightedEdgeLengths.map(({ length, weight }) => length * weight));

    const scaling = avgEdgeLength > 1e-12 ? 1.01 / avgEdgeLength : 1.01;

    const edgeVariance = sum(weightedEdgeLengths.map(({ length, weight }) => {
      const scaledLength = length * scaling;
      const t = 1 - scaledLength * scaledLength;
      return t * t * weight / edgeWeightSum;
    }));

    const penalty = sum(weightedLengths.map(({ length, weight }) => {
      const scaledLength = length * scaling;
      if (scaledLength < 0.5) {
        const x = Math.max(scaledLength, 1e-12);
        return Math.exp(Math.tan((0.25 - x) * 2.0 * Math.PI)) * weight;
      }
      else
        return 0.0;
    }));

    const nrNodes = Object.keys(positionSpace).length;
    const gramScaled = ops.times(gram, scaling * scaling);
    const cellVolumePerNode = ops.sqrt(ops.determinant(gramScaled)) / nrNodes;
    const volumePenalty = Math.exp(1 / Math.max(cellVolumePerNode, 1e-12)) - 1;

    return (edgeVariance +
            volumeWeight * volumePenalty +
            penaltyWeight * penalty);
  };
};


const embed = g => {
  const syms = symmetries.symmetries(g).symmetries;
  const symOps = syms.map(a => a.transform);
  const positions = pg.barycentricPlacement(g);
  const angleOrbits = _angleOrbits(g, syms, pg.adjacencies(g), positions);
  const edgeOrbits = symmetries.edgeOrbits(g);

  const posSpace = _coordinateParametrization(g);
  const gramSpace = sg.gramMatrixConfigurationSpace(symOps);

  const I = ops.identityMatrix(g.dim);
  const gram = sg.resymmetrizedGramMatrix(I, symOps);

  const startParams = ops.toJS(_parametersForConfiguration(
    g, gram, positions, gramSpace, posSpace, symOps));

  let params = startParams;

  for (let pass = 0; pass < 3; ++pass) {
    const volumeWeight = Math.pow(10, -pass);
    const penaltyWeight = pass == 2 ? 1 : 0;

    const energy = _energyEvaluator(
      posSpace, gramSpace,
      edgeOrbits, angleOrbits,
      volumeWeight, penaltyWeight);

    params = amoeba(energy, params.length, params, 1000, 1e-6, 0.1).position;
  }

  return {
    initial: _configurationFromParameters(g, startParams, gramSpace, posSpace),
    relaxed: _configurationFromParameters(g, params, gramSpace, posSpace)
  };
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return `[ ${this.map(x => x.toString()).join(', ')} ]`;
  };

  const test = g => {
    console.log('----------------------------------------');
    console.log();
    console.log();

    console.log(`vertices: ${pg.vertices(g)}`);
    console.log('edges:');
    for (const e of g.edges)
      console.log(`  ${e}`);
    console.log();


    if (pg.isConnected(g) && pg.isLocallyStable(g)) {
      const embeddings = embed(g);

      console.log(`  initial gram: ${embeddings.initial.gram}`);
      console.log(`  initial positions:`);
      for (const v of Object.keys(embeddings.initial.positions))
        console.log(`    ${v} -> ${embeddings.initial.positions[v]}`);
      console.log();

      console.log(`  relaxed gram: ${embeddings.relaxed.gram}`);
      console.log(`  relaxed positions:`);
      for (const v of Object.keys(embeddings.relaxed.positions))
        console.log(`    ${v} -> ${embeddings.relaxed.positions[v]}`);
      console.log();
    }

    console.log();
  };

  // dia
  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 1, 2, [ 0, 1, 0 ] ],
                 [ 1, 2, [ 0, 0, 1 ] ] ]));

  // nbo
  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 2, 1, [ 1, 0, 0 ] ],
                 [ 2, 3, [ 0, 0, 0 ] ],
                 [ 3, 2, [ 0, 1, 0 ] ],
                 [ 3, 1, [ 0, 0, 1 ] ],
                 [ 3, 1, [ 1, 1, -1 ] ] ]));

  // ths
  test(pg.make([ [ 1, 2, [ 0, 0, 0 ] ],
                 [ 1, 2, [ 1, 0, 0 ] ],
                 [ 1, 3, [ 0, 0, 0 ] ],
                 [ 2, 4, [ 0, 0, 0 ] ],
                 [ 3, 4, [ 0, 0, 1 ] ],
                 [ 3, 4, [ 0, 1, 0 ] ] ]));

  // flu
  test(pg.make([ [ 1, 3, [ -1, -1,  1 ] ],
                 [ 1, 3, [ -1,  0,  1 ] ],
                 [ 1, 3, [  0, -1,  1 ] ],
                 [ 1, 3, [  0,  0,  0 ] ],
                 [ 2, 3, [ -1,  0,  1 ] ],
                 [ 2, 3, [ -1,  1,  0 ] ],
                 [ 2, 3, [  0,  0,  0 ] ],
                 [ 2, 3, [  0,  1,  0 ] ] ]));

  console.log('----------------------------------------');
}
