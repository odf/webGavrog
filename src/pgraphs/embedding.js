import * as pg from './periodic';
import * as symmetries from './symmetries';
import * as stats from './statistics';
import * as sg from '../spacegroups/spacegroups';
import * as unitCells from '../spacegroups/unitCells';
import amoeba from '../common/amoeba';

import {
  rationalLinearAlgebra as opsQ,
  numericalLinearAlgebra as opsF
} from '../arithmetic/types';


const last = a => a[a.length - 1];
const id = dim => opsQ.identityMatrix(dim);
const sumBy = (xs, fn) => xs.reduce((a, x, i) => a + fn(x, i), 0);


const mapObject = (obj, fn) => {
  const out = {};
  for (const k of Object.keys(obj))
    out[k] = fn(obj[k]);
  return out;
};


const dotProduct = gram => (v, w) => {
  let s = 0;
  for (const i in v)
    for (const j in w)
      s += v[i] * gram[i][j] * w[j];
  return s;
};


const det = M => {
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
    return opsF.determinant(M);
};


const projectiveMatrix = (linear, shift) =>
  linear.map(row => row.concat(0)).concat([shift.concat(1)]);


const nodeSymmetrizer = (v, syms, pos) => {
  const stab = syms.filter(a => a.src2img[v] == v).map(phi => phi.transform);
  const m = opsQ.div(stab.reduce((a, b) => opsQ.plus(a, b)), stab.length);
  const t = opsQ.minus(pos, opsQ.times(pos, m));

  return projectiveMatrix(m, t);
};


const coordinateParametrization = (graph, syms) => {
  const positions = pg.barycentricPlacement(graph);
  const I = opsQ.identityMatrix(graph.dim + 1);
  const rot = A => A.slice().reverse().map(row => row.slice().reverse());
  const normalized = A => rot(opsQ.reducedBasis(rot(A), null));

  const nodeInfo = {};
  let next = 0;

  for (const orb of symmetries.nodeOrbits(graph, syms)) {
    const v = orb[0];
    const pv = positions[v];
    const sv = nodeSymmetrizer(v, syms, pv);
    const cv = normalized(opsQ.leftNullSpace(opsQ.minus(sv, I)));
    const lv = cv.length;

    for (const sym of syms) {
      const w = sym.src2img[v];

      if (!nodeInfo[w]) {
        const pw = positions[w];
        const sw = nodeSymmetrizer(w, syms, pw);
        const a  = sym.transform;
        const t  = projectiveMatrix(a, opsQ.minus(pw, opsQ.times(pv, a)));
        const cw = opsQ.times(cv, t);
        const cp = lv == 1 ? [[]] : opsQ.solve(cw.slice(0, -1), id(lv - 1))

        if (opsQ.ne(opsQ.times(cw, sw), cw))
          throw Error(`${cw} * ${sw} = ${opsQ.times(cw, sw)}`);

        nodeInfo[w] = {
          index: next,
          configSpace: opsQ.toJS(cw),
          symmetrizer: opsQ.toJS(sw),
          configProj: opsQ.toJS(cp)
        };
      }
    }

    nodeInfo[v].isRepresentative = true;
    next += cv.length - 1;
  }

  return nodeInfo;
};


const parametersForGramMatrix = (gram, gramSpace, syms) => {
  const proj = opsF.solve(gramSpace, id(gramSpace.length));
  const G = unitCells.symmetrizedGramMatrix(gram, syms);
  const n = opsF.dimension(G);

  const a = [];
  for (let i = 0; i < n; ++i) {
    for (let j = i; j < n; ++j)
      a.push(G[i][j]);
  }

  return opsF.times(a, proj);
};


const parametersForPositions = (positions, positionSpace) => {
  const params = [];

  for (const v of Object.keys(positions)) {
    const psv = positionSpace[v];
    const cfg = psv.configSpace;

    if (psv.isRepresentative && cfg.length > 1) {
      const p = opsF.times(positions[v].concat(1), psv.symmetrizer);

      for (const x of opsF.times(opsF.minus(p, last(cfg)), psv.configProj))
        params.push(x);
    }
  }

  return params;
};


class Evaluator {
  constructor(posSpace, gramSpace, edgeOrbits) {
    this.posSpace = posSpace;
    this.gramSpace = gramSpace;
    this.posOffset = gramSpace.length;

    this.vertices = Object.keys(posSpace);
    this.nrVertices = this.vertices.length;

    this.dim = Math.sqrt(2 * gramSpace[0].length + 0.25) - 0.5;
    this.gram = opsF.matrix(this.dim, this.dim);

    const m = Math.max(...this.vertices) + 1;
    this.positions = [];
    for (let i = 0; i < m; ++i)
      this.positions.push(new Float64Array(this.dim));

    this.gramValid = false;
    this.positionsValid = new Int8Array(m).fill(false);

    const weightSum = sumBy(edgeOrbits, orb => orb.length);
    this.edgeWeights = edgeOrbits.map(orb => orb.length / weightSum);
    this.edgeReps = edgeOrbits.map(([e]) => e);

    this.edgeLengths = edgeOrbits.map(_ => 0);
    this.avgEdgeLength = 0;
  }

  setParameters(params) {
    this.params = params;
    this.gramValid = false;
    this.positionsValid.fill(false);
  }

  computeGramMatrix() {
    if (this.gramValid)
      return;

    const G = this.gram;
    let k = 0;

    for (let i = 0; i < this.dim; ++i) {
      for (let j = i; j < this.dim; ++j) {
        let x = 0;
        for (let mu = 0; mu < this.gramSpace.length; ++mu)
          x += this.params[mu] * this.gramSpace[mu][k];

        G[i][j] = G[j][i] = x;
        ++k;
      }
    }

    for (let i = 0; i < this.dim; ++i)
      G[i][i] = Math.max(G[i][i], 0);

    for (let i = 0; i < this.dim; ++i) {
      for (let j = i + 1; j < this.dim; ++j)
        G[i][j] = G[j][i] = Math.min(G[i][j], Math.sqrt(G[i][i] * G[j][j]));
    }

    this.gramValid = true;
  }

  position(v) {
    if (!this.positionsValid[v]) {
      const offset = this.posOffset + this.posSpace[v].index;
      const cfg = this.posSpace[v].configSpace;
      const n = cfg.length - 1;
      const p = this.positions[v];

      for (let i = 0; i < this.dim; ++i) {
        p[i] = cfg[n][i];
        for (let k = 0; k < n; ++k)
          p[i] += this.params[offset + k] * cfg[k][i];
      }

      this.positionsValid[v] = true;
    }

    return this.positions[v];
  }

  computeEdgeLengths() {
    let avg = 0.0;

    for (let i = 0; i < this.edgeReps.length; ++i) {
      const edge = this.edgeReps[i];

      const pv = this.position(edge.head);
      const pw = this.position(edge.tail);
      const diff = pv.map((_, i) => pw[i] + edge.shift[i] - pv[i]);

      let s = 0;
      for (let i = 0; i < diff.length; ++i) {
        s += this.gram[i][i] * diff[i] * diff[i];
        for (let j = i + 1; j < diff.length; ++j)
          s += 2 * this.gram[i][j] * diff[i] * diff[j];
      }

      const t = Math.sqrt(Math.max(0, s));
      this.edgeLengths[i] = t;
      avg += t * this.edgeWeights[i];
    }

    this.avgEdgeLength = avg;
  }

  update(params) {
    this.setParameters(params);
    this.computeGramMatrix();
    this.computeEdgeLengths();
  }

  geometry(params) {
    this.update(params);

    const positions = {};
    for (const v of this.vertices)
      positions[v] = Array.from(this.position(v));

    return {
      gram: opsF.div(this.gram, Math.pow(this.avgEdgeLength, 2)),
      positions
    };
  }

  energy(params, volumeWeight) {
    this.update(params);

    const scale = 1.01 / Math.max(this.avgEdgeLength, 0.001);

    const edgePenalty = sumBy(this.edgeLengths, (length, i) => {
      const scaledLength = length * scale;
      const t = 1.0 - scaledLength * scaledLength;
      return t * t * this.edgeWeights[i];
    });

    const cellVolume = Math.sqrt(det(this.gram)) * Math.pow(scale, this.dim)
    const volumePerNode = cellVolume / this.nrVertices;
    const volumePenalty = Math.exp(1.0 / Math.max(volumePerNode, 1e-9)) - 1.0;

    return edgePenalty + volumeWeight * volumePenalty;
  }
};


export const embed = (g, separationFactor=0.5) => {
  const syms = symmetries.symmetries(g).symmetries;
  const symOps = syms.map(a => a.transform);
  const edgeOrbits = symmetries.edgeOrbits(g, syms);
  const posSpace = coordinateParametrization(g, syms);
  const gramSpace = opsQ.toJS(sg.gramMatrixConfigurationSpace(symOps));

  const evaluator = new Evaluator(posSpace, gramSpace, edgeOrbits);
  const gram = unitCells.symmetrizedGramMatrix(id(g.dim), symOps);
  const positions = mapObject(pg.barycentricPlacement(g), p => opsQ.toJS(p));
  const startParams = parametersForGramMatrix(gram, gramSpace, symOps)
    .concat(parametersForPositions(positions, posSpace));

  let params = startParams;

  for (let pass = 0; pass < 5; ++pass) {
    const energy = params => evaluator.energy(params, Math.pow(10, -pass));
    const newParams = amoeba(energy, params, 10000, 1e-6, 0.1).position;
    const { positions, gram } = evaluator.geometry(newParams);

    const dot = dotProduct(gram);
    const { minimum, maximum } = stats.edgeStatistics(g, positions, dot);
    const separation = stats.shortestNonEdge(g, positions, dot);

    if (separation < minimum * separationFactor) {
      console.log(`relaxation failed in pass ${pass}:`);
      console.log(`  min/max edge length: ${minimum}, ${maximum}`);
      console.log(`  vertex separation: ${separation}`);
      break;
    }
    else {
      params = newParams;

      if ((maximum - minimum) < 1.0e-5)
        break;
    }
  }

  const shiftSpace = sg.shiftSpace(syms.map(s => s.transform)) || [];
  const degreesOfFreedom = startParams.length - shiftSpace.length;

  const relaxed = evaluator.geometry(params);
  const spring = embedSpring(g, opsF.times(1.0, relaxed.gram));

  const barycentric = evaluator.geometry(startParams);
  barycentric.gram = relaxed.gram;

  return { degreesOfFreedom, barycentric, relaxed, spring };
};


const secondaryIncidences = g => {
  const nearest = pg.incidences(g);
  const nextNearest = {};

  for (const v of pg.vertices(g)) {
    const seen = { [[v, opsF.vector(g.dim)]]: true };
    nextNearest[v] = [];

    for (const e1 of nearest[v]) {
      for (const e2 of nearest[e1.tail]) {
        const w = e2.tail;
        const s = opsQ.plus(e1.shift, e2.shift);

        if (!seen[[w, s]]) {
          seen[[w, s]] = true;
          nextNearest[v].push(pg.makeEdge(v, w, s));
        }
      }
    }
  }

  return nextNearest;
};


const averageSquaredEdgeLength = (g, pos, dot) => {
  let sumSqLen = 0;
  let count = 0;

  const d = opsF.vector(g.dim);

  for (const v of pg.vertices(g)) {
    for (const e of pg.incidences(g)[v]) {
      for (let i = 0; i < g.dim; ++i)
        d[i] = pos[e.tail][i] + e.shift[i] - pos[v][i];
      sumSqLen += dot(d, d);
      count += 1;
    }
  }

  return sumSqLen / count;
};


export const embedSpring = (g, gram) => {
  const dot = dotProduct(gram);
  const nrSteps = Math.max(200, 2 * pg.vertices(g).length);

  const posQ = pg.barycentricPlacement(g);
  const positions = mapObject(posQ, p => opsQ.toJS(p));
  const posNew = mapObject(posQ, p => opsQ.toJS(p));

  const nextNearest = secondaryIncidences(g);
  const syms = symmetries.symmetries(g).symmetries;
  const symmetrizers = {};
  for (const v of pg.vertices(g))
    symmetrizers[v] = opsQ.toJS(nodeSymmetrizer(v, syms, posQ[v]));

  const d = opsF.vector(g.dim);

  for (let step = 0; step < nrSteps; ++step) {
    const temperature = 0.1 * (1.0 - step / nrSteps);
    const avgSqLen = averageSquaredEdgeLength(g, positions, dot);

    for (const v of pg.vertices(g)) {
      for (let i = 0; i < g.dim; ++i)
        posNew[v][i] = positions[v][i];

      for (const e of pg.incidences(g)[v]) {
        for (let i = 0; i < g.dim; ++i)
          d[i] = positions[e.tail][i] + e.shift[i] - positions[v][i];
        const f = dot(d, d) / avgSqLen - 1.0;

        for (let i = 0; i < g.dim; ++i)
          posNew[v][i] += f * d[i];
      }

      for (const e of nextNearest[v]) {
        for (let i = 0; i < g.dim; ++i)
          d[i] = positions[e.tail][i] + e.shift[i] - positions[v][i];
        const len = Math.sqrt(dot(d, d) / avgSqLen);

        if (len < 1.0) {
          const f = -8 * Math.pow(len - 1.0, 4);
          for (let i = 0; i < g.dim; ++i)
            posNew[v][i] += f * d[i];
        }
      }
    }

    for (const v of pg.vertices(g)) {
      for (let i = 0; i < g.dim; ++i)
        d[i] = posNew[v][i] - positions[v][i];
      const f = Math.min(temperature / Math.sqrt(dot(d, d) / avgSqLen), 1.0);

      for (let i = 0; i < g.dim; ++i)
        posNew[v][i] = positions[v][i] + f * d[i];

      const s = symmetrizers[v];

      for (let i = 0; i < g.dim; ++i) {
        positions[v][i] = s[g.dim][i];
        for (let j = 0; j < g.dim; ++j)
          positions[v][i] += posNew[v][j] * s[j][i];
      }
    }
  }

  const avgSqLen = averageSquaredEdgeLength(g, positions, dot);

  return { gram: opsF.times(1.0 / avgSqLen, gram), positions };
};


if (require.main == module) {
  const cgd = require('../io/cgd');
  const crystal = require('../io/crystal');

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
      const embedResult = embed(g);

      let embeddings = embedResult.barycentric;

      console.log(`  initial gram: ${embeddings.gram}`);
      console.log(`  initial positions:`);
      for (const v of Object.keys(embeddings.positions))
        console.log(`    ${v} -> ${embeddings.positions[v]}`);
      console.log();

      embeddings = embedResult.relaxed;

      console.log(`  relaxed gram: ${embeddings.gram}`);
      console.log(`  relaxed positions:`);
      for (const v of Object.keys(embeddings.positions))
        console.log(`    ${v} -> ${embeddings.positions[v]}`);
      console.log();
    }

    console.log();
  };


  const input = `
CRYSTAL
  NAME esp
  GROUP p4gm
  CELL 7.20976 7.20976 90.0000
  NODE 1 4  0.08485 0.04918
  NODE 2 3  0.04872 0.18310
  NODE 3 3  0.08494 0.31699
  NODE 4 3  0.04904 0.45096
  EDGE  0.08485 0.04918   0.18310 -0.04872
  EDGE  0.08485 0.04918   0.04918 -0.08485
  EDGE  0.08494 0.31699   0.18301 0.41506
  EDGE  0.08494 0.31699   0.04904 0.45096
  EDGE  0.04904 0.45096   -0.04904 0.54904
  EDGE  0.08485 0.04918   0.04872 0.18310
  EDGE  0.04872 0.18310   0.08494 0.31699
END

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
`;

  for (const g of cgd.structures(input))
    test(g.graph);


  console.log('----------------------------------------');
}
