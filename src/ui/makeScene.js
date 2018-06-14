import * as THREE from 'three';
import * as csp   from 'plexus-csp';

import * as util        from '../common/util';
import * as delaney     from '../dsymbols/delaney';
import * as tilings     from '../dsymbols/tilings';
import * as lattices    from '../geometry/lattices';
import * as periodic    from '../pgraphs/periodic';
import * as netSyms     from '../pgraphs/symmetries';
import {subD}           from '../graphics/surface';

import embed from '../pgraphs/embedding';

import { floatMatrices } from '../arithmetic/types';
const ops = floatMatrices;


const unitVec = v => ops.div(v, ops.norm(v));
const white = { hue: 0, saturation: 0, lightness: 1 };


const geometry = (vertices, faces, isWireframe=false) => {
  const normals = vertices.map(v => ops.times(v, 0));

  for (const f of faces) {
    const n = f.length;
    for (let i = 0; i < n; ++i) {
      const u = f[i];
      const v = f[(i + 1) % n];
      const w = f[(i + 2) % n];

      const a = ops.minus(vertices[u], vertices[v]);
      const b = ops.minus(vertices[w], vertices[v]);

      normals[v] = ops.plus(normals[v], ops.crossProduct(b, a));
    }
  }

  return {
    vertices: vertices.map((v, i) => ({
      pos: v,
      normal: unitVec(normals[i])
    })),
    faces: faces.map(f => ({
      vertices: f,
      color: white
    })),
    isWireframe: isWireframe
  }
};


const stick = (p, q, radius, segments) => {
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
  const t = subD(subD(t0));

  return geometry(
    t.pos.map(v => ops.times(unitVec(v), radius)),
    t.faces
  );
};


const baseMaterial = {
  ambientColor: white,
  diffuseColor: white,
  specularColor: white,
  ka: 0.1,
  kd: 1.0,
  ks: 0.2,
  shininess: 15.0
};


const ballAndStick = (
  positions,
  edges,
  ballRadius=0.1,
  stickRadius=0.04,
  ballColor={ hue: 0.9, saturation: 0.7, lightness: 0.7 },
  stickColor={ hue: 4.2, saturation: 0.3, lightness: 0.4 }
) => {
  const ball = makeBall(ballRadius);

  const meshes = [ ball ];
  const instances = [];

  const ballMaterial = Object.assign({}, baseMaterial, {
    diffuseColor: ballColor,
    shininess: 50.0
  });

  const stickMaterial = Object.assign({}, baseMaterial, {
    diffuseColor: stickColor,
    shininess: 50.0
  });

  positions.forEach(p => {
    instances.push({
      meshIndex: 0,
      material: ballMaterial,
      transform: {
        basis: [ [ 1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, 1 ] ],
        shift: [ p[0], p[1], p[2] || 0 ]
      }
    })
  });

  edges.forEach(e => {
    const u = positions[e[0]];
    const v = positions[e[1]];

    meshes.push(stick(u, v, stickRadius, 8));

    instances.push({
      meshIndex: meshes.length - 1,
      material: stickMaterial,
      transform: {
        basis: [ [ 1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, 1 ] ],
        shift: [ 0, 0, 0 ]
      }
    })
  });

  return { meshes, instances };
};


const _graphWithNormalizedShifts = graph => {
  const v0 = graph.edges[0].head;
  const adj = periodic.adjacencies(graph);
  const shifts = { [v0]: ops.vector(graph.dim) };
  const queue = [v0];

  while (queue.length) {
    const v = queue.shift();

    for (const { v: w, s } of adj[v]) {
      if (shifts[w] == null) {
        shifts[w] = ops.plus(s, shifts[v]);
        queue.push(w)
      }
    }
  }

  return periodic.make(graph.edges.map(e => {
    const h = e.head;
    const t = e.tail;
    const s = e.shift;

    return [h, t, ops.minus(shifts[t], ops.plus(shifts[h], s))];
  }));
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


const invariantBasis = gram => {
  const dot = (v, w) => ops.times(ops.times(v, gram), w);

  const vs = ops.identityMatrix(gram.length);
  const ortho = [];

  for (let v of vs) {
    for (const w of ortho)
      v = ops.minus(v, ops.times(w, dot(v, w)));
    ortho.push(ops.div(v, ops.sqrt(dot(v, v))))
  }

  return ops.times(gram, ops.transposed(ortho));
};


const makeNetModel = (structure, options, runJob, log) => csp.go(function*() {
  const graph = _graphWithNormalizedShifts(structure.graph);

  const embedding = embed(graph, !options.skipRelaxation);
  const basis = invariantBasis(embedding.gram);
  const pos = embedding.positions;

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

  return ballAndStick(points, edges);
});


const colorHSL = (hue, saturation, lightness) => {
  const c = new THREE.Color();
  c.setHSL(hue, saturation, lightness);
  return c;
};


const wireframe = (geometry, color) => {
  const wireframe = new THREE.WireframeGeometry(geometry);

  const line = new THREE.LineSegments(wireframe);
  line.material.color = color;

  return line;
};


const tilingModel = (
  surfaces, instances, options, basis, extensionFactor, shifts=[[0, 0, 0]]
) => {
  const model = new THREE.Object3D();
  const hue0 = Math.random();

  const geometries = surfaces.map(({ pos, faces }) => geometry(pos, faces));
  const extend = v => ops.times(v, extensionFactor);
  const dVecs = lattices.dirichletVectors(basis).map(extend);

  for (const i in instances) {
    const { templateIndex: kind, symmetry, center } = instances[i];
    const geom = geometries[kind];

    const matrix = new THREE.Matrix4();

    let A = symmetry;
    if (A.length == 3)
      A = [
        A[0].concat(0),
        A[1].concat(0),
        [0, 0, 1, 0],
        A[2].slice(0, 2).concat(0, 1)
      ];

    matrix.elements = [].concat.apply([], A);

    for (const s0 of shifts) {
      const a = options.colorByTranslationClass ?
        i / instances.length :
        kind / surfaces.length;

      const mat = new THREE.MeshPhongMaterial({
        color: colorHSL((hue0 + a) % 1, 1.0, 0.7),
        shininess: 15
      });

      const c = ops.plus(center, s0);
      const s = ops.plus(s0, lattices.shiftIntoDirichletDomain(c, dVecs));

      const tileMesh = new THREE.Mesh(geom, mat);
      tileMesh.applyMatrix(matrix);
      tileMesh.position.x += s[0];
      tileMesh.position.y += s[1];
      tileMesh.position.z += (s[2] || 0);
      model.add(tileMesh);

      if (options.showSurfaceMesh) {
        const tileWire = wireframe(geom, colorHSL(0.0, 0.0, 0.0));
        tileWire.applyMatrix(matrix);
        tileWire.position.x += s[0];
        tileWire.position.y += s[1];
        tileWire.position.z += (s[2] || 0);
        model.add(tileWire);
      }
    }
  }

  return model;
};


const light = (color, x, y, z) => {
  const light = new THREE.PointLight(color);

  light.position.set(x, y, z);

  return light;
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
  const basis = yield invariantBasis(embedding.gram);
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

  //for (const mesh of model.meshes)
  //  console.log(JSON.stringify(mesh));

  //for (const instance of model.instances)
  //  console.log(JSON.stringify(instance));

  //const bbox = new THREE.Box3();
  //bbox.setFromObject(model);
  //model.position.sub(bbox.getCenter(new THREE.Vector3()));

  log('Scene complete!');
  return model;
});


export default makeScene;
