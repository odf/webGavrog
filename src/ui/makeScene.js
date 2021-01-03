import * as csp from 'plexus-csp';

import * as delaney from '../dsymbols/delaney';
import * as derived from '../dsymbols/derived';
import * as tilings from '../dsymbols/tilings';
import * as periodic from '../pgraphs/periodic';
import * as netSyms from '../pgraphs/symmetries';
import * as geometries from './geometries';

import { serialize as encode } from '../common/pickler';
import { timer } from '../common/timing';
import { invariantBasis } from '../spacegroups/unitCells';
import { centeringLatticePoints } from '../spacegroups/spacegroups';
import { identifySpacegroup } from '../spacegroups/spacegroupFinder';

import {
  coordinateChangesQ as opsQ,
  coordinateChangesF as opsF
} from '../geometry/types';


const range = n => [...Array(n).keys()];
const centeredRange = n => range(n).map(i => i - Math.ceil(n/2) + 1);
const withDefault = (value, fallback) => value != null ? value : fallback;

const asVec3 = v => [v[0], v[1], v[2] || 0];
const applyToPoint = (cc, vec) => opsQ.vector(opsQ.times(cc, opsQ.point(vec)));


const cartesian = (...vs) => (
  vs.length == 0 ?
    [[]] :
    [].concat(
      ...vs[0].map(v => cartesian(...vs.slice(1)).map(xs => [v].concat(xs)))
    )
);


const baseShifts = (dim, options) => dim == 3 ?
      cartesian(
        centeredRange(options.xExtent3d || 2),
        centeredRange(options.yExtent3d || 2),
        centeredRange(options.zExtent3d || 2)
      )
      :
      cartesian(
        centeredRange(options.xExtent2d || 5),
        centeredRange(options.yExtent2d || 5)
      );


const addUnitCell = (model, toStd, rawBasis, ballRadius, stickRadius) => {
  const asVec3 = v => [v[0], v[1], v[2] == null ? 0.1 : v[2]];

  const dim = opsQ.dimension(rawBasis);
  const fromStd = opsQ.inverse(toStd);
  const cellBasis = opsQ.identityMatrix(dim).map(
    v => opsF.times(opsQ.toJS(opsQ.times(fromStd, v)), rawBasis)
  );
  const origin = opsF.times(
    opsQ.toJS(applyToPoint(fromStd, opsQ.vector(dim))), rawBasis
  );

  stickRadius += 0.001;

  const meshes = model.meshes.slice();
  const instances = model.instances.slice();

  const n = meshes.length;
  meshes.push(geometries.makeBall(ballRadius));
  meshes.push(geometries.makeStick(stickRadius, 48));

  const corners = dim == 3 ?
        cartesian([0, 1], [0, 1], [0, 1]) :
        cartesian([0, 1], [0, 1]);

  for (const coeffs of corners) {
    const p = opsF.plus(origin, opsF.times(coeffs, cellBasis));

    instances.push({
      meshType: 'cellEdge',
      meshIndex: n,
      transform: { basis: opsF.identityMatrix(3), shift: asVec3(p) },
      extraShift: [ 0, 0, 0 ]
    });
  }

  for (let i = 0; i < dim; ++i) {
    const [u, v, w] = [
      cellBasis[i % dim], cellBasis[(i + 1) % dim], cellBasis[(i + 2) % dim]
    ];
    const startPoints = dim == 3 ?
          [[0, 0, 0], v, w, opsF.plus(v, w)] :
          [[0, 0], v];

    for (const p0 of startPoints) {
      const p = opsF.plus(origin, p0);
      const transform = geometries.stickTransform(
        asVec3(p), asVec3(opsF.plus(p, u)), ballRadius, stickRadius
      );

      instances.push({
        meshType: 'cellEdge',
        meshIndex: n + 1,
        transform,
        extraShift: [ 0, 0, 0 ]
      });
    }
  }

  return { meshes, instances };
};


const preprocessNet = (structure, options, runJob, log) => csp.go(function*() {
  const t = timer();

  yield log('Normalizing shifts...');
  const graph = periodic.graphWithNormalizedShifts(structure.graph);
  console.log(`${Math.round(t())} msec to normalize shifts`);

  yield log('Computing symmetries...');
  const syms = netSyms.symmetries(graph).symmetries;
  const symOps = netSyms.affineSymmetries(graph, syms);
  console.log(`${Math.round(t())} msec to compute symmetries`);

  yield log('Identifying the spacegroup...');
  const sgInfo = identifySpacegroup(symOps);
  console.log(`${Math.round(t())} msec to identify the spacegroup`);

  yield log('Computing an embedding...');
  const embeddings = yield runJob({ cmd: 'embedding', val: graph });
  console.log(`${Math.round(t())} msec to compute the embeddings`);

  return { type: structure.type, dim: graph.dim, graph, sgInfo, embeddings };
});


const makeNetDisplayList = (data, options) => {
  const itemsSeen = {};
  const result = [];

  const addItem = (itemType, item, shift) => {
    const key = encode([itemType, item, shift]);
    if (!itemsSeen[key]) {
      result.push({ itemType, item, shift });
      itemsSeen[key] = true;
    }
  };

  const { graph, sgInfo: { toStd } } = data;
  const pos = periodic.barycentricPlacement(graph);
  const fromStd = opsQ.inverse(toStd);
  const basis = opsQ.identityMatrix(graph.dim);

  for (const v of periodic.vertices(graph)) {
    const p = applyToPoint(toStd, pos[v]);

    for (const s of centeringLatticePoints(toStd)) {
      const loc = opsQ.mod(opsQ.plus(p, s), 1);
      const shift = opsQ.minus(loc, p);

      for (const sh of baseShifts(graph.dim, options)) {
        const copies = [opsQ.plus(sh, shift)];

        for (const i of range(graph.dim)) {
          if (loc[i] == 0)
            copies = copies.concat(copies.map(t => opsQ.plus(t, basis[i])));
        }

        for (const t of copies)
          addItem('node', v, opsQ.times(fromStd, t));

        if (copies.length == 1) {
          const b = opsQ.times(fromStd, copies[0]);
          for (const { tail: w, shift: s } of periodic.incidences(graph)[v])
            addItem('node', w, opsQ.plus(b, s));
        }
      }
    }
  }

  for (const { itemType, item, shift } of result) {
    if (itemType == 'node') {
      for (const e of periodic.incidences(graph)[item]) {
        const endShift = opsQ.plus(shift, e.shift);
        if (itemsSeen[encode(['node', e.tail, endShift])]) {
          if (e.tail < e.head || (e.tail == e.head && opsQ.sgn(e.shift) < 0))
            addItem('edge', e.reverse(), endShift);
          else
            addItem('edge', e, shift);
        }
      }
    }
  }

  return result;
};


const makeNetModel = (data, options, runJob, log) => csp.go(function*() {
  const { graph, sgInfo, embeddings, displayList } = data;

  yield log('Making the net model...');

  const { positions: pos, gram } = pickEmbedding(embeddings, options);
  const basis = invariantBasis(gram);
  const ballRadius = withDefault(options.netVertexRadius, 0.1);
  const stickRadius = withDefault(options.netEdgeRadius, 0.04);

  const t = timer();

  const meshes = [
    geometries.makeBall(ballRadius),
    geometries.makeStick(stickRadius, 48)
  ];
  const instances = [];

  for (let i = 0; i < displayList.length; ++i) {
    const { itemType, item, shift: shiftRaw } = displayList[i];
    const instanceIndex = i;
    const shift = opsQ.toJS(shiftRaw);
    const extraShiftCryst = asVec3(shift);
    const extraShift = asVec3(opsF.times(shift, basis));

    let meshType, meshIndex, transform;
    if (itemType == 'node') {
      const shift = asVec3(opsF.times(pos[item], basis));
      meshType = 'netVertex';
      meshIndex = 0;
      transform = { basis: opsF.identityMatrix(3), shift };
    }
    else {
      const { head, tail, shift } = item;
      const p = asVec3(opsF.times(pos[head], basis));
      const q = asVec3(opsF.times(opsF.plus(pos[tail], shift), basis));
      meshType = 'netEdge';
      meshIndex = 1;
      transform = geometries.stickTransform(p, q, ballRadius, stickRadius);
    }

    instances.push({
      meshType, meshIndex, instanceIndex, transform, extraShiftCryst, extraShift
    });
  }

  console.log(`${Math.round(t())} msec to make the net geometry`);

  return { meshes, instances };
});


const pickEmbedding = (embeddings, options) => {
  if (options.skipRelaxation)
    return embeddings.barycentric;
  else if (options.useSprings)
    return embeddings.spring;
  else
    return embeddings.relaxed;
};


const preprocessTiling = (
  structure, options, runJob, log
) => csp.go(function*() {
  const t = timer();

  const mod = options.tilingModifier;
  if (mod == 'dual' || mod == 't-analog') {
    const fn = mod == 'dual' ? derived.dual : derived.tAnalog;
    const symbol = fn(structure.symbol);
    const cover = structure.cover && fn(structure.cover);
    structure = Object.assign({}, structure, { symbol, cover });
  }

  const type = structure.type;
  const ds = structure.symbol;
  const dim = delaney.dim(ds);

  yield log('Finding the pseudo-toroidal cover...');
  const cov = yield structure.cover ||
        (yield runJob({ cmd: 'dsCover', val: ds }));
  console.log(`${Math.round(t())} msec to compute the cover`);

  yield log('Extracting the skeleton...');
  const skel = yield runJob({ cmd: 'skeleton', val: cov });
  console.log(`${Math.round(t())} msec to extract the skeleton`);

  yield log('Listing translation orbits of tiles...');
  const { orbitReps, centers, tiles: rawTiles } = yield runJob({
    cmd: 'tilesByTranslations',
    val: { ds, cov, skel }
  });
  console.log(`${Math.round(t())} msec to list the tile orbits`);

  yield log('Computing symmetries...');
  const syms = tilings.affineSymmetries(ds, cov, skel);
  console.log(`${Math.round(t())} msec to compute symmetries`);

  yield log('Identifying the spacegroup...');
  const sgInfo = identifySpacegroup(syms);
  console.log(`${Math.round(t())} msec to identify the spacegroup`);

  const tiles = rawTiles.map(tile => convertTile(tile, centers));

  yield log('Computing an embedding...');
  const embeddings = yield runJob({ cmd: 'embedding', val: skel.graph });
  console.log(`${Math.round(t())} msec to compute the embeddings`);

  return { type, dim, ds, cov, skel, sgInfo, tiles, orbitReps, embeddings };
});


const convertTile = (tile, centers) => {
  const basis = opsQ.transposed(opsQ.linearPart(tile.symmetry));
  const shift = opsQ.shiftPart(tile.symmetry);
  const center = opsQ.plus(opsQ.times(centers[tile.classIndex], basis), shift);

  if (shift.length == 2) {
    for (const v of basis)
      v.push(0);
    basis.push([0, 0, 1]);
    shift.push(0);
    center.push(0);
  }

  const transform = { basis: opsQ.toJS(basis), shift: opsQ.toJS(shift) };
  const classIndex = tile.classIndex;
  const itemType = 'tile';
  const neighbors = tile.neighbors.map(n => Object.assign({}, n, { itemType }));

  return { classIndex, transform, center, neighbors };
};


const makeTileDisplayList = ({ tiles, dim, sgInfo: { toStd } }, options) => {
  const shifts = baseShifts(dim, options);
  const centering = centeringLatticePoints(toStd);
  const fromStd = opsQ.inverse(toStd);

  const tilesSeen = {};
  const result = [];

  for (let latticeIndex = 0; latticeIndex < tiles.length; ++latticeIndex) {
    const c = applyToPoint(toStd, tiles[latticeIndex].center.slice(0, dim));

    for (const s of centering) {
      const v = opsQ.minus(opsQ.mod(opsQ.plus(c, s), 1), c);

      for (const sh of shifts) {
        const shift = asVec3(opsQ.times(fromStd, opsQ.plus(sh, v)));
        const key = encode([latticeIndex, shift]);

        if (!tilesSeen[key]) {
          result.push({ itemType: 'tile', latticeIndex, shift });
          tilesSeen[key] = true;
        }
      }
    }
  }

  return result;
};


const makeTilingModel = (data, options, runJob, log) => csp.go(function*() {
  const {
    ds, cov, skel, tiles, orbitReps, sgInfo, embeddings, displayList
  } = data;

  yield log('Making the tiling model...');

  const dim = delaney.dim(ds);

  const embedding = pickEmbedding(embeddings, options);

  const basis = invariantBasis(embedding.gram);
  if (dim == 2) {
    basis[0].push(0);
    basis[1].push(0);
    basis.push([0, 0, 1]);
  }

  const subDLevel = (dim == 3 && options.extraSmooth) ? 3 : 2;
  const tighten = dim == 3 && !!options.tightenSurfaces;
  const edgeWidth = options[dim == 2 ? 'edgeWidth2d' : 'edgeWidth'] || 0.5;
  const key = `subd-${subDLevel} tighten-${tighten} edgeWidth-${edgeWidth}`;

  if (embedding[key] == null) {
    const pos = embedding.positions;
    const seeds = orbitReps;
    const rawMeshes = yield runJob({
      cmd: 'makeTileMeshes',
      val: { cov, skel, pos, seeds, basis, subDLevel, tighten, edgeWidth }
    });

    const meshes = rawMeshes.map(m => geometries.geometry(m.pos, m.faces));
    const faceLabelLists = rawMeshes.map(m => m.faceLabels);

    if (dim == 2) {
      const partLists = range(meshes.length).map(i => [i]);
      embedding[key] = { subMeshes: meshes, partLists };
    }
    else
      embedding[key] = geometries.splitMeshes(meshes, faceLabelLists);
  }

  const scale = dim == 2 ?
        options.tileScale2d || 1.00 :
        Math.min(0.999, options.tileScale || 0.85);

  const mappedTiles = mapTiles(tiles, basis, scale);
  const instances = makeTileInstances(
    displayList, mappedTiles, embedding[key].partLists, basis
  );

  return { meshes: embedding[key].subMeshes, instances };
});


const mapTiles = (tiles, basis, scale) => {
  const invBasis = opsF.inverse(basis);
  const b1 = opsF.times(scale, basis);
  const b2 = opsF.times(1.0 - scale, basis);

  const result = [];

  for (const tile of tiles) {
    const basis = opsF.times(invBasis, opsF.times(tile.transform.basis, b1));
    const shift = opsF.plus(
      opsF.times(tile.transform.shift, b1),
      opsF.times(opsQ.toJS(tile.center), b2)
    );
    result.push(Object.assign({}, tile, { transform: { basis, shift } }));
  }

  return result;
};


const makeTileInstances = (displayList, tiles, partLists, basis) => {
  const instances = [];

  for (let i = 0; i < displayList.length; ++i) {
    const { latticeIndex, shift: shiftRaw, skippedParts } = displayList[i];
    const { classIndex, transform, neighbors } = tiles[latticeIndex];
    const parts = partLists[classIndex];
    const shift = opsQ.toJS(shiftRaw);

    for (let j = 0; j < parts.length; ++j) {
      if (skippedParts && skippedParts[j])
        continue;

      instances.push({
        meshType: (j < parts.length - 1) ? 'tileFace' : 'tileEdges',
        meshIndex: parts[j],
        classIndex,
        latticeIndex,
        instanceIndex: i,
        partIndex: j,
        transform,
        extraShiftCryst: shift,
        extraShift: opsF.times(shift, basis),
        neighbors
      });
    }
  }

  return instances;
};


const preprocessors = {
  tiling        : preprocessTiling,
  periodic_graph: preprocessNet,
  net           : preprocessNet,
  crystal       : preprocessNet
};


const displayListBuilders = {
  tiling        : makeTileDisplayList,
  periodic_graph: makeNetDisplayList,
  net           : makeNetDisplayList,
  crystal       : makeNetDisplayList
};


const sceneBuilders = {
  tiling        : makeTilingModel,
  periodic_graph: makeNetModel,
  net           : makeNetModel,
  crystal       : makeNetModel
};


export const preprocess = (structure, options, runJob, log) => csp.go(
  function*() {
    const type = structure.type;
    const preprocessor = preprocessors[type];

    if (preprocessor == null)
      throw new Error(`preprocessing not implemented for type ${type}`);

    const result = yield preprocessor(structure, options, runJob, log);

    yield log('');
    return result;
  }
);


export const makeDisplayList = (data, options, runJob, log) => csp.go(
  function*() {
    yield log('building fresh display list');
    const result = displayListBuilders[data.type](data, options);

    yield log('');
    return result;
  }
);


export const makeScene = (data, options, runJob, log) => csp.go(
  function*() {
    const type = data.type;
    const builder = sceneBuilders[type];

    if (builder == null)
      throw new Error(`rendering not implemented for type ${type}`);

    let model = yield builder(data, options, runJob, log);

    if (options.showUnitCell) {
      const embedding = pickEmbedding(data.embeddings, options);
      const basis = invariantBasis(embedding.gram);
      model = addUnitCell(model, data.sgInfo.toStd, basis, 0.01, 0.01);
    }

    yield log('');
    return model;
  }
);
