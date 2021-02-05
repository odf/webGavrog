import { coordinateChangesF as opsF } from '../geometry/types';
import { subD } from './surface';


const range = n => [...Array(n).keys()];
const normalized = v => opsF.div(v, opsF.norm(v));


export const geometry = (vertsIn, faces) => {
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


export const splitMeshes = (meshes, faceLabelLists) => {
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


export const makeBall = radius => {
  const t0 = {
    pos: [[1,0,0], [0,1,0], [0,0,1], [-1,0,0], [0,-1,0], [0,0,-1]],
    faces : [[0,1,2], [1,0,5], [2,1,3], [0,2,4],
             [3,5,4], [5,3,1], [4,5,0], [3,4,2]],
    isFixed: [false, false, false, false, false, false]
  };
  const t = subD(subD(subD(t0)));

  return geometry(t.pos.map(v => opsF.times(normalized(v), radius)), t.faces);
};


export const makeStick = (radius, segments) => {
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

  faces.push(range(n).reverse());
  faces.push(range(n).map(i => i + n));

  return geometry(vertices, faces);
};


export const stickTransform = (p, q, ballRadius, stickRadius) => {
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
