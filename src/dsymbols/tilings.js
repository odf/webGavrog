'use strict';

var I = require('immutable');
var F = require('../arithmetic/float');
var M = require('../arithmetic/matrix')(F, 0, 1);
var V = require('../arithmetic/vector')(F, 0);

var cosets      = require('../fpgroups/cosets');
var delaney     = require('./delaney');
var properties  = require('./properties');
var delaney2d   = require('./delaney2d');
var delaney3d   = require('./delaney3d');
var fundamental = require('./fundamental');
var covers      = require('./covers');
var periodic    = require('../pgraphs/periodic');


var _remainingIndices = function _remainingIndices(ds, i) {
  return ds.indices().filter(function(j) { return j != i; });
};


var _edgeTranslations = function _edgeTranslations(cov) {
  var fg  = fundamental.fundamentalGroup(cov);
  var n   = fg.nrGenerators;
  var nul = M.nullSpace(M.make(cosets.relatorMatrix(n, fg.relators)));

  return fg.edge2word.map(function(a) {
    return a.map(function(b) {
      var v = M.make([cosets.relatorAsVector(b, n)]);
      return V.make(M.times(v, nul).data.first());
    });
  });
};


var _cornerShifts = function _cornerShifts(cov, e2t) {
  var dim = delaney.dim(cov);
  var zero = V.constant(dim);

  return I.Map().withMutations(function(m) {
    cov.indices().forEach(function(i) {
      var idcs = _remainingIndices(cov, i);

      properties.traversal(cov, idcs, cov.elements()).forEach(function(e) {
        var Dk = e[0];
        var k  = e[1];
        var D  = e[2];

        if (k == properties.traversal.root)
          m.setIn([D, i], zero);
        else
          m.setIn([D, i], V.minus(m.getIn([Dk, i]), e2t.getIn([Dk, k]) || zero));
      });
    });
  });
};


var _skeleton = function _skeleton(cov, e2t, c2s) {
  var dim = delaney.dim(cov);
  var zero = V.constant(dim);
  var chambers = cov.elements();
  var idcs0 = _remainingIndices(cov, 0);
  var nodeReps = properties.orbitReps(cov, idcs0, chambers);
  var node2chamber = I.Map(I.Range().zip(nodeReps));
  var chamber2node = I.Map(nodeReps.zip(I.Range()).flatMap(function(p) {
    return properties.orbit(cov, idcs0, p[0]).zip(I.Repeat(p[1]));
  }));

  var edges = properties.orbitReps(cov, _remainingIndices(cov, 1), chambers)
    .map(function(D) {
      var E = cov.s(0, D);
      var v = chamber2node.get(D);
      var w = chamber2node.get(E);
      var t = e2t.getIn([D, 0]) || zero;
      var sD = c2s.getIn([D, 0]);
      var sE = c2s.getIn([E, 0]);
      var s = V.minus(V.plus(t, sE), sD);

      return [v, w, s.data];
    });

  return {
    graph: periodic.make(edges),
    node2chamber: node2chamber,
    chamber2node: chamber2node
  };
};


var _chamberPositions = function _chamberPositions(cov, e2t, c2s, skel, pos) {
  var dim = delaney.dim(cov);
  var result = I.Map();

  cov.elements().forEach(function(D) {
    var p = pos.get(skel.chamber2node.get(D));
    var t = c2s.getIn([D, 0]);
    result = result.setIn([D, 0], V.plus(V.make(p), t));
  });

  I.Range(1, dim+1).forEach(function(i) {
    var idcs = I.Range(0, i);
    properties.orbitReps(cov, idcs, cov.elements()).forEach(function(D) {
      var orb = properties.orbit(cov, idcs, D);
      var s = V.constant(dim);
      orb.forEach(function(E) {
        var p = result.getIn([E, 0]);
        var t = c2s.getIn([E, i]);
        s = V.plus(s, V.minus(p, t));
      });
      s = V.scaled(1 / orb.size, s);
      orb.forEach(function(E) {
        var t = c2s.getIn([E, i]);
        result = result.setIn([E, i], V.plus(s, t));
      });
   });
  });

  return result;
};


var _chamberBasis = function _chamberBasis(pos, D) {
  var t = pos.get(D).valueSeq();
  return M.make(I.Range(1, t.size).map(function(i) {
    return V.minus(t.get(i), t.get(0)).data;
  }));
};


var _symmetries = function _symmetries(ds, cov, pos) {
  var n = delaney.size(ds);
  var m = delaney.size(cov) / n;

  var D = ds.elements().find(function(D) {
    return F.sgn(M.determinant(_chamberBasis(pos, D))) != 0;
  });
  var A = M.inverse(_chamberBasis(pos, D));

  return I.Range(0, m).map(function(i) {
    return M.times(A, _chamberBasis(pos, D + i*n));
  });
};


var _resymmetrizedGramMatrix = function _resymmetrizedGramMatrix(G, syms) {
  var A = M.scaled(0, G);

  syms.forEach(function(S) {
    A = M.plus(A, M.times(S, M.times(G, M.transposed(S))));
  });

  A = M.scaled(1/syms.size, A);

  return A;
};


var _scalarProduct = function _scalarProduct(v, w, G) {
  var A = M.times(M.make([v.data]), M.times(G, M.transposed(M.make([w.data]))));
  return M.get(A, 0, 0);
};


var _orthonormalBasis = function _orthonormalBasis(G) {
  var n = G.data.size;
  var e = M.identity(n).data.map(V.make);

  I.Range(0, n).forEach(function(i) {
    var v = e.get(i);
    I.Range(0, i).forEach(function(j) {
      var w = e.get(j);
      var f = _scalarProduct(v, w, G);
      v = V.minus(v, V.scaled(f, w));
    });
    var d = _scalarProduct(v, v, G);
    v = V.scaled(1/Math.sqrt(d), v);
    e = e.set(i, v);
  });

  return M.make(e.map(function(v) { return v.data; }));
};


module.exports = function net(ds) {
  var cov  = (delaney.dim(ds) == 3 ?
              delaney3d.pseudoToroidalCover(ds) :
              delaney2d.toroidalCover(ds));
  var e2t  = _edgeTranslations(cov);
  var c2s  = _cornerShifts(cov, e2t);
  var skel = _skeleton(cov, e2t, c2s);
  var vpos = periodic.barycentricPlacementAsFloat(skel.graph);
  var pos  = _chamberPositions(cov, e2t, c2s, skel, vpos);
  var syms = _symmetries(ds, cov, pos);

  var G = _resymmetrizedGramMatrix(M.identity(delaney.dim(ds)), syms);
  var basis = _orthonormalBasis(G);

  return {
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
  var test = function test(ds) {
    console.log('ds = '+ds);
    console.log(module.exports(ds));
    console.log();
  }

  test(delaney.parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
  test(delaney.parse('<1.1:1:1,1,1:6,3>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,6 5 8 7:4,4>'));
  test(delaney.parse('<1.1:8:2 4 6 8,8 3 5 7,5 6 8 7:4,4>'));
  test(delaney.parse('<1.1:1 3:1,1,1,1:4,3,4>'));
  test(delaney.parse('<1.1:2 3:2,1 2,1 2,2:6,3 2,6>'));
  test(delaney.parse('<1.1:2 3:1 2,1 2,1 2,2:3 3,3 4,4>'));
}
