import * as I from 'immutable';

import * as cosets      from '../fpgroups/cosets';
import * as delaney     from './delaney';
import * as properties  from './properties';
import * as delaney2d   from './delaney2d';
import * as delaney3d   from './delaney3d';
import * as fundamental from './fundamental';
import * as covers      from './covers';
import * as periodic    from '../pgraphs/periodic';

import * as util from '../common/util';

import { matrices } from '../arithmetic/types';
const ops = matrices;


let _timers = null;

export function useTimers(timers) {
  _timers = timers;
}


const _remainingIndices = (ds, i) => ds.indices().filter(j => j != i);


const _edgeTranslations = function _edgeTranslations(cov) {
  _timers && _timers.start('_edgeTranslations');

  _timers && _timers.start('_edgeTranslations: fundamental group');
  const fg  = fundamental.fundamentalGroup(cov);
  const n   = fg.nrGenerators;
  _timers && _timers.stop('_edgeTranslations: fundamental group');

  _timers && _timers.start('_edgeTranslations: relator null space');
  const nul = ops.nullSpace(cosets.relatorMatrix(n, fg.relators).toJS());
  _timers && _timers.stop('_edgeTranslations: relator null space');

  _timers && _timers.start('_edgeTranslations: assign translations to edges');
  const result = fg.edge2word.map(function(a) {
    return a.map(function(b) {
      const v = cosets.relatorAsVector(b, n).toJS();
      return ops.times(v, nul);
    });
  });
  _timers && _timers.stop('_edgeTranslations: assign translations to edges');

  _timers && _timers.stop('_edgeTranslations');

  return result;
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
  useTimers(util.timers());

  _timers && _timers.start('skeleton');

  _timers && _timers.start('skeleton: edge translations');
  const e2t = _edgeTranslations(cov);
  _timers && _timers.stop('skeleton: edge translations');

  _timers && _timers.start('skeleton: corner shifts');
  const c2s = _cornerShifts(cov, e2t);
  _timers && _timers.stop('skeleton: corner shifts');

  _timers && _timers.start('skeleton: chamber2node');
  const chamber2node = {};
  let node = 1;
  for (const orb of properties.orbits(cov, _remainingIndices(cov, 0))) {
    for (const D of orb)
      chamber2node[D] = node;
    node += 1;
  }
  _timers && _timers.stop('skeleton: chamber2node');

  _timers && _timers.start('skeleton: edges');
  const zero = ops.vector(delaney.dim(cov));
  const edges = properties.orbitReps(cov, _remainingIndices(cov, 1))
    .map(function(D) {
      const E = cov.s(0, D);
      const v = chamber2node[D];
      const w = chamber2node[E];
      const t = e2t.getIn([D, 0]) || zero;
      const sD = c2s.getIn([D, 0]);
      const sE = c2s.getIn([E, 0]);
      const s = ops.minus(ops.plus(t, sE), sD);

      return [v, w, s];
    });
  _timers && _timers.stop('skeleton: edges');

  _timers && _timers.start('skeleton: make graph');
  const graph = periodic.make(edges);
  _timers && _timers.stop('skeleton: make graph');

  _timers && _timers.stop('skeleton');

  console.log(`Skeleton details:`);
  console.log(`${JSON.stringify(_timers.current(), null, 2)}`);

  return {
    graph,
    chamber2node: chamber2node,
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
    properties.orbits(cov, idcs, cov.elements()).forEach(function(orb) {
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


const tileSurface3D = (corners, faces) => {
  const pos = corners.map(p => interpolate(0.8, p[0], p[3]));

  return { pos, faces };
};


const tileSurface2D = (corners, faces) => {
  const pos = I.List(corners).flatMap(p => [p[0].concat(0), p[0].concat(0.1)]);

  const f = faces[0].map(i => 2 * i);

  faces = [f, f.map(x => x + 1).reverse()]
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


const tileSurface = (cov, pos, ori, elms, idcs) => {
  const cOrbs = properties.orbits(cov, idcs.slice(1), elms);
  const cPos = cOrbs.map(orb => pos[orb.first()]);
  const cIdcs = I.Map(cOrbs.flatMap((orb, i) => orb.map(D => [D, i])));

  const faces = properties.orbits(cov, [0, 1], elms)
    .map(orb => ori[orb.first()] > 0 ? orb.reverse() : orb)
    .map(orb => orb.filter((D, i) => i % 2 == 0).map(D => cIdcs.get(D)));

  if (delaney.dim(cov) == 3)
    return tileSurface3D(cPos.toJS(), faces.toJS());
  else
    return tileSurface2D(cPos.toJS(), faces.toJS());
};


const affineSymmetry = (D0, D1, pos) => {
  const bas = D => chamberBasis(pos, D);
  const linear = ops.cleanup(ops.times(ops.inverse(bas(D0)), bas(D1)));
  const shift = ops.minus(pos[D1][0], ops.times(pos[D0][0], linear));

  return linear.map(r => r.concat(0)).concat([shift.concat([1])]);
};


export const tileSurfaces = (ds, cov, skel, vertexPos, basis) => {
  const dim = delaney.dim(cov);
  const chamberPos = chamberPositions(cov, skel, vertexPos);

  const pos = {};
  for (const D of cov.elements())
    pos[D] = chamberPos[D].map(p => ops.times(p, basis));

  const phi = properties.morphism(cov, 1, ds, 1);
  const bas = D => chamberBasis(pos, D);
  const ori = adjustedOrientation(cov, pos);
  const idcs = I.Range(0, delaney.dim(cov)).toArray();
  const tileOrbits = properties.orbits(cov, idcs).toArray();

  const templates = [];
  const tileOrbitReps = [];
  const dsChamberToTemplateIndex = {};
  const tiles = [];

  for (const elms of tileOrbits) {
    const D0 = elms.find(D => ops.ne(determinant(bas(D)), 0));
    const E0 = phi.get(D0);

    let templateIndex = dsChamberToTemplateIndex[E0];
    let symmetry = ops.identityMatrix(dim + 1);

    if (templateIndex == null) {
      templateIndex = templates.length;

      for (const E of properties.orbit(ds, idcs, E0))
        dsChamberToTemplateIndex[E] = templateIndex;

      templates.push(tileSurface(cov, pos, ori, elms, idcs));
      tileOrbitReps.push(D0);
    }
    else {
      const D0 = tileOrbitReps[templateIndex];
      const D1 = elms.find(D => phi.get(D) == phi.get(D0));
      symmetry = affineSymmetry(D0, D1, pos);
    }

    const center = pos[elms.first()][dim];
    tiles.push({ templateIndex, symmetry, center });
  }

  return { templates, tiles };
};
