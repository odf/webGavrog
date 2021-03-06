import * as freeWords from '../fpgroups/freeWords';
import * as periodic from '../pgraphs/periodic';
import * as symmetries from '../pgraphs/symmetries';
import { embed } from '../pgraphs/embedding';

import * as props from './properties';
import * as delaney2d from './delaney2d';
import * as delaney3d from './delaney3d';
import { fundamentalGroup } from './fundamental';

import { rationalLinearAlgebraModular } from '../arithmetic/types';

import {
  coordinateChangesF as opsF,
  coordinateChangesQ as opsQ
} from '../geometry/types';

import {
  serialize as encode,
  deserialize as decode
} from '../common/pickler';


const range = (from, to) => [...Array(to).keys()].slice(from);
const remainingIndices = (ds, i) => ds.indices().filter(j => j != i);


const makeEdgeTranslations = cov => {
  const { nrGenerators, relators, edge2word } = fundamentalGroup(cov);
  const mat = freeWords.relatorMatrix(nrGenerators, relators);
  const nul = rationalLinearAlgebraModular.nullSpace(mat);

  return edge2word.map(a => a.map(
    b => opsQ.times(freeWords.relatorAsVector(b, nrGenerators), nul)
  ));
};


const makeCornerShifts = (cov, e2t) => {
  const zero = opsQ.vector(cov.dim);
  const result = new Array(cov.size + 1).fill(0).map(_ => []);

  for (const i of cov.indices()) {
    const idcs = remainingIndices(cov, i);
    for (const [Dk, k, D] of props.traversal(cov, idcs, cov.elements())) {
      if (k == null)
        result[D][i] = zero;
      else
        result[D][i] = opsQ.minus(result[Dk][i], e2t[Dk][k] || zero);
    }
  }

  return result;
};


const skeletonEdge = (D, cov, skel) => {
  const E = cov.s(0, D);
  const sD = skel.cornerShifts[D][0];
  const sE = skel.cornerShifts[E][0];
  const t = skel.edgeTranslations[D][0] || opsQ.vector(cov.dim);

  const head = skel.chamber2node[D];
  const tail = skel.chamber2node[E];
  const shift = opsQ.minus(opsQ.plus(sE, t), sD);

  return periodic.makeEdge(head, tail, shift);
};


export const skeleton = cov => {
  const chamber2node = {};
  let node = 1;
  for (const orb of props.orbits(cov, remainingIndices(cov, 0))) {
    for (const D of orb)
      chamber2node[D] = node;
    node += 1;
  }

  const edgeTranslations = makeEdgeTranslations(cov);
  const cornerShifts = makeCornerShifts(cov, edgeTranslations);
  const skel = { chamber2node, edgeTranslations, cornerShifts };

  const reps = props.orbitReps(cov, remainingIndices(cov, 1));
  const edges = reps.map(D => skeletonEdge(D, cov, skel));

  return Object.assign(skel, { graph: periodic.makeGraph(edges) });
};


const canonicalRing = ring => {
  const reverse = ring.slice().reverse().map(e => e.reverse());
  let best = ring;

  for (let i = 0; i < ring.length; ++i) {
    for (const r of [ring, reverse]) {
      const candidate = r.slice(i).concat(r.slice(0, i));

      for (let k = 0; k < ring.length; ++k) {
        const d = (candidate[k].head - best[k].head) ||
          opsQ.cmp(candidate[k].shift, best[k].shift);

        if (d < 0)
          best = candidate;

        if (d)
          break;
      }
    }
  }

  return best;
};


const facialRings = (cov, skel) => {
  const result = [];

  for (const start of props.orbitReps(cov, remainingIndices(cov, 2))) {
    const ring = [];

    let D = start;
    do {
      ring.push(skeletonEdge(D, cov, skel))
      D = cov.s(1, cov.s(0, D));
    }
    while (D != start);

    result.push(canonicalRing(ring));
  }

  return result;
};


export const facePreservingSymmetries = (cov, skel) => {
  const keyFor = ring => encode(canonicalRing(ring));
  const rings = facialRings(cov, skel);

  const isRing = {};
  for (const r of rings)
    isRing[keyFor(r)] = true;

  const mapRing = (ring, sym) => ring.map(e => decode(sym.src2img[encode(e)]));
  const mapsToRing = sym => ring => isRing[keyFor(mapRing(ring, sym))];

  const syms = symmetries.symmetries(skel.graph).symmetries;
  return syms.filter(sym => rings.every(mapsToRing(sym)));
};


export const chamberPositions = (cov, skel) => {
  const pos = periodic.barycentricPlacement(skel.graph);
  const shifts = skel.cornerShifts;
  const corners = {};
  const result = {};

  for (const D of cov.elements()) {
    corners[D] = opsQ.plus(pos[skel.chamber2node[D]], shifts[D][0]);
    result[D] = [corners[D]];
  }

  for (let i = 1; i <= cov.dim; ++i) {
    for (const orb of props.orbits(cov, range(0, i))) {
      let sum = opsQ.vector(cov.dim);
      for (const D of orb)
        sum = opsQ.plus(sum, opsQ.minus(corners[D], shifts[D][i]));

      const center = opsQ.div(sum, orb.length);

      for (const D of orb)
        result[D].push(opsQ.plus(center, shifts[D][i]));
    }
  }

  return result;
};


const chamberBasis = corners =>
  corners.slice(1).map(v => opsQ.minus(v, corners[0]));


const chamberDeterminant = corners => {
  const M = chamberBasis(corners);

  if (M.length == 2)
    return opsQ.minus(
      opsQ.times(M[0][0], M[1][1]),
      opsQ.times(M[0][1], M[1][0])
    );
  else if (M.length == 3)
    return opsQ.times(M[0], opsQ.crossProduct(M[1], M[2]));
  else
    return opsQ.determinant(M);
};


const normalizedOrientation = (cov, pos) => {
  const ori = props.partialOrientation(cov);

  let vol = opsQ.vector(cov.dim);
  for (const D of cov.elements())
    vol = opsQ.plus(vol, opsQ.times(ori[D], chamberDeterminant(pos[D])));

  if (opsQ.sgn(vol) < 0) {
    for (const D of cov.elements())
      ori[D] = -ori[D];
  }

  return ori;
};


const extrudeFace = (corners, faceIn, offset=0.1) => {
  const pos = [];
  for (const p of corners) {
    pos.push(p.concat(-offset));
    pos.push(p.concat(offset));
  }

  const f = faceIn.map(i => 2 * i);
  const n = f.length;

  const faces = [f, f.map(x => x + 1).reverse()];
  for (let i = 0; i < n; ++i) {
    const x = f[i];
    const y = f[(i + 1) % n];
    faces.push([y, x, x + 1, y + 1]);
  }

  return { pos, faces };
};


const orbitIndex = (ds, idcs, seeds) => {
  const orbits = props.orbits(ds, idcs, seeds);

  const result = {};
  for (let i = 0; i < orbits.length; ++i) {
    for (const D of orbits[i])
      result[D] = i;
  }

  return result;
}


export const tileSurfaces = (cov, skel, vertexPos, seeds) => {
  const ori = normalizedOrientation(cov, chamberPositions(cov, skel));
  const result = [];

  for (const D of seeds) {
    const tile = props.orbit(cov, range(0, cov.dim), D);
    const cornerIndex = orbitIndex(cov, range(1, cov.dim), tile);

    const pos = props.orbitReps(cov, range(1, cov.dim), tile).map(
      D => opsF.plus(vertexPos[skel.chamber2node[D]], skel.cornerShifts[D][0])
    );

    const faces = [];
    for (const D of props.orbitReps(cov, [0, 1], tile)) {
      const orb = props.orbit(cov, [0, 1], ori[D] > 0 ? cov.s(1, D) : D);
      faces.push(orb.filter((_, i) => i % 2 == 0).map(D => cornerIndex[D]));
    }

    if (cov.dim == 2)
      result.push(extrudeFace(pos, faces[0]));
    else
      result.push({ pos, faces });
  }

  return result;
};


const affineSymmetry = (D0, D1, E0, E1, pos) => {
  const linear = opsQ.solve(chamberBasis(pos[D0]), chamberBasis(pos[D1]));
  const shift = opsQ.minus(pos[E1][0], opsQ.times(pos[E0][0], linear));

  return opsQ.affineTransformation(opsQ.transposed(linear), shift);
};


export const affineSymmetries = (ds, cov, skel) => {
  const proj = props.morphism(cov, ds, 1, 1);
  const pos = chamberPositions(cov, skel);
  const D0 = cov.elements().find(D => opsQ.ne(chamberDeterminant(pos[D]), 0));

  const result = [];
  for (const D of cov.elements()) {
    if (proj[D] == 1) {
      const phi = props.morphism(cov, cov, D, 1);
      result.push(affineSymmetry(D0, phi[D0], D0, phi[D0], pos));
    }
  }

  return result;
};


export const tilesByTranslations = (ds, cov, skel) => {
  const tileClassIndex = orbitIndex(ds, range(0, cov.dim));
  const tileLatticeIndex = orbitIndex(cov, range(0, cov.dim));
  const proj = props.morphism(cov, ds, 1, 1);
  const pos = chamberPositions(cov, skel);
  const Dx = cov.elements().find(D => opsQ.ne(chamberDeterminant(pos[D]), 0));

  const orbitReps = [];
  const tiles = [];

  for (const chambers of props.orbits(cov, range(0, cov.dim))) {
    const classIndex = tileClassIndex[proj[chambers[0]]];
    if (orbitReps[classIndex] == null)
      orbitReps[classIndex] = chambers[0];

    const D0 = orbitReps[classIndex];
    const D1 = chambers.find(D => proj[D] == proj[D0]);
    const psi = props.morphism(cov, cov, D0, D1)
    const symmetry = affineSymmetry(Dx, psi[Dx], D0, D1, pos);

    const neighbors = props.orbitReps(cov, [0, 1], chambers).map(D => ({
      latticeIndex: tileLatticeIndex[cov.s(cov.dim, D)],
      shift: skel.edgeTranslations[D][cov.dim] || opsQ.vector(cov.dim)
    }));

    tiles.push({ chambers, classIndex, symmetry, neighbors });
  }

  const centers = orbitReps.map(D => pos[D][cov.dim]);

  return { orbitReps, tiles, centers };
};


export const makeCover = ds =>
  ds.dim == 3 ?
  delaney3d.pseudoToroidalCover(ds) :
  delaney2d.toroidalCover(ds);


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x && x.toString()).join(', ') + ' ]';
  };

  const delaney = require('./delaney');
  const unitCells = require('../spacegroups/unitCells');

  const test = ds => {
    console.log(`ds = ${ds}`);
    console.log(`is ${props.isOriented(ds) ? '' : 'not '}oriented`);
    console.log(`is ${props.isConnected(ds) ? '' : 'not '}connected`);

    const fg = fundamentalGroup(ds);
    console.log(`fundamental group: ${JSON.stringify(fg)}`);

    const cov = makeCover(ds);
    console.log(`cover = ${cov}`);

    const skel = skeleton(cov);
    console.log(`skeleton = ${skel.graph}`);

    const embedding = embed(skel.graph).spring;
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
      .sort((a, b) => opsQ.cmp(a, b))
      .forEach(t => console.log(t));

    const { orbitReps, tiles } = tilesByTranslations(ds, cov, skel);
    console.log(`tilings has ${tiles.length} tiles`);
    tiles
      .sort(
        (a, b) =>
          opsQ.cmp(a.classIndex, b.classIndex) ||
          opsQ.cmp(a.symmetry, b.symmetry)
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

  test(delaney.parse(
    '<011.1:96 3:2 3 5 7 9 10 12 14 15 17 18 20 21 22 24 26 27 29 31 33 34 36 38 40 42 44 46 48 50 52 54 56 58 59 60 62 64 66 68 69 71 73 75 76 78 79 81 82 84 85 86 87 88 90 91 92 93 94 95 96,79 3 9 6 8 12 92 94 15 86 18 60 21 23 34 59 27 33 30 32 40 37 39 46 43 45 52 49 51 58 55 57 66 63 65 95 69 75 72 74 78 87 91 82 93 85 90 96,4 5 10 12 11 80 81 66 65 18 63 64 33 32 22 31 30 28 29 34 41 42 53 54 48 47 58 57 51 52 55 56 60 83 84 70 71 76 78 77 90 89 82 86 88 92 94 96,13 14 15 44 43 42 41 46 45 88 89 90 24 23 22 81 80 91 68 67 95 47 48 49 50 51 52 86 75 74 73 72 71 70 61 62 63 64 65 66 69 82 93 84 83 94 87 96:4 3 4 4 4 4 4 4 3 3 3 3 3 3 4 3 4 4 4 4,3 3 3 3 3 3 3 3 3 3 3 3 3 3 3 3,6 8 3 3 6 3 3 6 6 4>'
  ));
}
