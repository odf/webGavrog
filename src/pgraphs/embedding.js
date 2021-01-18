import * as pg from './periodic';
import * as symmetries from './symmetries';
import * as sg from '../spacegroups/spacegroups';
import * as unitCells from '../spacegroups/unitCells';
import amoeba from '../common/amoeba';

import { timer } from '../common/timing';

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


const dot = (v, w, gram) => {
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


const localComplementGraph = (g, dist) => {
  const edges = [];
  const zero = opsQ.vector(g.dim);

  for (const v of pg.vertices(g)) {
    const seen = { [[v, zero]]: true };
    const queue = [[v, zero, 0]];

    while (queue.length) {
      const [u, s, d] = queue.shift();
      if (d < dist) {
        for (const e of pg.incidences(g)[u]) {
          const w = e.tail;
          const t = opsQ.plus(s, e.shift);

          if (!seen[[w, t]]) {
            seen[[w, t]] = true;
            queue.push([w, t, d + 1]);
            if (d > 0)
              edges.push(pg.makeEdge(v, w, t));
          }
        }
      }
    }
  }

  return pg.makeGraph(edges);
};


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
  constructor(posSpace, gramSpace, edgeOrbits, antiEdgeOrbits=[]) {
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

    let weightSum = sumBy(edgeOrbits, orb => orb.length);
    this.edgeWeights = edgeOrbits.map(orb => orb.length / weightSum);
    this.edgeReps = edgeOrbits.map(([e]) => e);
    this.edgeLengths = edgeOrbits.map(_ => 0);
    this.avgEdgeLength = 0;

    weightSum = sumBy(antiEdgeOrbits, orb => orb.length);
    this.antiEdgeWeights = antiEdgeOrbits.map(orb => orb.length / weightSum);
    this.antiEdgeReps = antiEdgeOrbits.map(([e]) => e);
    this.antiEdgeLengths = antiEdgeOrbits.map(_ => 0);
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

  computeAntiEdgeLengths() {
    for (let i = 0; i < this.antiEdgeReps.length; ++i) {
      const edge = this.antiEdgeReps[i];

      const pv = this.position(edge.head);
      const pw = this.position(edge.tail);
      const diff = pv.map((_, i) => pw[i] + edge.shift[i] - pv[i]);

      let s = 0;
      for (let i = 0; i < diff.length; ++i) {
        s += this.gram[i][i] * diff[i] * diff[i];
        for (let j = i + 1; j < diff.length; ++j)
          s += 2 * this.gram[i][j] * diff[i] * diff[j];
      }

      this.antiEdgeLengths[i] = Math.sqrt(Math.max(0, s));
    }
  }

  update(params) {
    this.setParameters(params);
    this.computeGramMatrix();
    this.computeEdgeLengths();
    this.computeAntiEdgeLengths();
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

    const scale = 1.0 / Math.max(this.avgEdgeLength, 0.001);

    const edgeEnergy = sumBy(this.edgeLengths, (length, i) => {
      return this.edgeWeights[i] * Math.pow(length * scale - 1, 2) / 2;
    });

    const antiEdgeEnergy = sumBy(this.antiEdgeLengths, (length, i) => {
      const len = length * scale;
      if (len < 1)
        return this.antiEdgeWeights[i] * Math.pow(1.0 - len, 5);
      else
        return 0;
    });

    const cellVolume = Math.sqrt(det(this.gram)) * Math.pow(scale, this.dim)
    const volumeEnergy = Math.pow(Math.max(1e-9, cellVolume), -1 / this.dim);

    return edgeEnergy + 8 / 5 * antiEdgeEnergy + volumeWeight * volumeEnergy;
  }
};


const refineEmbedding = (g, positions, gram) => {
  const syms = symmetries.symmetries(g).symmetries;
  const symOps = syms.map(a => a.transform);
  const edgeOrbits = symmetries.edgeOrbits(g, syms);
  const antiOrbits = localComplementGraph(g, g.dim).edges.map(e => [e]);
  const posSpace = coordinateParametrization(g, syms);
  const gramSpace = opsQ.toJS(sg.gramMatrixConfigurationSpace(symOps));

  const gramParams = parametersForGramMatrix(gram, gramSpace, symOps);
  const posParams = parametersForPositions(positions, posSpace);

  const evaluator = new Evaluator(posSpace, gramSpace, edgeOrbits, antiOrbits);
  const energy = params => evaluator.energy(params, 1e-4);
  const nrSteps = 100 * (gramParams.length + posParams.length);

  const paramsIn = gramParams.concat(posParams);
  const paramsOut = amoeba(energy, paramsIn, nrSteps, 1e-6, 0.1).position;

  return evaluator.geometry(paramsOut);
};


const nodeOrbits = (g, syms) => {
  const pos = pg.barycentricPlacement(g);

  const orbits = [];
  const seen = {};

  for (const v of pg.vertices(g)) {
    if (!seen[v]) {
      seen[v] = true;

      const symmetrizer = opsQ.toJS(nodeSymmetrizer(v, syms, pos[v]));
      const images = [];

      for (const { src2img, transform: m } of syms) {
        const w = src2img[v];

        if (!seen[w]) {
          seen[w] = true

          const t = opsQ.minus(pos[w], opsQ.times(pos[v], m));
          const transform = opsQ.toJS(projectiveMatrix(m, t));

          images.push({ node: w, transform });
        }
      }

      orbits.push({ node: v, images, symmetrizer });
    }
  }

  return orbits;
};


const decodeGramMatrix= (G, params, gramSpace) => {
  const dim = G.length;
  let k = 0;

  for (let i = 0; i < dim; ++i) {
    for (let j = i; j < dim; ++j) {
      let x = 0;
      for (let mu = 0; mu < gramSpace.length; ++mu)
        x += params[mu] * gramSpace[mu][k];

      G[i][j] = G[j][i] = x;
      ++k;
    }
  }

  for (let i = 0; i < dim; ++i)
    G[i][i] = Math.max(G[i][i], 0);

  for (let i = 0; i < dim; ++i) {
    for (let j = i + 1; j < dim; ++j)
      G[i][j] = G[j][i] = Math.min(G[i][j], Math.sqrt(G[i][i] * G[j][j]));
  }
}


const cellVolumeEnergy = (g, gramSpace, pos, G) => {
  const dim = g.dim;
  const d = opsF.vector(dim);
  const coeff = opsF.matrix(dim, dim);

  for (const v of pg.vertices(g)) {
    for (const e of pg.incidences(g)[v]) {
      for (let i = 0; i < dim; ++i)
        d[i] = pos[e.tail][i] + e.shift[i] - pos[v][i];

      for (let i = 0; i < dim; ++i) {
        for (let j = 0; j < dim; ++j)
          coeff[i][j] += d[i] * d[j];
      }
    }
  }

  return params => {
    decodeGramMatrix(G, params, gramSpace);

    const squaredCellVolume = det(G);

    if (squaredCellVolume < 1e-12)
      return 1e12;

    let edgeSum = 0;

    for (let i = 0; i < dim; ++i) {
      for (let j = 0; j < dim; ++j)
        edgeSum += coeff[i][j] * G[i][j];
    }

    return Math.pow(edgeSum, dim) / squaredCellVolume;
  };
};


const volumeMaximizedGramMatrix = (gramIn, g, gramSpace, pos, symOps) => {
  const gram = opsF.matrix(g.dim, g.dim);
  const energy = cellVolumeEnergy(g, gramSpace, pos, gram);

  const paramsIn = parametersForGramMatrix(gramIn, gramSpace, symOps);
  const paramsOut = amoeba(energy, paramsIn, 1000, 1e-6, 0.1).position;

  decodeGramMatrix(gram, paramsOut, gramSpace);
  return gram;
};


const averageSquaredEdgeLength = (g, pos, gram) => {
  let sumSqLen = 0;
  let count = 0;

  const d = opsF.vector(g.dim);

  for (const v of pg.vertices(g)) {
    for (const e of pg.incidences(g)[v]) {
      for (let i = 0; i < g.dim; ++i)
        d[i] = pos[e.tail][i] + e.shift[i] - pos[v][i];
      sumSqLen += dot(d, d, gram);
      count += 1;
    }
  }

  return sumSqLen / count;
};


const springForcePullOnly = (out, v, pos, gram, scale, d, edges) => {
  for (let i = 0; i < out.length; ++i)
    out[i] = 0;

  for (const e of edges) {
    for (let i = 0; i < out.length; ++i)
      d[i] = pos[e.tail][i] + e.shift[i] - pos[v][i];

    const len = Math.sqrt(dot(d, d, gram) * scale);
    const f = (len - 1.0) / len;

    if (f > 0) {
      for (let i = 0; i < out.length; ++i)
        out[i] += f * d[i];
    }
  }
};


const springAndAngleForce = (
  out, v, pos, gram, scale, d, edges, antiEdges
) => {
  for (let i = 0; i < out.length; ++i)
    out[i] = 0;

  for (const e of edges) {
    for (let i = 0; i < out.length; ++i)
      d[i] = pos[e.tail][i] + e.shift[i] - pos[v][i];

    const len = Math.sqrt(dot(d, d, gram) * scale);
    const f = (len - 1.0) / len;

    for (let i = 0; i < out.length; ++i)
      out[i] += f * d[i];
  }

  for (const e of antiEdges) {
    for (let i = 0; i < out.length; ++i)
      d[i] = pos[e.tail][i] + e.shift[i] - pos[v][i];

    const len = Math.sqrt(dot(d, d, gram) * scale);

    if (len < 1) {
      const f = -8 * Math.pow(1.0 - len, 4) / len;
      for (let i = 0; i < out.length; ++i)
        out[i] += f * d[i];
    }
  }
};


const applyTransformation = (dst, src, transform) => {
  for (let i = 0; i < dst.length; ++i) {
    dst[i] = transform[src.length][i];
    for (let j = 0; j < src.length; ++j)
      dst[i] += src[j] * transform[j][i];
  }
};


const hot = completion => 1.01 - completion;
const cool = completion => 0.1 * Math.pow(1.0 - completion, 3);


export const embed = g => {
  const syms = symmetries.symmetries(g).symmetries;
  const symOps = syms.map(a => a.transform);
  const posSpace = coordinateParametrization(g, syms);
  const gramSpace = opsQ.toJS(sg.gramMatrixConfigurationSpace(symOps));
  const shiftSpace = sg.shiftSpace(symOps) || [];

  const orbits = nodeOrbits(g, syms);
  const gramRaw = unitCells.symmetrizedGramMatrix(id(g.dim), symOps);
  const edges = pg.incidences(g);
  const antiEdges = pg.incidences(localComplementGraph(g, g.dim));

  const pos = mapObject(pg.barycentricPlacement(g), p => opsQ.toJS(p));
  const posParams = parametersForPositions(pos, posSpace);
  const s = opsF.vector(g.dim);
  const d = opsF.vector(g.dim);

  let gram = volumeMaximizedGramMatrix(gramRaw, g, gramSpace, pos, symOps);
  let avgSqLen = averageSquaredEdgeLength(g, pos, gram);

  const result = {
    degreesOfFreedom: gramSpace.length + posParams.length - shiftSpace.length,
    barycentric: { 
      gram: opsF.div(gram, avgSqLen),
      positions: mapObject(pos, p => p.slice())
    }
  };

  const N = Math.max(100, orbits.length);

  const phases = [
    { nrSteps: N * N, setForce: springForcePullOnly, temperature: hot },
    { nrSteps: N * N, setForce: springAndAngleForce, temperature: cool }
  ];

  for (const { nrSteps, setForce, temperature } of phases) {
    for (let step = 0; step < nrSteps; ++step) {
      const temp = temperature(step / nrSteps);
      const scale = Math.pow(1.0 + temp, 2) / avgSqLen;

      const k = Math.floor(Math.random() * orbits.length);
      const { node: v, images, symmetrizer } = orbits[k];

      setForce(s, v, pos, gram, scale, d, edges[v], antiEdges[v]);

      const f = Math.min(temp / Math.sqrt(dot(s, s, gram) * scale), 1.0);
      for (let i = 0; i < g.dim; ++i)
        s[i] = pos[v][i] + f * s[i];

      applyTransformation(pos[v], s, symmetrizer);

      for (const { node: w, transform } of images)
        applyTransformation(pos[w], pos[v], transform);

      if (step % 100 == 99 || step == nrSteps - 1) {
        if (setForce == springForcePullOnly && gramSpace.length > 1)
          gram = volumeMaximizedGramMatrix(gram, g, gramSpace, pos, symOps);
        avgSqLen = averageSquaredEdgeLength(g, pos, gram);
      }
    }
  }

  result.spring = refineEmbedding(g, pos, opsF.div(gram, avgSqLen));
  return result;
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

      embeddings = embedResult.spring;

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
