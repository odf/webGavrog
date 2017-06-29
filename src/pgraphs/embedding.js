import * as pg from './periodic';
import * as symmetries from './symmetries';
import * as sg from '../geometry/spacegroups';
import Partition from '../common/partition';
import amoeba from '../algorithms/amoeba';

import { matrices } from '../arithmetic/types';
const ops = matrices;


let _timers = null;

export function useTimers(timers) {
  _timers = timers;
};


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


const _coordinateParametrization = (graph, syms) => {
  const positions = pg.barycentricPlacement(graph);

  const nodeInfo = {};
  let next = 0;

  for (const v of pg.vertices(graph)) {
    if (nodeInfo[v] != null)
      continue;

    const pv = positions.get(v);
    const sv = _nodeSymmetrizer(v, syms, positions);
    const cv = _normalizedInvariantSpace(sv);

    nodeInfo[v] = {
      index: next,
      configSpace: ops.toJS(cv),
      symmetrizer: sv,
      isRepresentative: true
    };

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

      nodeInfo[w] = { index: next, configSpace: ops.toJS(cw), symmetrizer: sw };
    }

    next += cv.length - 1;
  }

  return nodeInfo;
};


const _last = a => a.slice(-1)[0];


const _positionFromParameters = (parms, cfg) => {
  const n = parms.length;
  let p = cfg[n].slice(0, -1);

  if (cfg.length > 1) {
    for (let i = 0; i < n; ++i) {
      for (let j = 0; j < p.length; ++j)
        p[j] += parms[i] * cfg[i][j];
    }
  }

  return p;
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
  const n = Math.sqrt(2 * cfg[0].length + 0.25) - 0.5;
  const G = ops.matrix(n, n);

  let k = 0;

  for (let i = 0; i < n; ++i) {
    for (let j = i; j < n; ++j) {
      let x = 0;
      for (let mu = 0; mu < parms.length; ++mu)
        x += parms[mu] * cfg[mu][k];

      G[i][j] = G[j][i] = x;
      ++k;
    }
  }

  for (let i = 0; i < n; ++i)
    G[i][i] = Math.max(G[i][i], 0);

  for (let i = 0; i < n; ++i) {
    for (let j = i + 1; j < n; ++j)
      G[i][j] = G[j][i] = Math.min(G[i][j], Math.sqrt(G[i][i] * G[j][j]));
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
    const { configSpace, symmetrizer, isRepresentative} = positionSpace[v];
    if (isRepresentative) {
      const pos = positions.get(v);
      pieces.push(_parametersForPosition(pos, configSpace, symmetrizer));
    }
  }

  return Array.concat.apply(null, pieces);
};


const _angleOrbits = (graph, syms, adj, pos) => {
  const seen = {};
  let p = Partition();

  for (const v of pg.vertices(graph)) {
    for (const [inc1, inc2] of _pairs(pg.allIncidences(graph, v, adj))) {
      const u = inc1.tail;
      const w = inc2.tail;
      const s = ops.minus(inc2.shift, inc1.shift);

      const a = pg.makeEdge(u, w, s).canonical();
      const ka = encode(a);

      if (seen[ka])
        continue;

      seen[ka] = true;

      for (const phi of syms) {
        const ux = phi.src2img[u];
        const wx = phi.src2img[w];
        const t = phi.transform;

        const c = ops.plus(s, ops.minus(pos.get(w), pos.get(u)));
        const d = ops.minus(pos.get(wx), pos.get(ux));
        const sx = ops.minus(ops.times(c, t), d);

        const b = pg.makeEdge(ux, wx, sx).canonical();
        const kb = encode(b);

        seen[kb] = true;
        p = p.union(ka, kb);
      }
    }
  }

  return p.classes(Object.keys(seen)).map(cl => cl.map(decode));
};


const _edgeLength = (params, positionSpace, gram, fixedPositions) => {
  const position = fixedPositions ?
    v => fixedPositions[v] :
    v => {
      const { index, configSpace } = positionSpace[v];
      const paramsForV = params.slice(index, index + configSpace.length - 1);

      return _positionFromParameters(paramsForV, configSpace);
    };

  return edge => {
    const pv = position(edge.head);
    const pw = position(edge.tail);
    const diff = pv.map((_, i) => pw[i] + edge.shift[i] - pv[i]);

    let s = 0;
    for (let i = 0; i < diff.length; ++i) {
      s += gram[i][i] * diff[i] * diff[i];
      for (let j = i + 1; j < diff.length; ++j)
        s += 2 * gram[i][j] * diff[i] * diff[j];
    }

    return Math.sqrt(Math.max(0, s));
  };
};


const sum = v => v.reduce((x, y) => x + y);


const determinant = M => {
  if (M.length == 2)
    return M[0][0] * M[1][1] - M[0][1] * M[1][0];
  else if (M.length == 3)
    return (+ M[0][0] * M[1][1] * M[2][2]
            + M[0][1] * M[1][2] * M[2][0]
            + M[0][2] * M[1][0] * M[2][1]
            - M[0][2] * M[1][1] * M[2][0]
            - M[0][1] * M[1][0] * M[2][2]
            - M[0][0] * M[1][2] * M[2][1]);
  else
    return ops.determinant(M);
};


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

    const cellVolumePerNode = ops.sqrt(determinant(gram)) *
      Math.pow(scaling, 3) / Object.keys(positionSpace).length;

    const volumePenalty = Math.exp(1 / Math.max(cellVolumePerNode, 1e-12)) - 1;

    return (edgeVariance +
            volumeWeight * volumePenalty +
            penaltyWeight * penalty);
  };
};


const embed = g => {
  const positions = pg.barycentricPlacement(g);

  const syms = symmetries.symmetries(g).symmetries;
  const symOps = syms.map(a => a.transform);

  _timers && _timers.start('embed');

  _timers && _timers.start('embed: edge and angle orbits');
  const angleOrbits = _angleOrbits(g, syms, pg.adjacencies(g), positions);
  const edgeOrbits = symmetries.edgeOrbits(g, syms);
  _timers && _timers.stop('embed: edge and angle orbits');

  _timers && _timers.start('embed: position space');
  const posSpace = _coordinateParametrization(g, syms);
  _timers && _timers.stop('embed: position space');

  _timers && _timers.start('embed: gram space');
  const gramSpace = ops.toJS(sg.gramMatrixConfigurationSpace(symOps));
  _timers && _timers.stop('embed: gram space');

  _timers && _timers.start('embed: gram matrix');
  const I = ops.identityMatrix(g.dim);
  const gram = sg.resymmetrizedGramMatrix(I, symOps);
  _timers && _timers.stop('embed: gram matrix');

  _timers && _timers.start('embed: start parameters');
  const startParams = ops.toJS(_parametersForConfiguration(
    g, gram, positions, gramSpace, posSpace, symOps));
  _timers && _timers.stop('embed: start parameters');

  _timers && _timers.start('embed: optimizing');

  let params = startParams;

  for (let pass = 0; pass < 3; ++pass) {
    const volumeWeight = Math.pow(10, -pass);
    const penaltyWeight = pass == 2 ? 1 : 0;

    const energy = _energyEvaluator(
      posSpace, gramSpace,
      edgeOrbits, angleOrbits,
      volumeWeight, penaltyWeight);

    const result = amoeba(energy, params.length, params, 10000, 1e-6, 0.1);
    params = result.position;

    console.log(`  pass ${pass} used ${result.steps} iterations`);
  }
  console.log();

  _timers && _timers.stop('embed: optimizing');
  _timers && _timers.stop('embed');

  return {
    initial: _configurationFromParameters(g, startParams, gramSpace, posSpace),
    relaxed: _configurationFromParameters(g, params, gramSpace, posSpace)
  };
};


export default embed;


if (require.main == module) {
  const cgd = require('../io/cgd');
  const util = require('../common/util');
  const crystal = require('../io/crystal');

  Array.prototype.toString = function() {
    return `[ ${this.map(x => x.toString()).join(', ')} ]`;
  };

  const timers = util.timers();

  useTimers(timers);
  pg.useTimers(timers);
  symmetries.useTimers(timers);
  crystal.useTimers(timers);

  _timers.start('total');

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
    _timers.stop('total');
    console.log(`${JSON.stringify(_timers.current(), null, 2)}`);
    _timers.start('total');
    console.log();
  };

  test(cgd.processed(cgd.blocks(
    `
CRYSTAL
  NAME sig
  GROUP P42/mnm
  CELL 8.25860 8.25860 4.36826 90.0000 90.0000 90.0000
  NODE 1 4  0.00000 0.50000 0.25000
  NODE 2 4  0.40734 0.59266 0.00000
  NODE 3 4  0.23973 0.76027 0.00000
  NODE 4 4  0.29203 0.55570 0.00000
  NODE 5 4  0.20843 0.64330 0.00000
  NODE 6 4  0.07192 0.15755 0.00000
  NODE 7 4  0.10640 0.27362 0.00000
  NODE 8 4  0.22247 0.30809 0.00000
  NODE 9 4  0.04281 0.04281 0.31388
  NODE 10 4  0.31194 0.31194 0.31747
  NODE 11 4  0.39369 0.39369 0.38554
  NODE 12 4  0.26435 0.49143 0.18682
  NODE 13 4  0.13325 0.36497 0.31893
  NODE 14 4  0.00484 0.13583 0.18611
  NODE 15 4  0.04825 0.31743 0.18293
  NODE 16 4  0.02601 0.59405 0.11446
  NODE 17 4  0.23300 0.37449 0.19040
  EDGE  0.07192 0.15755 0.00000   0.15755 0.07192 0.00000
  EDGE  0.23300 0.37449 0.19040   0.13325 0.36497 0.31893
  EDGE  0.29203 0.55570 0.00000   0.40734 0.59266 0.00000
  EDGE  0.07192 0.15755 0.00000   0.00484 0.13583 0.18611
  EDGE  0.02601 0.59405 0.11446   0.02601 0.59405 -0.11446
  EDGE  0.40734 0.59266 0.00000   0.45719 0.54281 0.18612
  EDGE  0.22247 0.30809 0.00000   0.23300 0.37449 0.19040
  EDGE  0.00484 0.13583 0.18611   -0.10631 0.10631 0.11446
  EDGE  0.13325 0.36497 0.31893   0.09405 0.47399 0.38554
  EDGE  0.07192 0.15755 0.00000   0.10640 0.27362 0.00000
  EDGE  0.20843 0.64330 0.00000   0.23973 0.76027 0.00000
  EDGE  0.00484 0.13583 0.18611   0.04281 0.04281 0.31388
  EDGE  0.23973 0.76027 0.00000   0.18806 0.81194 0.18253
  EDGE  0.00484 0.13583 0.18611   -0.00857 0.23565 0.31318
  EDGE  0.04281 0.04281 0.31388   -0.04281 -0.04281 0.31388
  EDGE  0.04825 0.31743 0.18293   0.13325 0.36497 0.31893
  EDGE  0.29203 0.55570 0.00000   0.26435 0.49143 0.18682
  EDGE  0.23300 0.37449 0.19040   0.31194 0.31194 0.31747
  EDGE  0.10640 0.27362 0.00000   0.04825 0.31743 0.18293
  EDGE  0.04825 0.31743 0.18293   -0.00857 0.23565 0.31318
  EDGE  0.29203 0.55570 0.00000   0.20843 0.64330 0.00000
  EDGE  0.04825 0.31743 0.18293   -0.02601 0.40595 0.11446
  EDGE  0.23300 0.37449 0.19040   0.26435 0.49143 0.18682
  EDGE  0.20843 0.64330 0.00000   0.13503 0.63325 0.18107
  EDGE  0.31194 0.31194 0.31747   0.39369 0.39369 0.38554
  EDGE  0.22247 0.30809 0.00000   0.30809 0.22247 0.00000
  EDGE  0.00000 0.50000 0.25000   0.02601 0.59405 0.11446
  EDGE  0.39369 0.39369 0.38554   0.39369 0.39369 0.61446
  EDGE  0.10640 0.27362 0.00000   0.22247 0.30809 0.00000
END
    `
  )[0]).graph);


  console.log('----------------------------------------');
}
