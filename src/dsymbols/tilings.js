import * as cosets      from '../fpgroups/cosets';
import * as delaney     from './delaney';
import * as properties  from './properties';
import * as derived     from './derived';
import * as delaney2d   from './delaney2d';
import * as delaney3d   from './delaney3d';
import * as fundamental from './fundamental';
import * as covers      from './covers';
import * as periodic    from '../pgraphs/periodic';

import * as seq from '../common/lazyseq';

import {
  rationalLinearAlgebraModular,
  numericalLinearAlgebra
} from '../arithmetic/types';

const opsR = rationalLinearAlgebraModular;
const opsF = numericalLinearAlgebra;


const _remainingIndices = (ds, i) => ds.indices().filter(j => j != i);


const _edgeTranslations = cov => {
  const fg  = fundamental.fundamentalGroup(cov);
  const n   = fg.nrGenerators;
  const nul = opsR.nullSpace(cosets.relatorMatrix(n, fg.relators));
  const vec = rel => cosets.relatorAsVector(rel, n);

  return fg.edge2word.map(a => a.map(b => opsR.times(vec(b), nul)));
};


const _cornerShifts = (cov, e2t) => {
  const dim = delaney.dim(cov);
  const zero = opsR.vector(dim);

  const result = new Array(cov.size + 1).fill(0).map(_ => []);

  for (const i of cov.indices()) {
    const idcs = _remainingIndices(cov, i);
    for (const [Dk, k, D] of properties.traversal(cov, idcs, cov.elements())) {
      if (k == properties.traversal.root)
        result[D][i] = zero;
      else
        result[D][i] = opsR.minus(result[Dk][i], e2t[Dk][k] || zero);
    }
  }

  return result;
};


export const skeleton = cov => {
  const e2t = _edgeTranslations(cov);
  const c2s = _cornerShifts(cov, e2t);

  const chamber2node = {};
  let node = 1;
  for (const orb of properties.orbits(cov, _remainingIndices(cov, 0))) {
    for (const D of orb)
      chamber2node[D] = node;
    node += 1;
  }

  const zero = opsR.vector(delaney.dim(cov));
  const edges = properties.orbitReps(cov, _remainingIndices(cov, 1))
    .map(D => {
      const E = cov.s(0, D);
      const v = chamber2node[D];
      const w = chamber2node[E];
      const t = e2t[D][0] || zero;
      const sD = c2s[D][0];
      const sE = c2s[E][0];
      const s = opsR.minus(opsR.plus(t, sE), sD);

      return [v, w, s];
    })
    .toArray();

  return {
    graph: periodic.make(edges),
    chamber2node: chamber2node,
    edgeTranslations: e2t,
    cornerShifts: c2s
  };
};



const chamberPositions = (cov, skel) => {
  const sum = v => v.reduce((x, y) => x == null ? y : opsR.plus(x, y));

  const pos = periodic.barycentricPlacement(skel.graph);
  const result = {};

  for (const D of cov.elements()) {
    const p = pos[skel.chamber2node[D]];
    const t = skel.cornerShifts[D][0];
    result[D] = [opsR.plus(p, t)];
  }

  for (let i = 1; i <= delaney.dim(cov); ++i) {
    const idcs = seq.range(0, i).toArray();

    for (const orb of properties.orbits(cov, idcs, cov.elements())) {
      const s = opsR.div(
        sum(orb.map(E => opsR.minus(result[E][0], skel.cornerShifts[E][i]))),
        orb.length);

      for (const E of orb)
        result[E].push(opsR.plus(s, skel.cornerShifts[E][i]));
    }
  }

  return result;
};


const chamberBasis = (pos, D) => {
  const t = pos[D];
  return t.slice(1).map(v => opsR.minus(v, t[0]));
};


const determinant = M => {
  if (M.length == 2)
    return opsR.minus(opsR.times(M[0][0], M[1][1]),
                      opsR.times(M[0][1], M[1][0]));
  else if (M.length == 3)
    return opsR.times(M[0], opsR.crossProduct(M[1], M[2]));
  else
    return opsR.determinant(M);
};


const chamberDeterminant = (pos, D) => determinant(chamberBasis(pos, D));


const nonDegenerateChamber = (elms, pos) =>
  elms.find(D => opsR.ne(chamberDeterminant(pos, D), 0));


export const symmetries = (ds, cov, pos) => {
  const D0 = nonDegenerateChamber(cov.elements(), pos);
  const A = opsR.inverse(chamberBasis(pos, D0));

  const phi = properties.morphism(cov, 1, ds, 1);
  const E0 = phi[D0];

  return cov.elements()
    .filter(D => phi[D] == E0)
    .map(D => opsR.times(A, chamberBasis(pos, D)));
};


export const makeCover = ds =>
  delaney.dim(ds) == 3 ?
  delaney3d.pseudoToroidalCover(ds) :
  delaney2d.toroidalCover(ds);


const tileSurface3D = (pos, faces) => ({ pos, faces });


const tileSurface2D = (corners, faces) => {
  const pos = [];
  for (const p of corners) {
    pos.push(p.concat(0));
    pos.push(p.concat(0.1));
  }

  const f = faces[0].map(i => 2 * i);

  faces = [f, f.map(x => x + 1).reverse()]
    .concat(f.map((x, i) => {
      const y = f[(i + 1) % f.length];
      return [y, x, x + 1, y + 1];
    }));

  return { pos, faces };
};


const tileSurface = (cov, skel, pos, ori, elms, idcs) => {
  const cOrbs = properties.orbits(cov, idcs.slice(1), elms);
  const cPos = cOrbs.map(
    ([D]) => opsF.plus(pos[skel.chamber2node[D]], skel.cornerShifts[D][0])
  );

  const cIdcs = [];
  cOrbs.forEach((orb, i) => {
    for (const D of orb)
      cIdcs[D] = i;
  });

  const faces = properties.orbits(cov, [0, 1], elms)
    .map(orb => ori[orb[0]] > 0 ? orb.reverse() : orb)
    .map(orb => orb.filter((D, i) => i % 2 == 0).map(D => cIdcs[D]));

  return (delaney.dim(cov) == 3 ? tileSurface3D : tileSurface2D)(cPos, faces);
};


const adjustedOrientation = (cov, pos) => {
  const D0 = nonDegenerateChamber(cov.elements(), pos);
  const sgn = opsR.sgn(chamberDeterminant(pos, D0));

  const ori = properties.partialOrientation(cov);
  if (sgn * ori[D0] < 0) {
    for (const D of cov.elements())
      ori[D] = -ori[D];
  }

  return ori;
};


export const tileSurfaces = (cov, skel, vertexPos, orbitReps) => {
  const dim = delaney.dim(cov);
  const idcs = seq.range(0, dim).toArray();
  const pos = chamberPositions(cov, skel);
  const ori = adjustedOrientation(cov, pos);

  return orbitReps.map(D => tileSurface(
    cov, skel, vertexPos, ori, properties.orbit(cov, idcs, D), idcs));
};


const affineSymmetry = (D0, D1, pos) => {
  const bas = D => chamberBasis(pos, D);
  const linear = opsR.solve(bas(D0), bas(D1));
  const shift = opsR.minus(pos[D1][0], opsR.times(pos[D0][0], linear));

  return linear.map(r => r.concat(0)).concat([shift.concat([1])]);
};


export const tilesByTranslations = (ds, cov, skel) => {
  const dim = delaney.dim(cov);
  const pos = chamberPositions(cov, skel);
  const phi = properties.morphism(cov, 1, ds, 1);
  const idcs = seq.range(0, dim).toArray();
  const tileOrbits = properties.orbits(cov, idcs);

  const orbitReps = [];
  const dsChamberToClassIndex = {};
  const covChamberToLatticeIndex = {};
  const tiles = [];

  for (const elms of tileOrbits) {
    const D0 = nonDegenerateChamber(elms, pos);
    const E0 = phi[D0];

    let classIndex = dsChamberToClassIndex[E0];
    let symmetry = opsR.identityMatrix(dim + 1);

    if (classIndex == null) {
      classIndex = orbitReps.length;

      for (const E of properties.orbit(ds, idcs, E0))
        dsChamberToClassIndex[E] = classIndex;

      orbitReps.push(D0);
    }
    else {
      const D0 = orbitReps[classIndex];
      const D1 = elms.find(D => phi[D] == phi[D0]);
      symmetry = affineSymmetry(D0, D1, pos);
    }

    for (const E of elms)
      covChamberToLatticeIndex[E] = tiles.length;

    tiles.push({ classIndex, symmetry, chambers: elms });
  }

  const e2t = _edgeTranslations(cov);
  const zero = Array(dim).fill(0);

  for (const tile of tiles) {
    const neighbors = [];
    for (const D of properties.orbitReps(cov, [0, 1], tile.chambers)) {
      const E = cov.s(dim, D);
      const latticeIndex = covChamberToLatticeIndex[E];
      const shift = e2t[D][dim] || zero;
      neighbors.push({ latticeIndex, shift });
    }

    tile.neighbors = neighbors;
  }

  const centers = orbitReps.map(D => pos[D][dim]);

  return { orbitReps, tiles, centers };
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x && x.toString()).join(', ') + ' ]';
  };

  const delaney = require('./delaney');
  const embed = require('../pgraphs/embedding').default;
  const unitCells = require('../geometry/unitCells');

  const test = ds => {
    console.log(`ds = ${ds}`);

    const cov = makeCover(ds);
    console.log(`cover = ${cov}`);

    const skel = skeleton(cov);
    console.log(`skeleton = ${skel.graph}`);

    const embedding = embed(skel.graph).relaxed;
    const pos = embedding.positions;
    console.log(`vertex positions: ${JSON.stringify(pos)}`);

    const basis = unitCells.invariantBasis(embedding.gram);
    console.log(`invariant basis: ${basis}`);

    const surf = tileSurfaces(ds, cov, skel, pos);
    console.log(`tile surfaces: ${JSON.stringify(surf)}`);

    console.log();
  }

  test(delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>'));
  test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));
}
