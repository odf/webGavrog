import * as pg from './periodic';
import * as symmetries from './symmetries';
import * as stats from './statistics';
import * as sg from '../spacegroups/spacegroups';
import * as unitCells from '../spacegroups/unitCells';
import amoeba from '../common/amoeba';

import { affineTransformationsQ } from '../geometry/types';

import {
  rationalLinearAlgebra as opsQ,
  numericalLinearAlgebra as opsF
} from '../arithmetic/types';


const last = a => a[a.length - 1];
const id = dim => opsQ.identityMatrix(dim);
const sum = v => v.reduce((x, y) => x + y);
const sumBy = (xs, fn) => xs.reduce((a, x, i) => a + fn(x, i), 0);


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


const edgeLength = (edge, gram, positions) => {
  const pv = positions[edge.head];
  const pw = positions[edge.tail];
  const diff = pv.map((_, i) => pw[i] + edge.shift[i] - pv[i]);

  let s = 0;
  for (let i = 0; i < diff.length; ++i) {
    s += gram[i][i] * diff[i] * diff[i];
    for (let j = i + 1; j < diff.length; ++j)
      s += 2 * gram[i][j] * diff[i] * diff[j];
  }

  return Math.sqrt(Math.max(0, s));
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


const parametersForGramMatrix = (gram, proj, syms) => {
  const G = unitCells.symmetrizedGramMatrix(gram, syms);
  const n = opsF.dimension(G);

  const a = [];
  for (let i = 0; i < n; ++i) {
    for (let j = i; j < n; ++j)
      a.push(G[i][j]);
  }

  return opsF.times(a, proj);
};


const parametersForPositions = (graph, positions, positionSpace) => {
  const params = [];

  for (const v of pg.vertices(graph)) {
    const psv = positionSpace[v];
    const cfg = psv.configSpace;

    if (psv.isRepresentative && cfg.length > 1) {
      const pos = opsF.times(positions[v].concat(1), psv.symmetrizer);
      for (const x of opsF.times(opsF.minus(pos, last(cfg)), psv.configProj))
        params.push(x);
    }
  }

  return params;
};


const weightsFromOrbits = orbits => {
  const weightSum = sumBy(orbits, orb => orb.length);
  return orbits.map(orb => orb.length / weightSum);
};


class Evaluator {
  constructor(posSpace, gramSpace, edgeOrbits) {
    this.posSpace = posSpace;
    this.gramSpace = gramSpace;

    this.dim = Math.sqrt(2 * gramSpace[0].length + 0.25) - 0.5;

    this.vertices = Object.keys(posSpace);
    this.nrVertices = this.vertices.length;
    this.posOffset = gramSpace.length;

    this.edgeWeights = weightsFromOrbits(edgeOrbits);
    this.edgeReps = edgeOrbits.map(([e]) => e);

    this.gram = opsF.matrix(this.dim, this.dim);
    this.positions = {};

    this.edgeLengths = edgeOrbits.map(_ => 0);
    this.avgEdgeLength = 0;
  }

  computeGramMatrix(params) {
    const G = this.gram;
    let k = 0;

    for (let i = 0; i < this.dim; ++i) {
      for (let j = i; j < this.dim; ++j) {
        let x = 0;
        for (let mu = 0; mu < this.gramSpace.length; ++mu)
          x += params[mu] * this.gramSpace[mu][k];

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
  }

  computePositions(params) {
    for (const v of this.vertices) {
      const { index, configSpace } = this.posSpace[v];
      const n = configSpace.length - 1;

      let p = configSpace[n].slice(0, -1);
      for (let i = 0; i < n; ++i) {
        for (let j = 0; j < p.length; ++j)
          p[j] += params[this.posOffset + index + i] * configSpace[i][j];
      }

      this.positions[v] = p;
    }
  }

  update(params) {
    this.computeGramMatrix(params);
    this.computePositions(params);

    let avg = 0.0;
    for (let i = 0; i < this.edgeReps.length; ++i) {
      const t = edgeLength(this.edgeReps[i], this.gram, this.positions);
      this.edgeLengths[i] = t;
      avg += t * this.edgeWeights[i];
    }

    this.avgEdgeLength = avg;
  }

  geometry(params) {
    this.update(params);

    return {
      gram: opsF.div(this.gram, Math.pow(this.avgEdgeLength, 2)),
      positions: Object.assign({}, this.positions),
      params: params.slice()
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


const embedStep = (params, passNr, evaluator) => {
  const energy = params => evaluator.energy(params, Math.pow(10, -passNr));
  const result = amoeba(energy, params, 10000, 1e-6, 0.1);

  return result.position;
};


const embed = (g, relax=true) => {
  const syms = symmetries.symmetries(g).symmetries;
  const symOps = syms.map(a => a.transform);
  const edgeOrbits = symmetries.edgeOrbits(g, syms);
  const posSpace = coordinateParametrization(g, syms);
  const gramSpace = sg.gramMatrixConfigurationSpace(symOps);
  const gramSpaceF = opsQ.toJS(gramSpace);
  const evaluator = new Evaluator(posSpace, gramSpaceF, edgeOrbits);

  const positions = pg.barycentricPlacement(g);
  const posF = {};
  for (const v of Object.keys(positions))
    posF[v] = opsQ.toJS(positions[v]);

  const gram = unitCells.symmetrizedGramMatrix(id(g.dim), symOps);
  const gramProjF = opsQ.toJS(opsQ.solve(gramSpace, id(gramSpace.length)));
  const symF = symOps.map(s => opsQ.toJS(s));
  const startParams = parametersForGramMatrix(gram, gramProjF, symF)
    .concat(parametersForPositions(g, posF, posSpace));

  const result = { barycentric: evaluator.geometry(startParams) };

  if (relax) {
    let params = startParams;

    for (let pass = 0; pass < 5; ++pass) {
      const newParams = embedStep(params, pass, evaluator);
      const { positions, gram } = evaluator.geometry(newParams);

      const dot = dotProduct(gram);
      const { minimum, maximum } = stats.edgeStatistics(g, positions, dot);
      const separation = stats.shortestNonEdge(g, positions, dot);

      const good = separation >= maximum * 0.95;
      const done = (maximum - minimum) < 1.0e-5;

      if (good)
        params = newParams;
      else {
        console.log(`relaxation failed in pass ${pass}:`);
        console.log(`  min/max edge length: ${minimum}, ${maximum}`);
        console.log(`  vertex separation: ${separation}`);
      }

      if (done || !good)
        break;
    }

    result.relaxed = evaluator.geometry(params);
  }

  return result;
};


export default embed;


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
