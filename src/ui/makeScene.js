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


const addUnitCell = (model, basis, origin, ballRadius, stickRadius) => {
  const asVec3 = v => [v[0], v[1], v[2] == null ? 0.1 : v[2]];

  stickRadius += 0.001;

  const meshes = model.meshes.slice();
  const instances = model.instances.slice();

  const n = meshes.length;
  meshes.push(geometries.makeBall(ballRadius));
  meshes.push(geometries.makeStick(stickRadius, 48));

  const dim = basis.length;
  const corners = dim == 3 ?
        cartesian([0, 1], [0, 1], [0, 1]) :
        cartesian([0, 1], [0, 1]);

  for (const coeffs of corners) {
    const p = opsF.plus(origin, opsF.times(coeffs, basis));

    instances.push({
      meshType: 'cellEdge',
      meshIndex: n,
      transform: { basis: opsF.identityMatrix(3), shift: asVec3(p) },
      extraShift: [ 0, 0, 0 ]
    });
  }

  for (let i = 0; i < dim; ++i) {
    const [u, v, w] = [
      basis[i % dim], basis[(i + 1) % dim], basis[(i + 2) % dim]
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

  const embedding =
        options.skipRelaxation ? embeddings.barycentric : embeddings.relaxed;
  const pos = embedding.positions;
  const basis = invariantBasis(embedding.gram);
  const ballRadius = withDefault(options.netVertexRadius, 0.1);
  const stickRadius = withDefault(options.netEdgeRadius, 0.04);

  const t = timer();

  yield log('Making the net geometry...');
  const meshes = [
    geometries.makeBall(ballRadius), geometries.makeStick(stickRadius, 48)
  ];
  const instances = [];

  for (let i = 0; i < displayList.length; ++i) {
    const { itemType, item, shift: shiftRaw } = displayList[i];
    const shift = opsQ.toJS(shiftRaw);

    if (itemType == 'node') {
      const p = opsF.times(pos[item], basis);

      instances.push({
        meshType: 'netVertex',
        meshIndex: 0,
        instanceIndex: i,
        transform: { basis: opsF.identityMatrix(3), shift: asVec3(p) },
        extraShiftCryst: asVec3(shift),
        extraShift: asVec3(opsF.times(shift, basis))
      })
    }
    else {
      const p = opsF.times(pos[item.head], basis);
      const q = opsF.times(opsF.plus(pos[item.tail], item.shift), basis);
      const transform = geometries.stickTransform(
        asVec3(p), asVec3(q), ballRadius, stickRadius
      );

      instances.push({
        meshType: 'netEdge',
        meshIndex: 1,
        instanceIndex: i,
        transform,
        extraShiftCryst: asVec3(shift),
        extraShift: asVec3(opsF.times(shift, basis))
      })
    }
  }
  console.log(`${Math.round(t())} msec to make the net geometry`);

  yield log('Done making the net model.');

  const fromStd = opsQ.inverse(sgInfo.toStd);
  const cellBasis = opsQ.identityMatrix(graph.dim).map(
    v => opsF.times(opsQ.toJS(opsQ.times(fromStd, v)), basis)
  );
  const o = opsQ.vector(graph.dim);
  const origin = opsF.times(opsQ.toJS(applyToPoint(fromStd, o)), basis);

  const model = { meshes, instances };

  if (options.showUnitCell)
    return addUnitCell(model, cellBasis, origin, 0.01, 0.01);
  else
    return model;
});


const preprocessTiling = (
  structure, options, runJob, log
) => csp.go(function*() {
  const t = timer();

  const mod = options.tilingModifier;
  if (mod == 'dual' || mod == 't-analog') {
    const fn = mod == 'dual' ? derived.dual : derived.tAnalog;
    structure = Object.assign(
      {},
      structure,
      {
        symbol: fn(structure.symbol),
        cover: structure.cover && fn(structure.cover)
      }
    )
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

  yield log('Computing symmetries...');
  const syms = tilings.affineSymmetries(ds, cov, skel);
  console.log(`${Math.round(t())} msec to compute symmetries`);

  yield log('Identifying the spacegroup...');
  const sgInfo = identifySpacegroup(syms);
  console.log(`${Math.round(t())} msec to identify the spacegroup`);

  yield log('Listing translation orbits of tiles...');
  const { orbitReps, centers, tiles: rawTiles } = yield runJob({
    cmd: 'tilesByTranslations',
    val: { ds, cov, skel }
  });
  console.log(`${Math.round(t())} msec to list the tile orbits`);

  const tiles = rawTiles.map(tile => convertTile(tile, centers));

  yield log('Computing an embedding...');
  const embeddings = yield runJob({ cmd: 'embedding', val: skel.graph });
  console.log(`${Math.round(t())} msec to compute the embeddings`);

  return { type, dim, ds, cov, skel, sgInfo, tiles, orbitReps, embeddings };
});


const makeTileDisplayList = (data, options) => {
  const { tiles, dim, sgInfo } = data;
  const { toStd } = sgInfo;
  const shifts = baseShifts(dim, options);

  const tilesSeen = {};
  const result = [];

  const addTile = (latticeIndex, shift) => {
    const key = encode([latticeIndex, shift]);
    if (!tilesSeen[key]) {
      if (shift.length == 2)
        shift.push(0);
      result.push({ itemType: 'tile', latticeIndex, shift });
      tilesSeen[key] = true;
    }
  };

  const centering = centeringLatticePoints(toStd);
  const fromStd = opsQ.inverse(toStd);

  for (const [index, v] of tilesInUnitCell(tiles, toStd, centering)) {
    for (const s of shifts)
      addTile(index, opsQ.times(fromStd, opsQ.plus(s, v)));
  }

  return result;
};


const makeTilingModel = (data, options, runJob, log) => csp.go(function*() {
  const {
    ds, cov, skel, tiles, orbitReps, sgInfo, embeddings, displayList
  } = data;

  const dim = delaney.dim(ds);

  const embedding =
        options.skipRelaxation ? embeddings.barycentric : embeddings.relaxed;

  const rawBasis = invariantBasis(embedding.gram);
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
    const rawMeshes = yield makeMeshes(
      cov, skel, embedding.positions, orbitReps, basis,
      subDLevel, tighten, edgeWidth, runJob, log
    );
    const meshes = rawMeshes.map(
      ({ pos, faces }) => geometries.geometry(pos, faces)
    );
    const faceLabelLists = rawMeshes.map(({ faceLabels }) => faceLabels);

    embedding[key] = dim == 2 ?
      { subMeshes: meshes, partLists: range(meshes.length).map(i => [i]) } :
      geometries.splitMeshes(meshes, faceLabelLists);
  }

  const { subMeshes, partLists } = embedding[key];

  const scale = dim == 2 ? options.tileScale2d || 1.00 :
        Math.min(0.999, options.tileScale || 0.85);

  const mappedTiles = mapTiles(tiles, basis, scale);
  const instances = makeTileInstances(
    displayList, mappedTiles, partLists, basis
  );

  const model = { meshes: subMeshes, instances };

  yield log('Done making the tiling model.');

  const fromStd = opsQ.inverse(sgInfo.toStd);
  const cellBasis = opsQ.identityMatrix(dim).map(
    v => opsF.times(opsQ.toJS(opsQ.times(fromStd, v)), rawBasis)
  );

  const o = opsQ.vector(dim);
  const origin = opsF.times(opsQ.toJS(applyToPoint(fromStd, o)), rawBasis);

  if (options.showUnitCell)
    return addUnitCell(model, cellBasis, origin, 0.01, 0.01);
  else
    return model;
});


const convertTile = (tile, centers) => {
  const basis = opsQ.transposed(opsQ.linearPart(tile.symmetry));
  const shift = opsQ.shiftPart(tile.symmetry);

  const classIndex = tile.classIndex;
  const center = opsQ.plus(opsQ.times(centers[classIndex], basis), shift);

  if (shift.length == 2) {
    for (const v of basis)
      v.push(0);
    basis.push([0, 0, 1]);
    shift.push(0);
    center.push(0);
  }

  const transform = {
    basis: opsQ.toJS(basis),
    shift: opsQ.toJS(shift)
  };

  const neighbors = tile.neighbors.map(({ latticeIndex, shift }) => ({
    itemType: 'tile',
    latticeIndex,
    shift
  }));

  return { classIndex, transform, center, neighbors };
};


const tilesInUnitCell = (tiles, toStd, centeringShifts) => {
  const dim = opsQ.dimension(toStd);
  const result = [];

  for (let index = 0; index < tiles.length; ++index) {
    const c0 = applyToPoint(toStd, tiles[index].center.slice(0, dim));
    for (const s of centeringShifts) {
      const c = opsQ.mod(opsQ.plus(c0, s), 1);
      result.push([index, opsQ.minus(c, c0)]);
    }
  }

  return result;
};


const makeMeshes = (
  cov, skel, pos, seeds, basis, subDLevel, tighten, edgeWidth, runJob, log
) => csp.go(function*() {
  const t = timer();

  yield log('Making the base tile surfaces...');
  const templates = yield runJob({
    cmd: 'tileSurfaces',
    val: { cov, skel, pos, seeds }
  });
  console.log(`${Math.round(t())} msec to make the base surfaces`);

  yield log('Refining the tile surfaces...');
  const rawMeshes = yield runJob({
    cmd: 'processSolids',
    val: templates.map(({ pos, faces }) => ({
      pos: pos.map(v => opsF.times(v, basis)),
      faces,
      isFixed: pos.map(_ => true),
      subDLevel,
      tighten,
      edgeWidth
    }))
  });
  console.log(`${Math.round(t())} msec to refine the surfaces`);

  return rawMeshes;
});


const mapTiles = (tiles, basis, scale) => {
  const invBasis = opsF.inverse(basis);
  const b1 = opsF.times(scale, basis);
  const b2 = opsF.times(1.0 - scale, basis);

  return tiles.map(tile => {
    const transform = {
      basis: opsF.times(invBasis, opsF.times(tile.transform.basis, b1)),
      shift: opsF.plus(
        opsF.times(tile.transform.shift, b1),
        opsF.times(opsQ.toJS(tile.center), b2)
      )
    };

    return Object.assign({}, tile, { transform });
  });
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

    const model = yield builder(data, options, runJob, log);

    yield log('');
    return model;
  }
);
