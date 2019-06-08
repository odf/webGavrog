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


const range = n => [...Array(n).keys()];
const normalized = v => opsF.div(v, opsF.norm(v));


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

  const bottom = range(n).map(i => [
    Math.cos(a * i) * radius, Math.sin(a * i) * radius, 0
  ]);
  const top = range(n).map(i => [
    Math.cos(a * i) * radius, Math.sin(a * i) * radius, 1
  ]);
  const vertices = [].concat(bottom, top);

  const faces = range(n).map(i => {
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


const baseShifts = dim => dim == 3 ?
  cartesian([0, 1], [0, 1], [0, 1]) :
  cartesian(range(6), range(6));


const addUnitCell = (model, basis, ballRadius, stickRadius) => {
  stickRadius += 0.001;

  const meshes = model.meshes.slice();
  const instances = model.instances.slice();

  const n = meshes.length;
  meshes.push(makeBall(ballRadius));
  meshes.push(makeStick(stickRadius, 48));

  for (const coeffs of cartesian([0, 1], [0, 1], [0, 1])) {
    const p = opsF.times(coeffs, basis);
    instances.push({
      meshType: 'cellEdge',
      meshIndex: n,
      transform: { basis: opsF.identityMatrix(3), shift: p },
      extraShift: [ 0, 0, 0 ]
    });
  }

  for (let i = 0; i < 3; ++i) {
    const [u, v, w] = [basis[i % 3], basis[(i + 1) % 3], basis[(i + 2) % 3]];

    for (const p of [[0, 0, 0], v, w, opsF.plus(v, w)]) {
      instances.push({
        meshType: 'cellEdge',
        meshIndex: n + 1,
        transform: stickTransform(p, opsF.plus(p, u), ballRadius, stickRadius),
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


const coordinateChangeAsFloat = cc => {
  const tQ = cc.oldToNew;
  const tF = opsF.affineTransformation(
    opsQ.toJS(opsQ.linearPart(tQ)), opsQ.toJS(opsQ.shiftPart(tQ)));

  return opsF.coordinateChange(tF);
};


const makeNetDisplayList = (graph, toStdRaw, syms, embedding, shifts) => {
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
    if (e.tail < e.head || (e.tail == e.head && opsF.sgn(e.shift) < 0))
      addItem('edge', e.reverse(), opsF.plus(shift, e.shift));
    else
      addItem('edge', e, shift);
  };

  for (const shift of baseShifts(graph.dim)) {
    for (const edge of graph.edges) {
      addEdge(edge, shift);
      addNode(edge.head, shift);
      addNode(edge.tail, opsF.plus(shift, edge.shift));
    }
  }

  const toStd = coordinateChangeAsFloat(toStdRaw);
  const pos = embedding.positions;
  const centering = spacegroups.centeringLatticePoints(toStdRaw)
        .map(v => opsQ.toJS(v));

  const adj = periodic.adjacencies(graph);
  for (const { itemType, item, shift } of result) {
    if (itemType == 'node') {
      for (const edge of periodic.allIncidences(graph, item, adj)) {
        const key = encode(['node', edge.tail, opsF.plus(shift, edge.shift)]);
        if (itemsSeen[key])
          addEdge(edge, shift);
      }
    }
  }

  return result;
};


const preprocessNet = (structure, runJob, log) => csp.go(
  function*() {
    const t = util.timer();

    yield log('Normalizing shifts...');
    const graph = periodic.graphWithNormalizedShifts(structure.graph);
    console.log(`${Math.round(t())} msec to normalize shifts`);

    yield log('Computing an embedding...');
    const embeddings = yield runJob({ cmd: 'embedding', val: graph });
    console.log(`${Math.round(t())} msec to compute the embeddings`);

    yield log('Computing symmetries...');
    const syms = netSyms.symmetries(graph).symmetries;
    const symOps = netSyms.affineSymmetries(graph, syms);
    console.log(`${Math.round(t())} msec to compute symmetries`);

    yield log('Identifying the spacegroup...');
    const sgInfo = sgFinder.identifySpacegroup(symOps);
    console.log(`${Math.round(t())} msec to identify the spacegroup`);

    yield log('Constructing an abstract finite subnet...');
    const displayList = makeNetDisplayList(
      graph,
      sgInfo.toStd,
      syms,
      embeddings.barycentric,
      baseShifts(graph.dim)
    );
    console.log(`${Math.round(t())} msec to construct a finite subnet`);

    return {
      type: structure.type,
      dim: graph.dim, graph,
      sgInfo,
      embeddings,
      displayList
    };
  }
);


const makeNetModel = (data, options, runJob, log) => csp.go(
  function*() {
    const { graph, embeddings, displayList } = data;

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
      const { itemType, item, shift } = displayList[i];

      if (itemType == 'node') {
        const p = opsF.times(pos[item], basis);

        instances.push({
          meshType: 'netVertex',
          meshIndex: 0,
          instanceIndex: i,
          transform: { basis: opsF.identityMatrix(3), shift: p },
          extraShiftCryst: shift,
          extraShift: opsF.times(shift, basis)
        })
      }
      else {
        const p = opsF.times(pos[item.head], basis);
        const q = opsF.times(opsF.plus(pos[item.tail], item.shift), basis);

        instances.push({
          meshType: 'netEdge',
          meshIndex: 1,
          instanceIndex: i,
          transform: stickTransform(p, q, ballRadius, stickRadius),
          extraShiftCryst: shift,
          extraShift: opsF.times(shift, basis)
        })
      }
    }
    console.log(`${Math.round(t())} msec to make the net geometry`);

    yield log('Done making the net model.');

    const model = { meshes, instances };
    return addUnitCell(model, lattices.reducedLatticeBasis(basis), 0.01, 0.01);
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
  const sym = opsQ.toJS(symmetry.map(v => v.slice(0, -1)));

  const basis = sym.slice(0, -1);
  const shift = sym.slice(-1)[0];

  const center = opsF.plus(opsF.times(centers[classIndex], basis), shift);

  if (shift.length == 2) {
    for (const v of basis)
      v.push(0);
    basis.push([0, 0, 1]);
    shift.push(0);
    center.push(0);
  }

  const transform = { basis, shift };

  return { classIndex, transform, center, neighbors };
};


const makeTileDisplayList = (tiles, shifts) => {
  const result = [];

  for (const s0 of shifts) {
    for (let latticeIndex = 0; latticeIndex < tiles.length; ++latticeIndex) {
      const c = tiles[latticeIndex].center.slice(0, s0.length);
      const s = opsF.minus(s0, c.map(x => opsF.floor(x)));
      const shift = [s[0], s[1], s[2] || 0];

      result.push({ itemType: 'tile', latticeIndex, shift });
    }
  }

  return result;
};


const preprocessTiling = (structure, runJob, log) => csp.go(
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
    yield log('Listing translation orbits of tiles...');

    const { orbitReps, centers: rawCenters, tiles: rawTiles } = yield runJob({
      cmd: 'tilesByTranslations',
      val: { ds, cov, skel }
    });
    console.log(`${Math.round(t())} msec to list the tile orbits`);

    const centers = rawCenters.map(v => opsQ.toJS(v));
    const tiles = rawTiles.map(tile => convertTile(tile, centers));
    const displayList = makeTileDisplayList(tiles, baseShifts(dim));

    yield log('Computing an embedding...');
    const embeddings = yield runJob({ cmd: 'embedding', val: skel.graph });
    console.log(`${Math.round(t())} msec to compute the embeddings`);

    return {
      type, dim, ds, cov, skel, tiles, orbitReps, embeddings, displayList
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
      shift: opsF.plus(opsF.times(tile.transform.shift, b1),
                      opsF.times(tile.center, b2))
    };

    return Object.assign({}, tile, { transform });
  });
};


const makeTileInstances = (displayList, tiles, partLists, basis) => {
  const instances = [];

  for (let i = 0; i < displayList.length; ++i) {
    const { latticeIndex, shift, skippedParts } = displayList[i];
    const { classIndex, transform, neighbors } = tiles[latticeIndex];
    const parts = partLists[classIndex];

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
  const { ds, cov, skel, tiles, orbitReps, embeddings, displayList } = data;

  const dim = delaney.dim(ds);

  const embedding =
        options.skipRelaxation ? embeddings.barycentric : embeddings.relaxed;

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
      { subMeshes: meshes, partLists: range(meshes.length).map(i => [i]) } :
      splitMeshes(meshes, faceLabelLists);
  }

  const { subMeshes, partLists } = embedding[key];

  const scale = dim == 2 ? options.tileScale2d || 1.00 :
        Math.min(0.999, options.tileScale || 0.85);

  const mappedTiles = mapTiles(tiles, basis, scale);
  const instances = makeTileInstances(
    displayList, mappedTiles, partLists, basis
  );

  return addUnitCell(
    { meshes: subMeshes, instances },
    lattices.reducedLatticeBasis(basis),
    0.01,
    0.01
  );
});


const preprocessors = {
  tiling        : preprocessTiling,
  periodic_graph: preprocessNet,
  net           : preprocessNet,
  crystal       : preprocessNet
};


const builders = {
  tiling        : makeTilingModel,
  periodic_graph: makeNetModel,
  net           : makeNetModel,
  crystal       : makeNetModel
};


export const preprocess = (structure, runJob, log) => csp.go(
  function*() {
    const type = structure.type;
    const preprocessor = preprocessors[type];

    if (preprocessor == null)
      throw new Error(`preprocessing not implemented for type ${type}`);

    const result = yield preprocessor(structure, runJob, log);

    yield log('');
    return result;
  }
);


export const makeScene = (data, options, runJob, log) => csp.go(
  function*() {
    const type = data.type;
    const builder = builders[type];

    if (builder == null)
      throw new Error(`rendering not implemented for type ${type}`);

    const model = yield builder(data, options, runJob, log);

    yield log('');
    return model;
  }
);
