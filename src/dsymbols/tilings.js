import * as pickler from '../common/pickler';

import * as cosets      from '../fpgroups/cosets';
import * as delaney     from './delaney';
import * as properties  from './properties';
import * as derived     from './derived';
import * as delaney2d   from './delaney2d';
import * as delaney3d   from './delaney3d';
import * as fundamental from './fundamental';
import * as covers      from './covers';
import embed            from '../pgraphs/embedding';
import * as periodic    from '../pgraphs/periodic';
import * as symmetries  from '../pgraphs/symmetries';

import { rationalLinearAlgebraModular } from '../arithmetic/types';

import {
  coordinateChangesF,
  coordinateChangesQ
} from '../geometry/types';

const opsF = coordinateChangesF;
const opsR = coordinateChangesQ;

const encode = pickler.serialize;
const decode = pickler.deserialize;

const range = n => [...Array(n).keys()];
const _remainingIndices = (ds, i) => ds.indices().filter(j => j != i);


const _edgeTranslations = cov => {
  const fg  = fundamental.fundamentalGroup(cov);
  const n   = fg.nrGenerators;
  const nul = rationalLinearAlgebraModular.nullSpace(
    cosets.relatorMatrix(n, fg.relators)
  );
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


const skeletonEdge = (D, cov, skel) => {
  const E = cov.s(0, D);
  const sD = skel.cornerShifts[D][0];
  const sE = skel.cornerShifts[E][0];
  const t = skel.edgeTranslations[D][0];

  const head = skel.chamber2node[D];
  const tail = skel.chamber2node[E];
  const shift = opsR.minus(t ? opsR.plus(sE, t) : sE, sD);

  return periodic.makeEdge(head, tail, shift);
};


export const skeleton = cov => {
  const edgeTranslations = _edgeTranslations(cov);
  const cornerShifts = _cornerShifts(cov, edgeTranslations);

  const chamber2node = {};
  let node = 1;
  for (const orb of properties.orbits(cov, _remainingIndices(cov, 0))) {
    for (const D of orb)
      chamber2node[D] = node;
    node += 1;
  }

  const skel = { chamber2node, edgeTranslations, cornerShifts };

  const edges = [];
  for (const D of properties.orbitReps(cov, _remainingIndices(cov, 1))) {
    const e = skeletonEdge(D, cov, skel);
    edges.push([e.head, e.tail, e.shift]);
  }

  skel.graph = periodic.make(edges);
  return skel;
};


const facialRing = (start, cov, skel) => {
  const result = [];

  let D = start;
  do {
    result.push(skeletonEdge(D, cov, skel))
    D = cov.s(1, cov.s(0, D));
  }
  while (D != start);

  return result;
};


const cmpRingEdges = (a, b) => (
  opsR.cmp(a.head, b.head) || opsR.cmp(a.shift, b.shift)
);

const cmpRingTails = (a, b, i) => (
  i >= a.length ? 0 : cmpRingEdges(a[i], b[i]) || cmpRingTails(a, b, i + 1)
);

const cmpRings = (a, b) => cmpRingTails(a, b, 0);

const ringShifted = (r, i) => r.slice(i).concat(r.slice(0, i));
const ringReverse = r => r.slice().reverse().map(e => e.reverse());

const mapRing = (ring, sym) => ring.map(e => decode(sym.src2img[encode(e)]));


const canonicalRing = ring => {
  const rev = ringReverse(ring);
  let best = null;

  for (let i = 0; i < ring.length; ++i) {
    if (best == null || cmpRings(ringShifted(ring, i), best) < 0)
      best = ringShifted(ring, i);
    if (cmpRings(ringShifted(rev, i), best) < 0)
      best = ringShifted(rev, i);
  }

  return best;
};


const facialRings = (cov, skel) => (
  properties.orbitReps(cov, _remainingIndices(cov, 2))
    .map(D => canonicalRing(facialRing(D, cov, skel)))
);


export const facePreservingSymmetries = (cov, skel) => {
  const rings = facialRings(cov, skel);

  const isRing = {};
  for (const r of rings)
    isRing[encode(canonicalRing(r))] = true;

  const syms = symmetries.symmetries(skel.graph).symmetries;
  const good = [];

  for (const sym of syms) {
    if (rings.every(r => isRing[encode(canonicalRing(mapRing(r, sym)))]))
      good.push(sym);
  }

  return good;
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
    const idcs = range(i);

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


export const makeCover = ds =>
  delaney.dim(ds) == 3 ?
  delaney3d.pseudoToroidalCover(ds) :
  delaney2d.toroidalCover(ds);


const tileSurface3D = (pos, faces) => ({ pos, faces });


const tileSurface2D = (corners, faces) => {
  const pos = [];
  for (const p of corners) {
    pos.push(p.concat(-0.1));
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
  const idcs = range(dim);
  const pos = chamberPositions(cov, skel);
  const ori = adjustedOrientation(cov, pos);

  return orbitReps.map(D => tileSurface(
    cov, skel, vertexPos, ori, properties.orbit(cov, idcs, D), idcs));
};


const affineSymmetry = (D0, D1, pos) => {
  const bas = D => chamberBasis(pos, D);
  const linear = opsR.solve(bas(D0), bas(D1));
  const shift = opsR.minus(pos[D1][0], opsR.times(pos[D0][0], linear));

  return opsR.affineTransformation(opsR.transposed(linear), shift);
};


export const deckTransformations = (ds, cov) => {
  const phi = properties.morphism(cov, 1, ds, 1);

  return cov.elements()
    .filter(D => phi[D] == 1)
    .map(D => properties.morphism(cov, D, cov, 1));
};


export const affineSymmetries = (ds, cov, skel) => {
  const pos = chamberPositions(cov, skel);
  const D0 = nonDegenerateChamber(ds.elements(), pos);
  const syms = deckTransformations(ds, cov);

  return syms.map(phi => affineSymmetry(D0, phi[D0], pos));
};


export const tilesByTranslations = (ds, cov, skel) => {
  const dim = delaney.dim(cov);
  const pos = chamberPositions(cov, skel);
  const phi = properties.morphism(cov, 1, ds, 1);
  const idcs = range(dim);
  const tileOrbits = properties.orbits(cov, idcs);

  const orbitReps = [];
  const dsChamberToClassIndex = {};
  const covChamberToLatticeIndex = {};
  const tiles = [];

  for (const elms of tileOrbits) {
    const D0 = nonDegenerateChamber(elms, pos);
    const E0 = phi[D0];

    let classIndex = dsChamberToClassIndex[E0];
    let symmetry = opsR.identityMatrix(dim);

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
  const unitCells = require('../geometry/unitCells');

  const test = ds => {
    console.log(`ds = ${ds}`);
    console.log(`is ${properties.isOriented(ds) ? '' : 'not '}oriented`);
    console.log(`is ${properties.isConnected(ds) ? '' : 'not '}connected`);

    const fg = fundamental.fundamentalGroup(ds);
    console.log(`fundamental group: ${JSON.stringify(fg)}`);

    const cov = makeCover(ds);
    console.log(`cover = ${cov}`);

    const skel = skeleton(cov);
    console.log(`skeleton = ${skel.graph}`);

    const embedding = embed(skel.graph).relaxed;
    const pos = embedding.positions;
    console.log(`vertex positions: ${JSON.stringify(pos)}`);

    const basis = unitCells.invariantBasis(embedding.gram);
    console.log(`invariant basis: ${basis}`);

    const rings = facialRings(cov, skel);
    console.log(`facial rings:`);
    for (const ring of rings)
      console.log(`  ${ring}`);

    const allSyms = symmetries.symmetries(skel.graph).symmetries;
    const goodSyms = facePreservingSymmetries(cov, skel);
    console.log(
      `skeleton has ${allSyms.length}, tiling ${goodSyms.length} symmetries`
    );

    const transforms = affineSymmetries(ds, cov, skel);
    console.log(`tiling has ${transforms.length} deck transformations`);
    transforms
      .sort((a, b) => opsR.cmp(a, b))
      .forEach(t => console.log(t));

    const { orbitReps, tiles } = tilesByTranslations(ds, cov, skel);
    console.log(`tilings has ${tiles.length} tiles`);
    tiles
      .sort(
        (a, b) =>
          opsR.cmp(a.classIndex, b.classIndex) ||
          opsR.cmp(a.symmetry, b.symmetry)
      )
      .forEach(
        ({ classIndex, symmetry }) =>
          console.log(`class ${classIndex}\nsymmetry ${symmetry}`)
      );

    const surfaces = tileSurfaces(cov, skel, pos, orbitReps);
    console.log(`tile surfaces:`);
    for (const surface of surfaces)
      console.log(`  ${JSON.stringify(surface)}`);

    console.log();
  }

  test(delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>'));
  test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'));
  test(delaney.parse(
    '<1.1:6 3:2 4 6,1 2 3 5 6,3 4 5 6,2 3 4 5 6:6 4,2 3 3,8 4 4>'
  ));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));

  test(delaney.parse(
    '<1.1:72 3:2 4 6 8 10 12 14 16 18 20 22 24 26 28 30 32 34 36 38 40 42 44 46 48 50 52 54 56 58 60 62 64 66 68 70 72,71 3 34 69 7 46 14 11 13 54 17 40 56 21 52 28 25 27 43 31 42 72 49 37 48 53 44 70 50 55 62 59 61 68 65 67,5 6 9 10 14 13 31 32 19 20 23 24 28 27 37 38 33 34 39 40 45 46 64 63 51 52 59 60 58 57 61 62 72 71 69 70,15 16 17 18 45 46 8 66 65 64 63 68 67 51 52 22 57 58 59 60 61 62 41 42 32 39 40 47 48 38 44 50 72 71 56 70:4 4 3 4 4 3 4 4 3 3,3 3 3 3 3 3 3 3 3 3 3 3,6 6 4 4 4 4 4 4>'
  ));

  test(delaney.parse(
    '<1.1:36 3:2 4 6 8 10 12 14 16 18 20 22 24 26 28 30 32 34 36,6 3 5 12 9 11 20 15 17 19 28 23 25 27 36 31 33 35,14 13 22 21 30 29 18 17 34 33 26 25 36 35 24 23 32 31,8 7 12 11 10 9 14 20 19 18 22 28 27 26 30 36 35 34:3 3 4 4 4,3 3 3 3 3 3,4 4 4 6 6>'
  ));
}
