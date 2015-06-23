'use strict';

var fs = require('fs');

var DS       = require('../dsymbols/delaney');
var tiling   = require('../dsymbols/tilings');
var periodic = require('../pgraphs/periodic');
var Q        = require('../arithmetic/number');
var M        = require('../arithmetic/matrix')(Q, 0, 1);
var V        = require('../arithmetic/vector')(Q, 0);

var text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text).forEach(function(ds) {
  var dim = DS.dim(ds);
  var G   = tiling(ds).graph;
  var pos = periodic.barycentricPlacement(G).map(V.make);

  var good = periodic.adjacencies(G).entrySeq().every(function(e) {
    var p = pos.get(e[0]);
    var neighbors = e[1].map(function(n) {
      return V.minus(V.plus(pos.get(n.v), V.make(n.s)), p);
    });
    var A = M.make(neighbors.map(function(v) { return v.data; }));
    return M.rank(A) == dim;
  });

  if (good)
    console.log(''+ds);
});
