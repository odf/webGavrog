import * as THREE from 'three';
import * as csp   from 'plexus-csp';

import * as util        from '../common/util';
import * as delaney     from '../dsymbols/delaney';
import * as tilings     from '../dsymbols/tilings';
import * as lattices    from '../geometry/lattices';
import * as periodic    from '../pgraphs/periodic';
import * as netSyms     from '../pgraphs/symmetries';

import embed from '../pgraphs/embedding';

import { floatMatrices } from '../arithmetic/types';
const ops = floatMatrices;


const geometry = (vertices, faces) => {
  const geom = new THREE.Geometry();

  vertices.forEach(v => {
    geom.vertices.push(new THREE.Vector3(v[0], v[1], v[2]));
  });

  faces.forEach(f => {
    f.forEach((v, i) => {
      if (i > 0 && i+1 < f.length)
        geom.faces.push(new THREE.Face3(f[0], f[i], f[i+1]));
    });
  });

  geom.computeFaceNormals();
  geom.computeVertexNormals();
  return geom;
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

  return geometry(
    [].concat(section.map(c => ops.plus(c, p)),
              section.map(c => ops.plus(c, q))),
    new Array(n).fill(0).map((_, i) => {
      const j = (i + 1) % n;
      return [i, j, j+n, i+n];
    })
  );
};


const ballAndStick = (
  positions,
  edges,
  ballRadius=0.1,
  stickRadius=0.04,
  ballColor=0xe8d880,
  stickColor=0x404080
) => {
  const model = new THREE.Object3D();
  const ball  = new THREE.SphereGeometry(ballRadius, 16, 8);

  positions.forEach(p => {
    const mat = new THREE.MeshPhongMaterial({
      color: ballColor,
      shininess: 50
    });

    const s = new THREE.Mesh(ball, mat);
    s.position.x = p[0];
    s.position.y = p[1];
    s.position.z = p[2] || 0;
    model.add(s);
  });

  edges.forEach(e => {
    const u = positions[e[0]];
    const v = positions[e[1]];
    const s = stick(u, v, stickRadius, 8);
    s.computeVertexNormals();

    const mat = new THREE.MeshPhongMaterial({
      color: stickColor,
      shininess: 50
    });

    model.add(new THREE.Mesh(s, mat));
  });

  return model;
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
  const cov = yield structure.cover || delaney.parse(yield runJob({
    cmd: 'dsCover',
    val: `${ds}`
  }));
  console.log(`${Math.round(t())} msec to compute the cover`);

  yield log('Extracting the skeleton...');
  const skel = yield runJob({
    cmd: 'skeleton',
    val: `${cov}`
  });
  //const graph = periodic.fromObject(skel.graph);
  console.log(`${Math.round(t())} msec to extract the skeleton`);

  yield log('Computing an embedding...');
  const embedding = yield runJob({
    cmd: 'embedding',
    val: { graphRepr: skel.graph, relax: !options.skipRelaxation }
  });
  const pos = embedding.positions;
  console.log(`${Math.round(t())} msec to compute the embedding`);

  yield log('Computing a translation basis...');
  const basis = yield invariantBasis(embedding.gram);
  console.log(`${Math.round(t())} msec to compute the translation basis`);

  yield log('Making the base tile surfaces...');
  const { templates, tiles } = yield runJob({
    cmd: 'tileSurfaces',
    val: { dsTxt: `${ds}`, covTxt: `${cov}`, skel, pos, basis }
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

  const bbox = new THREE.Box3();
  bbox.setFromObject(model);
  model.position.sub(bbox.getCenter());

  log('Composing the scene...');

  const distance = 12;
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 10000);
  camera.name = 'camera';
  camera.position.z = distance;

  camera.add(light(0xaaaaaa,  distance, 0.5*distance, distance));
  camera.add(light(0x555555, -0.5*distance, -0.25*distance, distance));
  camera.add(light(0x000033, 0.25*distance, 0.25*distance, -distance));

  const scene = new THREE.Scene();

  scene.add(model);
  scene.add(camera);

  log('Scene complete!');
  return scene;
});


export default makeScene;
