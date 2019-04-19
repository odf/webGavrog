import * as csp   from 'plexus-csp';

import * as util        from '../common/util';
import * as delaney     from '../dsymbols/delaney';
import * as properties  from '../dsymbols/properties';
import * as tilings     from '../dsymbols/tilings';
import * as lattices    from '../geometry/lattices';
import * as unitCells   from '../geometry/unitCells';
import * as periodic    from '../pgraphs/periodic';
import * as netSyms     from '../pgraphs/symmetries';
import {subD}           from './surface';

import {
  rationalLinearAlgebraModular,
  numericalLinearAlgebra
} from '../arithmetic/types';

const opsR = rationalLinearAlgebraModular;
const ops = numericalLinearAlgebra;


const range = n => [...Array(n).keys()];
const normalized = v => ops.div(v, ops.norm(v));

const white = { hue: 0, saturation: 0, lightness: 1 };
const black = { hue: 0, saturation: 0, lightness: 0 };


const baseMaterial = {
  ambientColor: black,
  diffuseColor: black,
  specularColor: white,
  ka: 0.0,
  kd: 1.0,
  ks: 0.2,
  shininess: 15.0
};


const netMaterial = color => Object.assign({}, baseMaterial, {
  diffuseColor: color,
  shininess: 50.0
});


const tilingMaterial = color => Object.assign({}, baseMaterial, {
  diffuseColor: color,
  shininess: 15.0
});


const geometry = (vertsIn, faces) => {
  const normals = vertsIn.map(v => ops.times(v, 0));

  for (const f of faces) {
    const n = f.length;
    for (let i = 0; i < n; ++i) {
      const u = f[i];
      const v = f[(i + 1) % n];
      const w = f[(i + 2) % n];

      const a = ops.minus(vertsIn[u], vertsIn[v]);
      const b = ops.minus(vertsIn[w], vertsIn[v]);

      normals[v] = ops.plus(normals[v], ops.crossProduct(b, a));
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


const makeStick = (radius, segments) => {
  const n = segments;
  const a = Math.PI * 2 / n;

  const section = range(n).map(i => [
    Math.cos(a * i) * radius,
    Math.sin(a * i) * radius,
    0
  ]);

  const vertices =
        [].concat(section, section.map(c => ops.plus(c, [0, 0, 1])));

  const faces = range(n).map(i => {
    const j = (i + 1) % n;
    return [i, j, j+n, i+n];
  });

  return geometry(vertices, faces);
};


const makeBall = radius => {
  const t0 = {
    pos: [[1,0,0], [0,1,0], [0,0,1], [-1,0,0], [0,-1,0], [0,0,-1]],
    faces : [[0,1,2], [1,0,5], [2,1,3], [0,2,4],
             [3,5,4], [5,3,1], [4,5,0], [3,4,2]],
    isFixed: [false, false, false, false, false, false]
  };
  const t = subD(subD(subD(t0)));

  return geometry(
    t.pos.map(v => ops.times(normalized(v), radius)),
    t.faces
  );
};


const ballAndStick = (
  positions,
  edges,
  ballRadius=0.1,
  stickRadius=0.04,
  ballColor={ hue: 0.13, saturation: 0.7, lightness: 0.7 },
  stickColor={ hue: 0.63, saturation: 0.6, lightness: 0.6 }
) => {
  const meshes = [ makeBall(ballRadius), makeStick(stickRadius, 48) ];
  const materials = [ netMaterial(ballColor), netMaterial(stickColor) ];
  const instances = [];

  positions.forEach(p => {
    instances.push({
      meshIndex: 0,
      materialIndex: 0,
      transform: {
        basis: [ [ 1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, 1 ] ],
        shift: [ p[0], p[1], p[2] || 0 ]
      },
      extraShift: [ 0, 0, 0 ]
    })
  });

  edges.forEach(e => {
    const p = positions[e[0]];
    const q = positions[e[1]];

    const w = ops.minus(q, p);
    const d = normalized(w);
    const ex = [1,0,0];
    const ey = [0,1,0];
    const t = Math.abs(ops.times(d, ex)) > 0.9 ? ey : ex;
    const u = normalized(ops.crossProduct(d, t));
    const v = normalized(ops.crossProduct(d, u));

    const r = Math.min(ballRadius, stickRadius);
    const s = Math.sqrt(ballRadius * ballRadius - r * r);
    const p1 = ops.plus(p, ops.times(s, d));
    const w1 = ops.minus(w, ops.times(2 * s, d));

    instances.push({
      meshIndex: 1,
      materialIndex: 1,
      transform: {
        basis: [ u, v, w1 ],
        shift: [ p1[0], p1[1], p1[2] || 0 ]
      },
      extraShift: [ 0, 0, 0 ]
    })
  });

  return { meshes, materials, instances };
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


const preprocessNet = (structure, runJob, log) => csp.go(
  function*() {
    const t = util.timer();

    yield log('Normalizing shifts...');
    const graph = periodic.graphWithNormalizedShifts(structure.graph);
    console.log(`${Math.round(t())} msec to normalize shifts`);

    yield log('Computing an embedding...');
    const embeddings = yield runJob({ cmd: 'embedding', val: graph });
    console.log(`${Math.round(t())} msec to compute the embeddings`);

    return { type: structure.type, graph, embeddings };
  }
);


const makeNetModel = (data, options, runJob, log) => csp.go(
  function*() {
    const { graph, embeddings } = data;

    const embedding =
          options.skipRelaxation ? embeddings.barycentric : embeddings.relaxed;
    const pos = embedding.positions;
    const basis = unitCells.invariantBasis(embedding.gram);

    const t = util.timer();

    yield log('Constructing an abstract finite subnet...');
    const nodeIndex = {};
    const points = [];
    const edges = [];

    for (const s of baseShifts(graph.dim)) {
      for (const e of graph.edges) {
        edges.push([[e.head, s], [e.tail, ops.plus(s, e.shift)]].map(
          ([node, shift]) => {
            const key = JSON.stringify([node, shift]);
            const idx = nodeIndex[key] || points.length;
            if (idx == points.length) {
              points.push(ops.times(ops.plus(pos[node], shift), basis));
              nodeIndex[key] = idx;
            }
            return idx;
          }));
      }
    }
    console.log(`${Math.round(t())} msec to construct a finite subnet`);

    yield log('Making the net geometry...');
    const model = ballAndStick(
      points, edges,
      options.netVertexRadius, options.netEdgeRadius,
      options.netVertexColor, options.netEdgeColor
    );
    console.log(`${Math.round(t())} msec to make the net geometry`);

    yield log('Done making the net model.');
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
  const { templateIndex: meshIndex, symmetry, neighbors } = tile;
  const sym = opsR.toJS(symmetry.map(v => v.slice(0, -1)));

  const basis = sym.slice(0, -1);
  const shift = sym.slice(-1)[0];

  const center = ops.plus(ops.times(centers[meshIndex], basis), shift);

  if (shift.length == 2) {
    for (const v of basis)
      v.push(0);
    basis.push([0, 0, 1]);
    shift.push(0);
    center.push(0);
  }

  const transform = { basis, shift };

  return { meshIndex, transform, center, neighbors };
};


const makeDisplayList = (tiles, shifts) => {
  const result = [];

  for (const s0 of shifts) {
    for (let tileIndex = 0; tileIndex < tiles.length; ++tileIndex) {
      const c = tiles[tileIndex].center.slice(0, s0.length);
      const s = ops.minus(s0, c.map(x => ops.floor(x)));
      const extraShift = [s[0], s[1], s[2] || 0];

      result.push({ tileIndex, extraShift });
    }
  }

  return result;
};


const displayListToModel = (
  displayList, tiles, meshes, partLists, materials, cell, options
) => {
  const dim = ops.dimension(cell);
  const extCell = dim == 2 ?
        cell.map(v => v.concat(0)).concat([[0, 0, 1]]) : cell;
  const invCell = ops.inverse(extCell);
  const scale2d = options.tileScale2d || 1.00;
  const scale3d = options.tileScale || 0.85;
  const scale = Math.min(0.999, dim == 2 ? scale2d : scale3d);

  const instances = [];

  for (let i = 0; i < displayList.length; ++i) {
    const { tileIndex, extraShift, skippedParts } = displayList[i];
    const { meshIndex, transform: t, center, neighbors } = tiles[tileIndex];
    const parts = partLists[meshIndex];

    const transform = {
      basis: ops.times(scale, ops.times(invCell, ops.times(t.basis, extCell))),
      shift: ops.plus(ops.times(scale, ops.times(t.shift, extCell)),
                      ops.times(1.0 - scale, ops.times(center, extCell)))
    };

    const colorByTrans = dim == 2 ?
          options.colorByTranslationClass2d : options.colorByTranslationClass;
    const baseMatIndex = colorByTrans ? tileIndex : meshIndex;

    for (let j = 0; j < parts.length; ++j) {
      if (skippedParts && skippedParts[j])
        continue;

      const drawEdges = dim == 2 ? options.drawEdges2d : options.drawEdges;
      const materialIndex = (j == parts.length - 1 && drawEdges) ?
            materials.length - 1 : baseMatIndex;

      instances.push({
        meshIndex: parts[j],
        materialIndex,
        tileIndex: i,
        partIndex: j,
        transform,
        extraShiftCryst: extraShift,
        extraShift: ops.times(extraShift, extCell),
        neighbors
      });
    }
  }

  return { meshes, materials, instances };
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

    const centers = rawCenters.map(v => opsR.toJS(v));
    const tiles = rawTiles.map(tile => convertTile(tile, centers));
    const displayList = makeDisplayList(tiles, baseShifts(dim));

    yield log('Computing an embedding...');
    const embeddings = yield runJob({ cmd: 'embedding', val: skel.graph });
    console.log(`${Math.round(t())} msec to compute the embeddings`);

    const idcs = [...Array(dim).keys()];
    const nrTemplates = properties.orbitReps(ds, idcs).length;
    const nrTiles = properties.orbitReps(cov, idcs).length;

    const tau = (Math.sqrt(5) - 1) / 2;
    const baseHue = Math.random();
    const materials = range(nrTiles)
          .map(i => (baseHue + i * tau) % 1)
          .map(hue => ({ hue, saturation: 1.0, lightness: 0.7 }))
          .map(tilingMaterial);

    return {
      type, ds, cov, skel, tiles, orbitReps, embeddings, materials, displayList
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

  const b = basis.length == 3 ? basis :
        basis.map(v => v.concat(0)).concat([[0, 0, 1]]);

  yield log('Refining the tile surfaces...');
  const rawMeshes = yield runJob({
    cmd: 'processSolids',
    val: templates.map(({ pos, faces }) => ({
      pos: pos.map(v => ops.times(v, b)),
      faces,
      isFixed: pos.map(_ => true),
      subDLevel,
      tighten,
      edgeWidth
    }))
  });
  console.log(`${Math.round(t())} msec to refine the surfaces`);

  const meshes = rawMeshes.map(({ pos, faces }) => geometry(pos, faces));
  const faceLabelLists = rawMeshes.map(({ faceLabels }) => faceLabels);

  return splitMeshes(meshes, faceLabelLists);
});


const makeTilingModel = (data, options, runJob, log) => csp.go(function*() {
  const {
    ds, cov, skel, tiles, orbitReps, embeddings, materials, displayList
  } = data;

  const dim = delaney.dim(ds);
  const edgeColor = dim == 2 ? options.tileEdgeColor2d : options.tileEdgeColor;
  const palette = materials;
  palette.push(tilingMaterial(edgeColor || white));

  const embedding =
        options.skipRelaxation ? embeddings.barycentric : embeddings.relaxed;
  const pos = embedding.positions;
  const basis = unitCells.invariantBasis(embedding.gram);

  const subDLevel = (dim == 3 && options.extraSmooth) ? 3 : 2;
  const tighten = dim == 3 && !!options.tightenSurfaces;
  const edgeWidth2d = options.edgeWidth2d || 0.5;
  const edgeWidth3d = options.edgeWidth || 0.5;
  const edgeWidth = dim == 2 ? edgeWidth2d : edgeWidth3d;
  const key = `subd-${subDLevel} tighten-${tighten} edgeWidth-${edgeWidth}`;

  if (embedding[key] == null)
    embedding[key] = yield makeMeshes(
      cov, skel, pos, orbitReps, basis, subDLevel, tighten, edgeWidth,
      runJob, log
    );

  const { subMeshes, partLists } = embedding[key];

  const model = displayListToModel(
    displayList, tiles, subMeshes, partLists, palette, basis, options
  );

  return model;
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
