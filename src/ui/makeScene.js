import * as I     from 'immutable';
import * as THREE from 'three';

import * as R from '../arithmetic/float';
import _M     from '../arithmetic/matrix';
import _V     from '../arithmetic/vector';

const M = _M(R, 0, 1);
const V = _V(R, 0);

import * as delaney  from '../dsymbols/delaney';
import * as props    from '../dsymbols/properties';
import * as periodic from '../pgraphs/periodic';
import * as surface  from '../geometry/surface';

import tiling from '../dsymbols/tilings';

import * as webworkers from '../common/webworkers';


const CoverVertex = I.Record({
  v: undefined,
  s: undefined
});

const graphPortion = function graphPortion(graph, start, dist) {
  const adj  = periodic.adjacencies(graph);

  const v0 = new CoverVertex({ v: start, s: V.constant(graph.dim) });
  let vertices = I.Map([[v0, 0]]);
  let edges = I.Set();
  let thisShell = I.List([v0]);

  I.Range(1, dist+1).forEach(function(i) {
    let nextShell = I.Set();
    thisShell.forEach(function(v) {
      const i = vertices.get(v);

      adj.get(v.v).forEach(function(t) {
        const w = new CoverVertex({ v: t.v, s: V.plus(v.s, V.make(t.s)) });

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

  let verts = I.List();
  vertices.keySeq().forEach(v => { verts = verts.set(vertices.get(v), v); });

  return {
    vertices: verts,
    edges   : edges.map(e => e.toArray())
  };
};


const geometry = function geometry(vertices, faces) {
  const geom = new THREE.Geometry();

  vertices.forEach(v => {
    geom.vertices.push(new THREE.Vector3(v[0], v[1], v[2]));
  });

  faces.forEach(function(f) {
    f.forEach(function(v, i) {
      if (i > 0 && i+1 < f.length)
        geom.faces.push(new THREE.Face3(f[0], f[i], f[i+1]));
    });
  });

  geom.computeFaceNormals();
  geom.computeVertexNormals();
  return geom;
};


const stick = function stick(p, q, radius, segments) {
  const n = segments;
  const d = V.normalized(V.minus(q, p));
  const ex = V.make([1,0,0]);
  const ey = V.make([0,1,0]);
  const t = V.dotProduct(d, ex) > 0.9 ? ey : ex;
  const u = V.normalized(V.crossProduct(d, t));
  const v = V.normalized(V.crossProduct(d, u));
  const a = Math.PI * 2 / n;

  const section = I.Range(0, n).map(function(i) {
    const x = a * i;
    const c = Math.cos(x) * radius;
    const s = Math.sin(x) * radius;
    return V.plus(V.scaled(c, u), V.scaled(s, v));
  });

  return geometry(
    I.List().concat(section.map(c => V.plus(c, p)),
                    section.map(c => V.plus(c, q)))
      .map(v => v.data.toJS()),
    I.Range(0, n).map(function(i) {
      const j = (i + 1) % n;
      return [i, j, j+n, i+n];
    })
  );
};


const shrunk = function shrunk(f, vertices) {
  const n = vertices.size;
  const last = vertices.get(n-1);
  return I.List(
    vertices.take(n-1).map(v => V.plus(V.scaled(f, v), V.scaled(1-f, last)))
  ).push(last);
};


const ballAndStick = function ballAndStick(
  name, positions, edges, ballRadius, stickRadius, ballMaterial, stickMaterial)
{
  const model = new THREE.Object3D();
  const ball  = new THREE.SphereGeometry(ballRadius, 16, 8);

  positions.forEach(function(p) {
    const s = new THREE.Mesh(ball, ballMaterial);
    s.position.x = p[0];
    s.position.y = p[1];
    s.position.z = p[2];
    model.add(s);
  });

  edges.forEach(function(e) {
    const u = V.make(positions[e[0]]);
    const v = V.make(positions[e[1]]);
    const s = stick(u, v, stickRadius, 8);
    s.computeVertexNormals();
    model.add(new THREE.Mesh(s, stickMaterial));
  });

  return model;
};


const light = function(color, x, y, z) {
  const light = new THREE.PointLight(color);

  light.position.set(x, y, z);

  return light;
};


const apply = function(v, A) {
  return V.make(M.times(M.make([v.data]), A).data.first());
};


const combine = (f1, v1, f2, v2) => V.plus(V.scaled(f1, v1), V.scaled(f2, v2));


const mapElementsToOrbitIndices = (ds, indices) => I.Map(
  props.orbitReps(ds, indices)
    .flatMap((D, k) => props.orbit(ds, indices, D).zip(I.Repeat(k))));


const chamberBasis = function chamberBasis(pos, D) {
  const t = pos.get(D).valueSeq();
  return M.make(t.rest().map(v => V.minus(v, t.get(0)).data));
};


const tiles = t => {
  const cov = t.cover;
  const D0  = cov.elements().first();
  const ori = props.partialOrientation(cov);
  const pos = t.positions;
  const sgn = ori.get(D0) *
    R.sgn(M.determinant(M.times(chamberBasis(pos, D0), t.basis)));

  const cornerOrbits =
    props.orbitReps(cov, [1, 2]).map(D => props.orbit(cov, [1, 2], D));
  const cornerPositions = I.List(cornerOrbits.map(orb => {
    const ps = pos.get(orb.first());
    return apply(combine(0.8, ps.get(0), 0.2, ps.get(3)), t.basis);
  }));
  const positionIndexForElement =
    I.Map(cornerOrbits.flatMap((orb, i) => orb.map(D => [D, i])));

  const faces = I.List(props.orbitReps(cov, [0, 1])
    .map(D => sgn * ori.get(D) < 0 ? D : cov.s(0, D))
    .map(D => (
      props.orbit(cov, [0, 1], D)
        .filter((D, i) => i % 2 == 0)
        .map(D => positionIndexForElement.get(D)))));

  return {
    pos    : cornerPositions,
    faces  : faces,
    isFixed: I.Range(0, cornerPositions.size).map(i => true)
  };
};


const processedSolid = t0 => {
  const t1 = surface.withFlattenedCenterFaces(t0);
  const t2 = I.Range(0, 2).reduce(s => surface.subD(s), t1);
  const t3 = surface.insetAt(t2, 0.03, t2.isFixed);
  const t4 = surface.beveledAt(t3, 0.015, t2.isFixed);

  const isCorner = I.Range(0, t4.pos.size).map(i => i >= t3.pos.size);
  const t5 = surface.beveledAt(t4, 0.005, isCorner);

  return t4;
};


export default function(ds) {
  const worker = webworkers.create('js/testWorker.js');
  worker({ a: 1, b: 2 }, (err, val) => console.log(`err=${err}, val=${val}`));

  const scene  = new THREE.Scene();

  const ballMaterial = new THREE.MeshPhongMaterial({
    color: 0xff4040
  });

  const stickMaterial = new THREE.MeshPhongMaterial({
    color: 0x4040ff,
  });

  const tileMaterial = new THREE.MeshPhongMaterial({
    color: 0x00ffff,
    shininess: 5
  });

  const t   = tiling(ds);
  const net = t.graph;
  const g   = graphPortion(net, 0, 2);
  const pos = t.positions;
  let verts = g.vertices.map(function(v) {
    const p = V.plus(pos.getIn([t.node2chamber.get(v.v), 0]), v.s);
    return apply(p, t.basis).data.toJS();
  }).toArray();
  if (delaney.dim(ds) == 2)
    verts = verts.map(p => [p[0], p[1], 0]);

  const model = ballAndStick(
    'cube',
    verts,
    g.edges,
    0.06,
    0.03,
    ballMaterial,
    stickMaterial
  );

  const surf = processedSolid(tiles(t));
  const geom = geometry(surf.pos.map(v => v.data.toJS()), surf.faces.toJS());
  const tilesMesh = new THREE.Mesh(geom, tileMaterial);

  const distance = 6;
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 10000);
  camera.name = 'camera';
  camera.position.z = distance;

  camera.add(light(0xaaaaaa,  distance, 0.5*distance, distance));
  camera.add(light(0x555555, -0.5*distance, -0.25*distance, distance));
  camera.add(light(0x000033, 0.25*distance, 0.25*distance, -distance));

  scene.add(model);
  scene.add(tilesMesh);
  //scene.add(new THREE.WireframeHelper(tilesMesh, 0x00ff00));
  scene.add(camera);

  return scene;
};
