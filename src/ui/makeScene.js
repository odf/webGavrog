import * as I     from 'immutable';
import * as THREE from 'three';
import * as csp   from 'plexus-csp';

import { matrices } from '../arithmetic/types';
const ops = matrices;

import * as delaney  from '../dsymbols/delaney';
import * as props    from '../dsymbols/properties';
import * as periodic from '../pgraphs/periodic';

import tiling from '../dsymbols/tilings';

import * as webworkers from '../common/webworkers';

const worker = webworkers.create('js/sceneWorker.js');
const callWorker = csp.nbind(worker, null);


const _normalized = v => ops.div(v, ops.norm(v));


const encode = value => JSON.stringify(ops.repr(value));
const decode = value => ops.fromRepr(JSON.parse(value));


const CoverVertex = I.Record({
  v: undefined,
  s: undefined
});


const graphPortion = (graph, start, dist) => {
  const adj  = periodic.adjacencies(graph);

  const v0 = new CoverVertex({ v: start, s: encode(ops.vector(graph.dim)) });
  let vertices = I.Map([[v0, 0]]);
  let edges = I.Set();
  let thisShell = I.List([v0]);

  I.Range(1, dist+1).forEach(i => {
    let nextShell = I.Set();
    thisShell.forEach(v => {
      const i = vertices.get(v);

      adj.get(v.v).forEach(t => {
        const w = new CoverVertex({
          v: t.v,
          s: encode(ops.plus(decode(v.s), t.s))
        });

        if (vertices.get(w) == null) {
          vertices = vertices.set(w, vertices.size);
          nextShell = nextShell.add(w);
        }

        const j = vertices.get(w);

        if (!edges.contains(I.List([i, j])) && !edges.contains(I.List([j, i])))
          edges = edges.add(I.List([i, j]));
      });
    });

    thisShell = nextShell;
  });

  let verts = I.List().asMutable();
  vertices.keySeq().forEach(v => {
    verts.set(vertices.get(v), { v: v.v, s: decode(v.s) });
  });

  return {
    vertices: verts.asImmutable(),
    edges   : edges.sort().map(e => e.toArray())
  };
};


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
  name, positions, edges, ballRadius, stickRadius, ballMaterial, stickMaterial
) => {
  const model = new THREE.Object3D();
  const ball  = new THREE.SphereGeometry(ballRadius, 16, 8);

  positions.forEach(p => {
    const s = new THREE.Mesh(ball, ballMaterial);
    s.position.x = p[0];
    s.position.y = p[1];
    s.position.z = p[2];
    model.add(s);
  });

  edges.forEach(e => {
    const u = positions[e[0]];
    const v = positions[e[1]];
    const s = stick(u, v, stickRadius, 8);
    s.computeVertexNormals();
    model.add(new THREE.Mesh(s, stickMaterial));
  });

  return model;
};


const interpolate = (f, v, w) => ops.plus(w, ops.times(f, ops.minus(v, w)));


const chamberBasis = (pos, D) => {
  const t = pos.get(D).valueSeq();
  return t.rest().map(v => ops.minus(v, t.get(0)));
};


const tileSurface = (til, D0, options) => {
  const cov = til.cover;
  const ori = props.partialOrientation(cov);
  const pos = til.positions;
  const elms = props.orbit(cov, [0, 1, 2], D0);

  const sgn = ori.get(D0) *
    ops.sgn(ops.determinant(ops.cleanup(
      ops.times(chamberBasis(pos, D0).toJS(), til.basis))));

  const cornerOrbits =
    props.orbitReps(cov, [1, 2], elms).map(D => props.orbit(cov, [1, 2], D));

  const cornerPositions = I.List(cornerOrbits.map(orb => {
    const ps = pos.get(orb.first());
    return ops.times(interpolate(0.8, ps.get(0), ps.get(3)), til.basis);
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


const tileSurfaces = (til, options) => {
  return props.orbitReps(til.cover, [0, 1, 2])
    .map(D => tileSurface(til, D, options))
    .toJS();
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


const tilingModel = (surfaces, options) => {
  const model = new THREE.Object3D();
  const hue0 = Math.random();
  const n = surfaces.length;

  for (const i in surfaces) {
    const { pos, faces } = surfaces[i];

    const geom = geometry(pos, faces);
    const mat = new THREE.MeshPhongMaterial({
      color: colorHSL((hue0 + i / n) % 1, 1.0, 0.7),
      shininess: 15
    });

    const tileMesh = new THREE.Mesh(geom, mat);
    model.add(tileMesh);

    if (options.showSurfaceMesh)
      model.add(wireframe(geom, colorHSL(0.0, 0.0, 0.0)));
  }

  return model;
};


const netModel = (t, ballMaterial, stickMaterial) => {
  const net = t.graph;
  const g   = graphPortion(net, 0, 2);
  const pos = t.positions;
  let verts = g.vertices.map(v => {
    const p = ops.plus(pos.getIn([t.node2chamber.get(v.v), 0]), v.s);
    return ops.times(p, t.basis);
  }).toArray();
  if (delaney.dim(t.cover) == 2)
    verts = verts.map(p => [p[0], p[1], 0]);

  return ballAndStick(
    'cube',
    verts,
    g.edges,
    0.04,
    0.01,
    ballMaterial,
    stickMaterial
  );
};


const light = (color, x, y, z) => {
  const light = new THREE.PointLight(color);

  light.position.set(x, y, z);

  return light;
};


const ballMaterial = new THREE.MeshPhongMaterial({
  color: 0xe8d880,
  shininess: 50
});

const stickMaterial = new THREE.MeshPhongMaterial({
  color: 0x404080,
  shininess: 50
});


export default function makeScene(ds, options, log=console.log) {
  return csp.go(function*() {
    log('Finding the pseudo-toroidal cover...');
    const cov = delaney.parse(yield callWorker({
      cmd: 'dsCover',
      val: `${ds}`
    }));

    log('Building the tiling object...');
    const til = tiling(ds, cov);

    const model = new THREE.Object3D();

    if (options.showNet) {
      log('Generating the net geometry...');
      model.add(netModel(til, ballMaterial, stickMaterial));
    }

    log('Making the tiling geometry...');
    model.add(tilingModel(
      yield callWorker({
        cmd: 'processSolids',
        val: tileSurfaces(til, options)
      }),
      options
    ));

    const bbox = new THREE.Box3();
    bbox.setFromObject(model);
    model.position.sub(bbox.getCenter());

    log('Composing the scene...');

    const distance = 6;
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
};
