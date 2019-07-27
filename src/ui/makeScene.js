import * as csp from 'plexus-csp';

import * as pickler from '../common/pickler';
import * as util from '../common/util';
import * as delaney from '../dsymbols/delaney';
import * as properties from '../dsymbols/properties';
import * as tilings from '../dsymbols/tilings';
import * as lattices from '../geometry/lattices';
import * as unitCells from '../geometry/unitCells';
import * as spacegroups from '../geometry/spacegroups';
import * as sgFinder from '../geometry/spacegroupFinder';
import * as periodic from '../pgraphs/periodic';
import * as netSyms from '../pgraphs/symmetries';
import {subD} from './surface';

import {
  coordinateChangesQ,
  coordinateChangesF
} from '../geometry/types';

const opsQ = coordinateChangesQ;
const opsF = coordinateChangesF;

const encode = pickler.serialize;
const decode = pickler.deserialize;


const range = (n, m) => [...Array(m - n).keys()].map(i => i + n);
const normalized = v => opsF.div(v, opsF.norm(v));
const asVec3 = v => [v[0], v[1], v[2] || 0];


const geometry = (vertsIn, faces) => {
  const normals = vertsIn.map(v => opsF.times(v, 0));

  for (const f of faces) {
    const n = f.length;
    for (let i = 0; i < n; ++i) {
      const u = f[i];
      const v = f[(i + 1) % n];
      const w = f[(i + 2) % n];

      const a = opsF.minus(vertsIn[u], vertsIn[v]);
      const b = opsF.minus(vertsIn[w], vertsIn[v]);

      normals[v] = opsF.plus(normals[v], opsF.crossProduct(b, a));
    }
  }

  const vertices = vertsIn.map((v, i) => ({
    pos: v,
    normal: normalized(normals[i])
  }));

  return { vertices, faces }
};


const splitGeometry = ({ vertices, faces }, faceLabels) => {
  const facesByLabel = {};

  for (let f = 0; f < faces.length; ++f) {
    const label = faceLabels[f];
    if (facesByLabel[label] == null)
      facesByLabel[label] = [];
    facesByLabel[label].push(faces[f]);
  }

  const subMeshes = {};
  for (const label of Object.keys(facesByLabel)) {
    const vertexMap = {};
    const subVerts = [];
    for (const vs of facesByLabel[label]) {
      for (const v of vs) {
        if (vertexMap[v] == null) {
          vertexMap[v] = subVerts.length;
          subVerts.push(vertices[v]);
        }
      }
    };

    const subFaces = facesByLabel[label].map(vs => vs.map(v => vertexMap[v]));
    subMeshes[label] = { vertices: subVerts, faces: subFaces };
  }

  return subMeshes;
};


const makeBall = radius => {
  const t0 = {
    pos: [[1,0,0], [0,1,0], [0,0,1], [-1,0,0], [0,-1,0], [0,0,-1]],
    faces : [[0,1,2], [1,0,5], [2,1,3], [0,2,4],
             [3,5,4], [5,3,1], [4,5,0], [3,4,2]],
    isFixed: [false, false, false, false, false, false]
  };
  const t = subD(subD(subD(t0)));

  return geometry(t.pos.map(v => opsF.times(normalized(v), radius)), t.faces);
};


const makeStick = (radius, segments) => {
  const n = segments;
  const a = Math.PI * 2 / n;

  const bottom = range(0, n).map(i => [
    Math.cos(a * i) * radius, Math.sin(a * i) * radius, 0
  ]);
  const top = range(0, n).map(i => [
    Math.cos(a * i) * radius, Math.sin(a * i) * radius, 1
  ]);
  const vertices = [].concat(bottom, top);

  const faces = range(0, n).map(i => {
    const j = (i + 1) % n;
    return [i, j, j+n, i+n];
  });

  return geometry(vertices, faces);
};


const stickTransform = (p, q, ballRadius, stickRadius) => {
  const w = opsF.minus(q, p);
  const d = normalized(w);
  const ex = [1,0,0];
  const ey = [0,1,0];
  const t = Math.abs(opsF.times(d, ex)) > 0.9 ? ey : ex;
  const u = normalized(opsF.crossProduct(d, t));
  const v = normalized(opsF.crossProduct(d, u));

  const r = Math.min(ballRadius, stickRadius);
  const s = Math.sqrt(ballRadius * ballRadius - r * r);
  const p1 = opsF.plus(p, opsF.times(s, d));
  const w1 = opsF.minus(w, opsF.times(2 * s, d));

  return { basis: [ u, v, w1 ], shift: p1 };
};


const flatMap   = (fn, xs) => [].concat.apply([], xs.map(fn));

const cartesian = (...vs) => (
  vs.length == 0 ?
    [[]] :
    flatMap(xs => vs[vs.length - 1].map(y => xs.concat(y)),
            cartesian(...vs.slice(0, -1)))
);


const centeredRange = n =>
      range(Math.floor(n/2) - n + 1, Math.floor(n/2) + 1);


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
  meshes.push(makeBall(ballRadius));
  meshes.push(makeStick(stickRadius, 48));

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
      const transform = stickTransform(
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


export const addTiles = (displayList, selection) => {
  const result = [];
  const seen = {};

  for (const { partIndex, neighbors, extraShiftCryst } of selection) {
    const { latticeIndex, shift } = neighbors[partIndex];
    const item = {
      itemType: 'tile',
      latticeIndex,
      shift: opsF.plus(extraShiftCryst, shift)
    };
    const key = pickler.serialize(item);

    if (!seen[key]) {
      result.push(item);
      seen[key] = true;
    }
  }

  for (const item of displayList) {
    const key = pickler.serialize({
      itemType: item.itemType,
      latticeIndex: item.latticeIndex,
      shift: item.shift
    });

    if (!seen[key]) {
      result.push(item);
      seen[key] = true;
    }
  }

  return result;
};


export const addCoronas = (displayList, selection) => {
  const result = [];
  const seen = {};

  for (const { partIndex, neighbors, extraShiftCryst } of selection) {
    for (const { latticeIndex, shift } of neighbors) {
      const item = {
        itemType: 'tile',
        latticeIndex,
        shift: opsF.plus(extraShiftCryst, shift)
      };
      const key = pickler.serialize(item);

      if (!seen[key]) {
        result.push(item);
        seen[key] = true;
      }
    }
  }

  for (const item of displayList) {
    const key = pickler.serialize({
      itemType: item.itemType,
      latticeIndex: item.latticeIndex,
      shift: item.shift
    });

    if (!seen[key]) {
      result.push(item);
      seen[key] = true;
    }
  }

  return result;
};


export const restoreTiles = (displayList, selection) => {
  const toBeRestored = {};
  for (const inst of selection)
    toBeRestored[inst.instanceIndex] = true;

  return displayList.map(
    (item, i) =>
      toBeRestored[i] ? Object.assign({}, item, { skippedParts: {} }) : item
  );
};


export const removeTiles = (displayList, selection) => {
  const toBeRemoved = {};
  for (const inst of selection)
    toBeRemoved[inst.instanceIndex] = true;

  return displayList.filter((_, i) => !toBeRemoved[i]);
};


export const removeElements = (displayList, selection) => {
  const toBeRemoved = {};
  for (const inst of selection) {
    if (inst.partIndex != null) {
      if (toBeRemoved[inst.instanceIndex] == null)
        toBeRemoved[inst.instanceIndex] = {};
      toBeRemoved[inst.instanceIndex][inst.partIndex] = true;
    }
    else
      toBeRemoved[inst.instanceIndex] = true;
  }

  return displayList
    .filter((_, i) => toBeRemoved[i] != true)
    .map((item, i) => {
      if (toBeRemoved[i]) {
        const skippedParts = Object.assign({}, item.skippedParts || {});
        for (const j of Object.keys(toBeRemoved[i]))
          skippedParts[j] = true;
        return Object.assign({}, item, { skippedParts });
      }
      else
        return item;
    });
};


const nodesInUnitCell = (graph, pos, toStd, centeringShifts) => {
  const result = [];

  for (const v of periodic.vertices(graph)) {
    const p0 = opsQ.times(toStd, pos[v]);
    for (const s of centeringShifts) {
      const p = opsQ.mod(opsQ.plus(p0, s), 1);
      result.push([v, opsQ.minus(p, p0)]);
    }
  }

  return result;
};


const makeNetDisplayList = (data, options) => {
  const { graph, sgInfo } = data;
  const { toStd } = sgInfo;
  const shifts = baseShifts(graph.dim, options);

  const itemsSeen = {};
  const result = [];

  const addItem = (itemType, item, shift) => {
    const key = encode([itemType, item, shift]);
    if (!itemsSeen[key]) {
      result.push({ itemType, item, shift });
      itemsSeen[key] = true;
    }
  };

  const addNode = (v, shift) => addItem('node', v, shift);

  const addEdge = (e, shift) => {
    if (e.tail < e.head || (e.tail == e.head && opsQ.sgn(e.shift) < 0))
      addItem('edge', e.reverse(), opsQ.plus(shift, e.shift));
    else
      addItem('edge', e, shift);
  };

  const pos= periodic.barycentricPlacement(graph);
  const centering = spacegroups.centeringLatticePoints(toStd);
  const fromStd = opsQ.inverse(toStd);
  const basis = opsQ.identityMatrix(graph.dim);

  for (const [p, v] of nodesInUnitCell(graph, pos, toStd, centering)) {
    const loc = opsQ.plus(v, opsQ.times(toStd, pos[p]));

    for (const s of shifts) {
      const extra = [opsQ.plus(s, v)];

      for (const i of range(0, graph.dim)) {
        if (loc[i] == 0)
          extra = extra.concat(extra.map(t => opsQ.plus(t, basis[i])));
      }

      for (const t of extra)
        addNode(p, opsQ.times(fromStd, t));
    }
  }

  const adj = periodic.adjacencies(graph);
  for (const { itemType, item, shift } of result) {
    if (itemType == 'node') {
      for (const edge of periodic.allIncidences(graph, item, adj)) {
        const key = encode(['node', edge.tail, opsQ.plus(shift, edge.shift)]);
        if (itemsSeen[key])
          addEdge(edge, shift);
      }
    }
  }

  return result;
};


const preprocessNet = (structure, options, runJob, log) => csp.go(
  function*() {
    const t = util.timer();

    yield log('Normalizing shifts...');
    const graph = periodic.graphWithNormalizedShifts(structure.graph);
    console.log(`${Math.round(t())} msec to normalize shifts`);

    yield log('Computing symmetries...');
    const syms = netSyms.symmetries(graph).symmetries;
    const symOps = netSyms.affineSymmetries(graph, syms);
    console.log(`${Math.round(t())} msec to compute symmetries`);

    yield log('Identifying the spacegroup...');
    const sgInfo = sgFinder.identifySpacegroup(symOps);
    console.log(`${Math.round(t())} msec to identify the spacegroup`);

    yield log('Constructing an abstract finite subnet...');
    const displayList = makeNetDisplayList({ graph, sgInfo }, options);
    console.log(`${Math.round(t())} msec to construct a finite subnet`);

    yield log('Computing an embedding...');
    const embeddings = yield runJob({ cmd: 'embedding', val: graph });
    console.log(`${Math.round(t())} msec to compute the embeddings`);

    return {
      type: structure.type,
      dim: graph.dim,
      graph,
      sgInfo,
      embeddings,
      displayList
    };
  }
);


const makeNetModel = (data, options, runJob, log) => csp.go(
  function*() {
    const { graph, sgInfo, embeddings, displayList } = data;

    const embedding =
          options.skipRelaxation ? embeddings.barycentric : embeddings.relaxed;
    const pos = embedding.positions;
    const basis = unitCells.invariantBasis(embedding.gram);
    const ballRadius = options.netVertexRadius || 0.1;
    const stickRadius = (options.netEdgeRadius || 0.04) + 0.001;

    const t = util.timer();

    yield log('Making the net geometry...');
    const meshes = [ makeBall(ballRadius), makeStick(stickRadius, 48) ];
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
        const transform = stickTransform(
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
    const o = opsQ.origin(graph.dim);
    const origin = graph.dim == 3 ?
          opsQ.vector(o) :
          opsF.times(opsQ.toJS(opsQ.vector(opsQ.times(fromStd, o))), basis);

    const model = { meshes, instances };

    if (options.showUnitCell)
      return addUnitCell(model, cellBasis, origin, 0.01, 0.01);
    else
      return model;
  }
);


const splitMeshes = (meshes, faceLabelLists) => {
  const subMeshes = [];
  const partLists = [];

  for (let i = 0; i < meshes.length; ++i) {
    const parts = splitGeometry(meshes[i], faceLabelLists[i]);
    const keys = Object.keys(parts);
    partLists[i] = [];

    for (const key of keys) {
      const index = key == 'undefined' ? (keys.length - 1) : parseInt(key);
      partLists[i][index] = subMeshes.length;
      subMeshes.push(parts[key]);
    }
  }

  return { subMeshes, partLists };
};


const convertTile = (tile, centers) => {
  const { classIndex, symmetry, neighbors } = tile;
  const sym = symmetry.map(v => v.slice(0, -1));

  const basis = sym.slice(0, -1);
  const shift = sym.slice(-1)[0];

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

  return { classIndex, transform, center, neighbors };
};


const tilesInUnitCell = (tiles, toStd, centeringShifts) => {
  const dim = opsQ.dimension(toStd);
  const result = [];

  for (let index = 0; index < tiles.length; ++index) {
    const c0 = opsQ.times(toStd, tiles[index].center.slice(0, dim));
    for (const s of centeringShifts) {
      const c = opsQ.mod(opsQ.plus(c0, s), 1);
      result.push([index, opsQ.minus(c, c0)]);
    }
  }

  return result;
};


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

  const centering = spacegroups.centeringLatticePoints(toStd);
  const fromStd = opsQ.inverse(toStd);

  for (const [index, v] of tilesInUnitCell(tiles, toStd, centering)) {
    for (const s of shifts)
      addTile(index, opsQ.times(fromStd, opsQ.plus(s, v)));
  }

  return result;
};


const preprocessTiling = (structure, options, runJob, log) => csp.go(
  function*() {
    const t = util.timer();

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
    const syms = tilings.facePreservingSymmetries(cov, skel);
    const symOps = netSyms.affineSymmetries(skel.graph, syms);
    console.log(`${Math.round(t())} msec to compute symmetries`);

    yield log('Identifying the spacegroup...');
    const sgInfo = sgFinder.identifySpacegroup(symOps);
    console.log(`${Math.round(t())} msec to identify the spacegroup`);

    yield log('Listing translation orbits of tiles...');
    const { orbitReps, centers, tiles: rawTiles } = yield runJob({
      cmd: 'tilesByTranslations',
      val: { ds, cov, skel }
    });
    console.log(`${Math.round(t())} msec to list the tile orbits`);

    const tiles = rawTiles.map(tile => convertTile(tile, centers));
    const displayList = makeTileDisplayList({ tiles, dim, sgInfo }, options);

    yield log('Computing an embedding...');
    const embeddings = yield runJob({ cmd: 'embedding', val: skel.graph });
    console.log(`${Math.round(t())} msec to compute the embeddings`);

    return {
      type,
      dim,
      ds,
      cov,
      skel,
      sgInfo,
      tiles,
      orbitReps,
      embeddings,
      displayList
    };
  }
);


const makeMeshes = (
  cov, skel, pos, seeds, basis, subDLevel, tighten, edgeWidth, runJob, log
) => csp.go(function*() {
  const t = util.timer();

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


const makeTilingModel = (data, options, runJob, log) => csp.go(function*() {
  const {
    ds, cov, skel, tiles, orbitReps, sgInfo, embeddings, displayList
  } = data;

  const dim = delaney.dim(ds);

  const embedding =
        options.skipRelaxation ? embeddings.barycentric : embeddings.relaxed;

  const rawBasis = unitCells.invariantBasis(embedding.gram);
  const basis = unitCells.invariantBasis(embedding.gram);
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
    const meshes = rawMeshes.map(({ pos, faces }) => geometry(pos, faces));
    const faceLabelLists = rawMeshes.map(({ faceLabels }) => faceLabels);

    embedding[key] = dim == 2 ?
      { subMeshes: meshes, partLists: range(0, meshes.length).map(i => [i]) } :
      splitMeshes(meshes, faceLabelLists);
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

  const o = opsQ.origin(dim);
  const origin = dim == 3 ?
        opsQ.vector(o) :
        opsF.times(opsQ.toJS(opsQ.vector(opsQ.times(fromStd, o))), rawBasis);

  if (options.showUnitCell)
    return addUnitCell(model, cellBasis, origin, 0.01, 0.01);
  else
    return model;
});


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
