import * as I     from 'immutable';
import * as THREE from 'three';
import * as csp   from 'plexus-csp';

import * as util        from '../common/util';
import * as webworkers  from '../common/webworkers';
import * as delaney     from '../dsymbols/delaney';
import * as props       from '../dsymbols/properties';
import * as tilings     from '../dsymbols/tilings';
import * as spacegroups from '../geometry/spacegroups';
import * as periodic    from '../pgraphs/periodic';
import * as netSyms     from '../pgraphs/symmetries';

import embed from '../pgraphs/embedding';

import { matrices } from '../arithmetic/types';
const ops = matrices;

const worker = webworkers.create('js/sceneWorker.js');
const callWorker = csp.nbind(worker, null);


const _normalized = v => ops.div(v, ops.norm(v));
const _range = n => new Array(n).fill(0).map((_, i) => i);


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
  if (p.length == 2) {
    p = p.concat(0);
    q = q.concat(0);
  }

  const n = segments;
  const d = _normalized(ops.minus(q, p));
  const ex = [1,0,0];
  const ey = [0,1,0];
  const t = Math.abs(ops.times(d, ex)) > 0.9 ? ey : ex;
  const u = _normalized(ops.crossProduct(d, t));
  const v = _normalized(ops.crossProduct(d, u));
  const a = Math.PI * 2 / n;

  const section = I.Range(0, n).map(i => {
    const x = a * i;
    const c = Math.cos(x) * radius;
    const s = Math.sin(x) * radius;
    return ops.plus(ops.times(c, u), ops.times(s, v));
  });

  return geometry(
    I.List().concat(section.map(c => ops.plus(c, p)),
                    section.map(c => ops.plus(c, q))),
    I.Range(0, n).map(i => {
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
  const v0 = graph.edges.first().head;
  const adj = periodic.adjacencies(graph);
  const shifts = { [v0]: ops.vector(graph.dim) };
  const queue = [v0];

  while (queue.length) {
    const v = queue.shift();

    for (const { v: w, s } of adj.get(v)) {
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


const simpleEmbedding = graph => {
  const I = ops.identityMatrix(graph.dim);
  const syms = netSyms.symmetries(graph).symmetries.map(s => s.transform);
  const gram = spacegroups.resymmetrizedGramMatrix(I, syms);
  const positions = periodic.barycentricPlacement(graph);

  return { gram, positions };
};


const flatMap   = (fn, xs) => [].concat.apply([], xs.map(fn));

const cartesian = (...vs) => (
  vs.length == 0 ?
    [[]] :
    flatMap(xs => vs[vs.length - 1].map(y => xs.concat(y)),
            cartesian(...vs.slice(0, -1)))
);


const makeNetModel = (structure, options, log) => csp.go(function*() {
  const graph = _graphWithNormalizedShifts(structure.graph);

  const embedding = embed(graph, !options.skipRelaxation);
  const basis = spacegroups.invariantBasis(embedding.gram);
  const pos = I.Map(embedding.positions).toJS();

  const nodeIndex = {};
  const points = [];
  const edges = [];

  const shifts = graph.dim == 3 ?
    cartesian([0, 1], [0, 1], [0, 1]) :
    cartesian(_range(6), _range(6));

  for (const s of shifts) {
    for (const e of graph.edges) {
      edges.push([[e.head, s], [e.tail, ops.plus(s, e.shift)]].map(
        ([node, shift]) => {
          const key = JSON.stringify([node, shift]);
          const idx = nodeIndex[key] || points.length;
          if (idx == points.length) {
            const p = ops.times(ops.plus(pos[node], shift), basis);
            points.push(ops.toJS(p));
            nodeIndex[key] = idx;
          }
          return idx;
        }));
    }
  }

  return ballAndStick(points, edges);
});


const determinant = M => {
  if (M.length == 2)
    return M[0][0] * M[1][1] - M[0][1] * M[1][0];
  else if (M.length == 3)
    return (+ M[0][0] * M[1][1] * M[2][2]
            + M[0][1] * M[1][2] * M[2][0]
            + M[0][2] * M[1][0] * M[2][1]
            - M[0][2] * M[1][1] * M[2][0]
            - M[0][1] * M[1][0] * M[2][2]
            - M[0][0] * M[1][2] * M[2][1]);
  else
    return ops.cleanup(ops.determinant(M));
};


const tilingSgn = (cov, pos, ori, basis) => {
  const elms = I.List(cov.elements());

  for (let i = 0; i < elms.size; ++i) {
    const D = elms.get(i);

    const sgn = ori.get(D) *
      ops.sgn(determinant(ops.times(tilings.chamberBasis(pos, D), basis)));

    if (sgn)
      return sgn;
  }

  return 1;
};


const interpolate = (f, v, w) => ops.plus(w, ops.times(f, ops.minus(v, w)));


const tileSurface3D = (D0, cov, til, basis, ori, options) => {
  const pos = til.positions;
  const elms = props.orbit(cov, [0, 1, 2], D0);
  const sgn = tilingSgn(cov, pos, ori, basis);

  const cornerOrbits =
    props.orbitReps(cov, [1, 2], elms).map(D => props.orbit(cov, [1, 2], D));

  const cornerPositions = I.List(cornerOrbits.map(orb => {
    const ps = pos.get(orb.first());
    return ops.times(interpolate(0.8, ps.get(0), ps.get(3)), basis);
  }));

  const cornerIndex = I.Map(cornerOrbits.flatMap(
    (orb, i) => orb.map(D => [D, i])));

  const faces = I.List(props.orbitReps(cov, [0, 1], elms)
    .map(D => sgn * ori.get(D) < 0 ? D : cov.s(0, D))
    .map(D => (
      props.orbit(cov, [0, 1], D)
        .filter((D, i) => i % 2 == 0)
        .map(D => cornerIndex.get(D)))));

  return {
    pos    : cornerPositions.map(p => ops.toJS(p)).toJS(),
    faces  : faces.toJS(),
    isFixed: I.Range(0, cornerPositions.size).map(i => true).toJS(),
    subDLevel: options.extraSmooth ? 3 : 2
  };
};


const tileSurface2D = (D0, cov, til, basis, ori, options) => {
  const pos = til.positions;
  const elms = props.orbit(cov, [0, 1], D0);
  const sgn = tilingSgn(cov, pos, ori, basis);

  const cornerOrbits =
    props.orbitReps(cov, [1], elms).map(D => props.orbit(cov, [1], D));

  const cornerPositions = I.List(cornerOrbits)
    .map(orb => ops.times(pos.get(orb.first()).get(0), basis).concat(0))
    .flatMap(p => [p, p.slice(0, -1).concat(0.1)]);

  const cornerIndex = I.Map(cornerOrbits.flatMap(
    (orb, i) => orb.map(D => [D, i])));

  const f = props.orbit(cov, [0, 1], sgn * ori.get(D0) < 0 ? D0 : cov.s(0, D0))
    .filter((D, i) => i % 2 == 0)
    .map(D => 2 * cornerIndex.get(D));

  const faces = I.List([f, f.map(x => x + 1).reverse()])
    .concat(f.map((x, i) => {
      const y = f.get((i + 1) % f.size);
      return [y, x, x + 1, y + 1];
    }));

  return {
    pos    : cornerPositions.map(p => ops.toJS(p)).toJS(),
    faces  : faces.toJS(),
    isFixed: I.Range(0, cornerPositions.size).map(i => true).toJS(),
    subDLevel: options.extraSmooth ? 3 : 2
  };
};


const tileSurfaces = (cov, til, basis, options) => {
  const ori = props.partialOrientation(cov);

  if (delaney.dim(cov) == 3) {
    return props.orbitReps(cov, [0, 1, 2])
      .map(D => tileSurface3D(D, cov, til, basis, ori, options))
      .toJS();
  }
  else {
    return props.orbitReps(cov, [0, 1])
      .map(D => tileSurface2D(D, cov, til, basis, ori, options))
      .toJS();
  }
};


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


const tilingModel = (surfaces, options, shifts=[[0, 0, 0]]) => {
  const model = new THREE.Object3D();
  const hue0 = Math.random();
  const n = surfaces.length;

  for (const i in surfaces) {
    const { pos, faces } = surfaces[i];

    const geom = geometry(pos, faces);

    for (const s of shifts) {
      const mat = new THREE.MeshPhongMaterial({
        color: colorHSL((hue0 + i / n) % 1, 1.0, 0.7),
        shininess: 15
      });

      const tileMesh = new THREE.Mesh(geom, mat);
      tileMesh.position.x = s[0];
      tileMesh.position.y = s[1];
      tileMesh.position.z = s[2] || 0;
      model.add(tileMesh);

      if (options.showSurfaceMesh) {
        const tileWire = wireframe(geom, colorHSL(0.0, 0.0, 0.0));
        tileWire.position.x = s[0];
        tileWire.position.y = s[1];
        tileWire.position.z = s[2] || 0;
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


const baseShifts = dim => dim == 3 ?
  cartesian([0, 1], [0, 1], [0, 1]) :
  cartesian(_range(6), _range(6));


const makeTilingModel = (structure, options, log) => csp.go(function*() {
  const ds = structure.symbol;
  const dim = delaney.dim(ds);

  const t = util.timer();

  yield log('Finding the pseudo-toroidal cover...');
  const cov = yield structure.cover || delaney.parse(yield callWorker({
    cmd: 'dsCover',
    val: `${ds}`
  }));
  console.log(`${Math.round(t())} msec to compute the cover`);

  yield log('Extracting the skeleton...');
  const skel = yield callWorker({
    cmd: 'skeleton',
    val: `${cov}`
  });
  skel.graph = periodic.fromObject(skel.graph);
  console.log(`${Math.round(t())} msec to extract the skeleton`);

  yield log('Computing an embedding...');
  const embedding = yield callWorker({
    cmd: 'embedding',
    val: {
      graphRepr: periodic.asObject(skel.graph),
      relax: !options.skipRelaxation
    }
  });
  console.log(`${Math.round(t())} msec to compute the embedding`);

  yield log('Computing a translation basis...');
  const basis = yield spacegroups.invariantBasis(embedding.gram);
  console.log(`${Math.round(t())} msec to compute the translation basis`);

  yield log('Building the tiling object...');
  const til = yield tilings.tiling(ds, cov, skel, embedding);
  console.log(`${Math.round(t())} msec to build the tiling object`);

  yield log('Making the base tile surfaces...');
  const baseSurfaces = yield tileSurfaces(cov, til, basis, options);
  console.log(`${Math.round(t())} msec to make the base surfaces`);

  yield log('Refining the tile surfaces...');
  const refinedSurfaces = yield callWorker({
    cmd: 'processSolids',
    val: baseSurfaces
  });
  console.log(`${Math.round(t())} msec to refine the surfaces`);

  yield log('Making the tiling geometry...');
  const shifts = baseShifts(dim).map(s => ops.times(s, basis));
  const model = tilingModel(refinedSurfaces, options, shifts);
  console.log(`${Math.round(t())} msec to make the tiling geometry`);

  return model;
});


const builders = {
  tiling        : makeTilingModel,
  periodic_graph: makeNetModel,
  net           : makeNetModel,
  crystal       : makeNetModel
};


const makeScene = (structure, options, log) => csp.go(function*() {
  const type = structure.type;
  const builder = builders[type];

  if (builder == null)
    throw new Error(`rendering not implemented for type ${type}`);

  const model = yield builder(structure, options, log);

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
