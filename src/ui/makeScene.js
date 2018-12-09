import * as csp   from 'plexus-csp';

import * as util        from '../common/util';
import * as delaney     from '../dsymbols/delaney';
import * as tilings     from '../dsymbols/tilings';
import * as lattices    from '../geometry/lattices';
import * as unitCells   from '../geometry/unitCells';
import * as periodic    from '../pgraphs/periodic';
import * as netSyms     from '../pgraphs/symmetries';
import {subD}           from '../graphics/surface';

import embed from '../pgraphs/embedding';

import { floatMatrices } from '../arithmetic/types';
const ops = floatMatrices;


const unitVec = v => ops.div(v, ops.norm(v));
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


const geometry = (vertsIn, faces, isWireframe=false) => {
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

  const vertices = vertsIn.map((v, i) => {
    const normal = unitVec(normals[i]);
    const pos = isWireframe ? ops.plus(v, ops.times(0.001, normal)) : v;
    return { pos, normal };
  });

  return { vertices, faces, isWireframe }
};


const makeStick = (p, q, radius, segments) => {
  const normalized = v => ops.div(v, ops.norm(v));

  if (p.length == 2) {
    p = p.concat(0);
    q = q.concat(0);
  }

  const n = segments;
  const d = normalized(ops.minus(q, p));
  const ex = [1,0,0];
  const ey = [0,1,0];
  const t = Math.abs(ops.times(d, ex)) > 0.9 ? ey : ex;
  const u = normalized(ops.crossProduct(d, t));
  const v = normalized(ops.crossProduct(d, u));
  const a = Math.PI * 2 / n;

  const section = [];
  for (let i = 0; i < n; ++i) {
    const x = a * i;
    const c = Math.cos(x) * radius;
    const s = Math.sin(x) * radius;
    section.push(ops.plus(ops.times(c, u), ops.times(s, v)));
  }

  const vertices = [].concat(section.map(c => ops.plus(c, p)),
                             section.map(c => ops.plus(c, q)));

  const faces = new Array(n).fill(0).map((_, i) => {
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
    t.pos.map(v => ops.times(unitVec(v), radius)),
    t.faces
  );
};


const ballAndStick = (
  positions,
  edges,
  ballRadius=0.1,
  stickRadius=0.04,
  ballColor={ hue: 0.14, saturation: 0.7, lightness: 0.7 },
  stickColor={ hue: 0.67, saturation: 0.3, lightness: 0.4 }
) => {
  const normalized = v => ops.div(v, ops.norm(v));
  const ball = makeBall(ballRadius);
  const stick = makeStick([0, 0, 0], [0, 0, 1], stickRadius, 12);

  const ballMaterial = Object.assign({}, baseMaterial, {
    diffuseColor: ballColor,
    shininess: 50.0
  });

  const stickMaterial = Object.assign({}, baseMaterial, {
    diffuseColor: stickColor,
    shininess: 50.0
  });

  const meshes = [ ball, stick ];
  const materials = [ ballMaterial, stickMaterial ];
  const instances = [];

  positions.forEach(p => {
    instances.push({
      meshIndex: 0,
      materialIndex: 0,
      transform: {
        basis: [ [ 1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, 1 ] ],
        shift: [ p[0], p[1], p[2] || 0 ]
      }
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

    instances.push({
      meshIndex: 1,
      materialIndex: 1,
      transform: {
        basis: [ u, v, w ],
        shift: [ p[0], p[1], p[2] || 0 ]
      }
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


const range = n => new Array(n).fill(0).map((_, i) => i);


const baseShifts = dim => dim == 3 ?
  cartesian([0, 1], [0, 1], [0, 1]) :
  cartesian(range(6), range(6));


const makeNetModel = (structure, options, runJob, log) => csp.go(function*() {
  const t = util.timer();

  yield log('Normalizing shifts...');
  const graph = periodic.graphWithNormalizedShifts(structure.graph);
  console.log(`${Math.round(t())} msec to normalize shifts`);

  yield log('Computing an embedding...');
  const embedding = yield runJob({
    cmd: 'embedding',
    val: { graph, relax: !options.skipRelaxation }
  });
  const basis = unitCells.invariantBasis(embedding.gram);
  const pos = embedding.positions;
  console.log(`${Math.round(t())} msec to compute an embedding`);

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
  const model = ballAndStick(points, edges);
  console.log(`${Math.round(t())} msec to make the net geometry`);

  yield log('Done making the net model.');
  return model;
});


const tileMaterial = hue => Object.assign({}, baseMaterial, {
  diffuseColor: {
    hue,
    saturation: 1.0,
    lightness: 0.7
  },
  shininess: 15.0
});


const materialPalette = (initialHue, nrHues) => (
  Array(nrHues).fill()
    .map((_, i) => tileMaterial((initialHue + i / nrHues) % 1))
);


const tilingModel = (
  surfaces, instances, options, basis, extensionFactor, shifts=[[0, 0, 0]]
) => {
  const hue0 = Math.random();

  const extend = v => ops.times(v, extensionFactor);
  const dVecs = lattices.dirichletVectors(basis).map(extend);

  const meshes = surfaces.map(({ pos, faces }) => geometry(pos, faces));
  const extraMeshes = (
    options.showSurfaceMesh ?
      surfaces.map(({ pos, faces }) => geometry(pos, faces, true))
    : []);

  const nrMaterials =
        options.colorByTranslationClass ? instances.length : surfaces.length;

  const materials = materialPalette(hue0, nrMaterials);
  if (options.showSurfaceMesh)
    materials.push(baseMaterial);

  const model = {
    meshes: meshes.concat(extraMeshes),
    materials,
    instances: []
  };

  for (let i = 0; i < instances.length; ++i) {
    const { templateIndex: kind, symmetry, center } = instances[i];

    const transform = {};
    if (symmetry.length == 3) {
      transform.basis = [
        symmetry[0],
        symmetry[1],
        [0, 0, 1]
      ];
      transform.shift = symmetry[2];
    }
    else {
      transform.basis = [
        symmetry[0].slice(0, 3),
        symmetry[1].slice(0, 3),
        symmetry[2].slice(0, 3)
      ];
      transform.shift = symmetry[3].slice(0, 3);
    }

    for (const s0 of shifts) {
      const c = ops.plus(center, s0);
      const s = ops.plus(s0, lattices.shiftIntoDirichletDomain(c, dVecs));

      model.instances.push({
        meshIndex: kind,
        materialIndex: options.colorByTranslationClass ? i : kind,
        transform: {
          basis: transform.basis,
          shift: ops.plus(transform.shift, [s[0], s[1], s[2] || 0])
        }
      });

      if (options.showSurfaceMesh) {
        model.instances.push({
          meshIndex: kind + surfaces.length,
          materialIndex: materials.length - 1,
          transform: {
            basis: transform.basis,
            shift: ops.plus(transform.shift, [s[0], s[1], s[2] || 0])
          }
        });
      }
    }
  }

  return model;
};


const makeTilingModel =
  (structure, options, runJob, log) => csp.go(function*() {

  const ds = structure.symbol;
  const dim = delaney.dim(ds);
  const extensionFactor = dim == 3 ? 2 : 6;

  const t = util.timer();

  yield log('Finding the pseudo-toroidal cover...');
  const cov = yield structure.cover || (yield runJob({
    cmd: 'dsCover',
    val: ds
  }));
  console.log(`${Math.round(t())} msec to compute the cover`);

  yield log('Extracting the skeleton...');
  const skel = yield runJob({
    cmd: 'skeleton',
    val: cov
  });
  console.log(`${Math.round(t())} msec to extract the skeleton`);

  yield log('Computing an embedding...');
  const embedding = yield runJob({
    cmd: 'embedding',
    val: { graph: skel.graph, relax: !options.skipRelaxation }
  });
  const pos = embedding.positions;
  console.log(`${Math.round(t())} msec to compute the embedding`);

  yield log('Computing a translation basis...');
  const basis = yield unitCells.invariantBasis(embedding.gram);
  console.log(`${Math.round(t())} msec to compute the translation basis`);

  yield log('Making the base tile surfaces...');
  const { templates, tiles } = yield runJob({
    cmd: 'tileSurfaces',
    val: { ds, cov, skel, pos, basis }
  });
  console.log(`${Math.round(t())} msec to make the base surfaces`);

  yield log('Refining the tile surfaces...');
  const refinedTemplates = yield runJob({
    cmd: 'processSolids',
    val: templates.map(({ pos, faces }) => ({
      pos,
      faces,
      isFixed: pos.map(_ => true),
      subDLevel: options.extraSmooth ? 3 : 2
    }))
  });
  console.log(`${Math.round(t())} msec to refine the surfaces`);

  yield log('Making the tiling geometry...');
  const shifts = baseShifts(dim).map(s => ops.times(s, basis));
  const model = tilingModel(
    refinedTemplates, tiles, options, basis, extensionFactor, shifts);
  console.log(`${Math.round(t())} msec to make the tiling geometry`);

  yield log('Done making the tiling model.');
  return model;
});


const builders = {
  tiling        : makeTilingModel,
  periodic_graph: makeNetModel,
  net           : makeNetModel,
  crystal       : makeNetModel
};


const makeScene = (structure, options, runJob, log) => csp.go(function*() {
  const type = structure.type;
  const builder = builders[type];

  if (builder == null)
    throw new Error(`rendering not implemented for type ${type}`);

  const model = yield builder(structure, options, runJob, log);

  yield log('');
  return model;
});


export default makeScene;
