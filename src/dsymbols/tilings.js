import * as I from 'immutable';

import * as cosets      from '../fpgroups/cosets';
import * as delaney     from './delaney';
import * as properties  from './properties';
import * as delaney2d   from './delaney2d';
import * as delaney3d   from './delaney3d';
import * as fundamental from './fundamental';
import * as covers      from './covers';
import * as periodic    from '../pgraphs/periodic';

import { matrices } from '../arithmetic/types';
const ops = matrices;


const _remainingIndices = (ds, i) => ds.indices().filter(j => j != i);


const _edgeTranslations = function _edgeTranslations(cov) {
  const fg  = fundamental.fundamentalGroup(cov);
  const n   = fg.nrGenerators;
  const nul = ops.nullSpace(cosets.relatorMatrix(n, fg.relators).toJS());

  return fg.edge2word.map(function(a) {
    return a.map(function(b) {
      const v = cosets.relatorAsVector(b, n).toJS();
      return ops.times(v, nul);
    });
  });
};


const _cornerShifts = function _cornerShifts(cov, e2t) {
  const dim = delaney.dim(cov);
  const zero = ops.vector(dim);

  return I.Map().withMutations(function(m) {
    cov.indices().forEach(function(i) {
      const idcs = _remainingIndices(cov, i);

      properties.traversal(cov, idcs, cov.elements()).forEach(function(e) {
        const Dk = e[0];
        const k  = e[1];
        const D  = e[2];

        if (k == properties.traversal.root)
          m.setIn([D, i], zero);
        else
          m.setIn([D, i],
                  ops.minus(m.getIn([Dk, i]), e2t.getIn([Dk, k]) || zero));
      });
    });
  });
};


export const skeleton = cov => {
  const dim = delaney.dim(cov);
  const zero = ops.vector(dim);
  const chambers = cov.elements();
  const idcs0 = _remainingIndices(cov, 0);
  const nodeReps = properties.orbitReps(cov, idcs0, chambers);
  const node2chamber = I.Map(I.Range().zip(nodeReps));
  const chamber2node = I.Map(
    nodeReps
      .zip(I.Range())
      .flatMap(p => properties.orbit(cov, idcs0, p[0]).zip(I.Repeat(p[1]))));

  const e2t = _edgeTranslations(cov);
  const c2s = _cornerShifts(cov, e2t);

  const edges = properties.orbitReps(cov, _remainingIndices(cov, 1), chambers)
    .map(function(D) {
      const E = cov.s(0, D);
      const v = chamber2node.get(D);
      const w = chamber2node.get(E);
      const t = e2t.getIn([D, 0]) || zero;
      const sD = c2s.getIn([D, 0]);
      const sE = c2s.getIn([E, 0]);
      const s = ops.minus(ops.plus(t, sE), sD);

      return [v, w, s];
    });

  return {
    graph: periodic.make(edges),
    node2chamber: node2chamber.toJS(),
    chamber2node: chamber2node.toJS(),
    edgeTranslations: e2t.toJS(),
    cornerShifts: c2s.toJS()
  };
};


const chamberPositions = (cov, skel, pos) => {
  const dim = delaney.dim(cov);
  let result = {};

  cov.elements().forEach(function(D) {
    const p = pos[skel.chamber2node[D]];
    const t = skel.cornerShifts[D][0];
    result[D] = [ops.plus(p, t)];
  });

  I.Range(1, dim+1).forEach(function(i) {
    const idcs = I.Range(0, i);
    properties.orbitReps(cov, idcs, cov.elements()).forEach(function(D) {
      const orb = properties.orbit(cov, idcs, D);
      let s = ops.vector(dim);
      orb.forEach(function(E) {
        const p = result[E][0];
        const t = skel.cornerShifts[E][i];
        s = ops.plus(s, ops.minus(p, t));
      });
      s = ops.times(ops.div(1, orb.size), s);
      orb.forEach(function(E) {
        const t = skel.cornerShifts[E][i];
        result[E].push(ops.plus(s, t));
      });
   });
  });

  return result;
};


const chamberBasis = (pos, D) => {
  const t = pos[D];
  return ops.cleanup(t.slice(1).map(v => ops.minus(v, t[0])));
};


export const symmetries = (ds, cov, pos) => {
  const D0 = cov.elements()
    .find(D => ops.ne(ops.determinant(chamberBasis(pos, D)), 0));
  const A = ops.inverse(chamberBasis(pos, D0));

  const phi = properties.morphism(cov, 1, ds, 1);
  const E0 = phi.get(D0);

  return I.List(cov.elements()).toJS()
    .filter(D => phi.get(D) == E0)
    .map(D => ops.times(A, chamberBasis(pos, D)));
};


export const makeCover = ds =>
  delaney.dim(ds) == 3 ?
  delaney3d.pseudoToroidalCover(ds) :
  delaney2d.toroidalCover(ds);


const interpolate = (f, v, w) => ops.plus(w, ops.times(f, ops.minus(v, w)));


const tileSurface3D = (elms, corners, cornerIndex, cov, ori) => {
  const pos = corners.map(p => interpolate(0.8, p[0], p[3]));

  const faces = properties.orbitReps(cov, [0, 1], elms)
    .map(D => properties.orbit(cov, [0, 1], ori[D] < 0 ? D : cov.s(0, D)))
    .map(orb => orb.filter((D, i) => i % 2 == 0).map(D => cornerIndex[D]));

  return { pos, faces: faces.toJS() };
};


const tileSurface2D = (elms, corners, cornerIndex, cov, ori) => {
  const pos = I.List(corners).flatMap(p => [p[0].concat(0), p[0].concat(0.1)]);

  let f = elms.toJS()
    .filter((D, i) => i % 2 == 0)
    .map(D => 2 * cornerIndex[D]);

  if (ori[elms.first()] > 0)
    f = f.reverse();

  const faces = [f, f.map(x => x + 1).reverse()]
    .concat(f.map((x, i) => {
      const y = f[(i + 1) % f.length];
      return [y, x, x + 1, y + 1];
    }));

  return { pos: pos.toJS(), faces };
};


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
    return ops.determinant(ops.cleanup(M));
};


const adjustedOrientation = (cov, pos) => {
  const bas = D => chamberBasis(pos, D);
  const D0 = cov.elements().find(D => ops.ne(determinant(bas(D)), 0));
  const sgn = ops.sgn(determinant(bas(D0)));

  const ori = properties.partialOrientation(cov).toJS();
  if (sgn * ori[D0] < 0) {
    for (const D of cov.elements())
      ori[D] = -ori[D];
  }

  return ori;
};


export const tileSurfaces = (cov, skel, vertexPos, basis) => {
  const dim = delaney.dim(cov);
  const makeSurface = dim == 3 ? tileSurface3D : tileSurface2D;

  const chamberPos = chamberPositions(cov, skel, vertexPos);

  const pos = {};
  for (const D of cov.elements())
    pos[D] = chamberPos[D].map(p => ops.times(p, basis));

  const ori = adjustedOrientation(cov, pos);

  const idcs = I.Range(0, dim).toArray();
  const tiles = properties.orbits(cov, idcs).toArray();

  return tiles.map(elms => {
    const cOrbs = properties.orbits(cov, idcs.slice(1), elms);
    const cPos = cOrbs.map(orb => pos[orb.first()]);
    const cIdcs = I.Map(cOrbs.flatMap((orb, i) => orb.map(D => [D, i])));

    return makeSurface(elms, cPos.toJS(), cIdcs.toJS(), cov, ori);
  });
};
