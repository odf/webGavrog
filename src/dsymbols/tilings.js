import * as I from 'immutable';

import * as cosets      from '../fpgroups/cosets';
import * as delaney     from './delaney';
import * as properties  from './properties';
import * as derived     from './derived';
import * as delaney2d   from './delaney2d';
import * as delaney3d   from './delaney3d';
import * as fundamental from './fundamental';
import * as covers      from './covers';
import * as periodic    from '../pgraphs/periodic';

import * as util from '../common/util';

import {
  rationalLinearAlgebraModular,
  numericalLinearAlgebra
} from '../arithmetic/types';

const opsR = rationalLinearAlgebraModular;
const opsF = numericalLinearAlgebra;


const _remainingIndices = (ds, i) => ds.indices().filter(j => j != i);


const _edgeTranslations = cov => {
  const fg  = fundamental.fundamentalGroup(cov);
  const n   = fg.nrGenerators;

  const nul = opsR.nullSpace(
    cosets.relatorMatrix(n, I.List(fg.relators)).toJS());

  const vec = rel => cosets.relatorAsVector(rel, n).toJS();

  return fg.edge2word.map(a => a.map(b => opsR.times(vec(b), nul)));
};


const _cornerShifts = (cov, e2t) => {
  const dim = delaney.dim(cov);
  const zero = opsR.vector(dim);

  return I.Map().withMutations(m => {
    cov.indices().forEach(i => {
      const idcs = _remainingIndices(cov, i);

      properties.traversal(cov, idcs, cov.elements()).forEach(([Dk, k, D]) => {
        if (k == properties.traversal.root)
          m.setIn([D, i], zero);
        else
          m.setIn([D, i],
                  opsR.minus(m.getIn([Dk, i]), e2t[Dk][k] || zero));
      });
    });
  });
};


export const skeleton = cov => {
  const e2t = _edgeTranslations(cov);
  const c2s = _cornerShifts(cov, e2t);

  const chamber2node = {};
  let node = 1;
  for (const orb of properties.orbits(cov, _remainingIndices(cov, 0))) {
    for (const D of orb)
      chamber2node[D] = node;
    node += 1;
  }

  const zero = opsR.vector(delaney.dim(cov));
  const edges = properties.orbitReps(cov, _remainingIndices(cov, 1))
    .map(D => {
      const E = cov.s(0, D);
      const v = chamber2node[D];
      const w = chamber2node[E];
      const t = e2t[D][0] || zero;
      const sD = c2s.getIn([D, 0]);
      const sE = c2s.getIn([E, 0]);
      const s = opsR.minus(opsR.plus(t, sE), sD);

      return [v, w, s];
    })
    .toArray();

  return {
    graph: periodic.make(edges),
    chamber2node: chamber2node,
    edgeTranslations: e2t,
    cornerShifts: c2s.toJS()
  };
};


const chamberPositions = (cov, skel, pos, basis) => {
  const dim = delaney.dim(cov);
  let result = {};

  cov.elements().forEach(D => {
    const p = pos[skel.chamber2node[D]];
    const t = skel.cornerShifts[D][0];
    result[D] = [opsF.plus(p, t)];
  });

  I.Range(1, dim+1).forEach(i => {
    const idcs = I.Range(0, i);
    properties.orbits(cov, idcs, cov.elements()).forEach(orb => {
      let s = opsF.vector(dim);
      orb.forEach(E => {
        const p = result[E][0];
        const t = skel.cornerShifts[E][i];
        s = opsF.plus(s, opsF.minus(p, t));
      });
      s = opsF.times(opsF.div(1, orb.size), s);
      orb.forEach(E => {
        const t = skel.cornerShifts[E][i];
        result[E].push(opsF.plus(s, t));
      });
   });
  });

  for (const D of cov.elements())
    result[D] = result[D].map(p => opsF.times(p, basis));

  return result;
};


const chamberBasis = (pos, D) => {
  const t = pos[D];
  return t.slice(1).map(v => opsF.minus(v, t[0]));
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
    return opsF.determinant(M);
};


export const symmetries = (ds, cov, pos) => {
  const D0 = cov.elements()
    .find(D => opsF.ne(determinant(chamberBasis(pos, D)), 0));
  const A = opsF.inverse(chamberBasis(pos, D0));

  const phi = properties.morphism(cov, 1, ds, 1);
  const E0 = phi[D0];

  return cov.elements()
    .filter(D => phi[D] == E0)
    .map(D => opsF.times(A, chamberBasis(pos, D)));
};


export const makeCover = ds =>
  delaney.dim(ds) == 3 ?
  delaney3d.pseudoToroidalCover(ds) :
  delaney2d.toroidalCover(ds);


const interpolate = (f, v, w) => opsF.plus(w, opsF.times(f, opsF.minus(v, w)));


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


const adjustedOrientation = (cov, pos) => {
  const bas = D => chamberBasis(pos, D);
  const D0 = cov.elements().find(D => opsF.ne(determinant(bas(D)), 0));
  const sgn = opsF.sgn(determinant(bas(D0)));

  const ori = properties.partialOrientation(cov);
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
  const linear = opsF.times(opsF.inverse(bas(D0)), bas(D1));
  const shift = opsF.minus(pos[D1][0], opsF.times(pos[D0][0], linear));

  return linear.map(r => r.concat(0)).concat([shift.concat([1])]);
};


export const tileSurfaces = (ds, cov, skel, vertexPos, basis) => {
  const dim = delaney.dim(cov);
  const pos = chamberPositions(cov, skel, vertexPos, basis);
  const dso = derived.orientedCover(ds);
  const phi = properties.morphism(cov, 1, dso, 1);
  const bas = D => chamberBasis(pos, D);
  const ori = adjustedOrientation(cov, pos);
  const idcs = I.Range(0, dim).toArray();
  const tileOrbits = properties.orbits(cov, idcs).toArray();

  const templates = [];
  const tileOrbitReps = [];
  const dsChamberToTemplateIndex = {};
  const tiles = [];

  for (const elms of tileOrbits) {
    const D0 = elms.find(D => opsF.ne(determinant(bas(D)), 0));
    const E0 = phi[D0];

    let templateIndex = dsChamberToTemplateIndex[E0];
    let symmetry = opsF.identityMatrix(dim + 1);

    if (templateIndex == null) {
      templateIndex = templates.length;

      for (const E of properties.orbit(dso, idcs, E0))
        dsChamberToTemplateIndex[E] = templateIndex;

      templates.push(tileSurface(cov, pos, ori, elms, idcs));
      tileOrbitReps.push(D0);
    }
    else {
      const D0 = tileOrbitReps[templateIndex];
      const D1 = elms.find(D => phi[D] == phi[D0]);
      symmetry = affineSymmetry(D0, D1, pos);
    }

    const center = pos[elms.first()][dim];
    tiles.push({ templateIndex, symmetry, center });
  }

  return { templates, tiles };
};
