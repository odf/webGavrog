import * as I from 'immutable';

import * as cosets      from '../fpgroups/cosets';
import * as delaney     from './delaney';
import * as properties  from './properties';
import * as delaney2d   from './delaney2d';
import * as delaney3d   from './delaney3d';
import * as fundamental from './fundamental';
import * as covers      from './covers';
import * as periodic    from '../pgraphs/periodic';
import * as spacegroups from '../geometry/spacegroups';
import embed from '../pgraphs/embedding';

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


const _skeleton = function _skeleton(cov, e2t, c2s) {
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
    node2chamber: node2chamber,
    chamber2node: chamber2node
  };
};


const _chamberPositions = (cov, e2t, c2s, skel, pos) => {
  const dim = delaney.dim(cov);
  let result = I.Map();

  cov.elements().forEach(function(D) {
    const p = pos[skel.chamber2node.get(D)];
    const t = c2s.getIn([D, 0]);
    result = result.setIn([D, 0], ops.plus(p, t));
  });

  I.Range(1, dim+1).forEach(function(i) {
    const idcs = I.Range(0, i);
    properties.orbitReps(cov, idcs, cov.elements()).forEach(function(D) {
      const orb = properties.orbit(cov, idcs, D);
      let s = ops.vector(dim);
      orb.forEach(function(E) {
        const p = result.getIn([E, 0]);
        const t = c2s.getIn([E, i]);
        s = ops.plus(s, ops.minus(p, t));
      });
      s = ops.times(ops.div(1, orb.size), s);
      orb.forEach(function(E) {
        const t = c2s.getIn([E, i]);
        result = result.setIn([E, i], ops.plus(s, t));
      });
   });
  });

  return result;
};


const _chamberBasis = function _chamberBasis(pos, D) {
  const t = pos.get(D).valueSeq().toArray();
  return ops.cleanup(t.slice(1).map(v => ops.minus(v, t[0])));
};


const _symmetries = function _symmetries(ds, cov, pos) {
  const D0 = cov.elements()
    .find(D => ops.ne(ops.determinant(_chamberBasis(pos, D)), 0));
  const A = ops.inverse(_chamberBasis(pos, D0));

  const phi = properties.morphism(cov, 1, ds, 1);
  const E0 = phi.get(D0);

  return I.List(
    cov.elements()
      .filter(D => phi.get(D) == E0)
      .map(D => ops.times(A, _chamberBasis(pos, D))));
};


const _scalarProduct = (v, w, G) => ops.times(ops.times(v, G), w);


const _orthonormalBasis = function _orthonormalBasis(G) {
  const [n, m] = ops.shape(G);
  let e = ops.identityMatrix(n);

  I.Range(0, n).forEach(function(i) {
    let v = e[i];
    I.Range(0, i).forEach(function(j) {
      const w = e[j];
      const f = _scalarProduct(v, w, G);
      v = ops.minus(v, ops.times(f, w));
    });
    const d = _scalarProduct(v, v, G);
    v = ops.times(ops.div(1, ops.sqrt(d)), v);
    e[i] = v;
  });

  return ops.cleanup(e);
};


const makeCover = ds =>
  delaney.dim(ds) == 3 ?
  delaney3d.pseudoToroidalCover(ds) :
  delaney2d.toroidalCover(ds);


export default function tiling(ds, cover, relax) {
  const cov  = cover || makeCover(ds);
  const e2t  = _edgeTranslations(cov);
  const c2s  = _cornerShifts(cov, e2t);
  const skel = _skeleton(cov, e2t, c2s);
  const embedding = embed(skel.graph, relax);

  const vpos = embedding.positions ||
    periodic.barycentricPlacement(skel.graph);

  const pos  = _chamberPositions(cov, e2t, c2s, skel, I.Map(vpos).toJS());
  const syms = _symmetries(ds, cov, pos);

  const id = ops.identityMatrix(delaney.dim(ds));

  const G = embedding.gram ||
    spacegroups.resymmetrizedGramMatrix(id, syms.toArray());

  const O = ops.cleanup(_orthonormalBasis(G));
  const basis = ops.cleanup(ops.inverse(O));

  return {
    ds          : ds,
    cover       : cov,
    graph       : skel.graph,
    node2chamber: skel.node2chamber,
    chamber2node: skel.chamber2node,
    positions   : pos,
    symmetries  : syms,
    gramMatrix  : G,
    basis       : basis
  };
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const test = function test(ds) {
    console.log('ds = '+ds);
    const til = tiling(ds);
    Object.keys(til).forEach(k => console.log(`${k}: ${til[k]}`));
    console.log();
  }

  const timer = require('../common/util').timer();

  test(delaney.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(delaney.parse('<1.1:1:1,1,1:6,3>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));
  test(delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>'));
  test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'));

  console.log();
  console.log(`Computation time: ${timer()} msec`);
}
