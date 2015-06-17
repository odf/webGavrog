'use strict';

var fs = require('fs');

var DS     = require('../dsymbols/delaney');
var tiling = require('../dsymbols/tilings');
var F      = require('../arithmetic/float');
var M      = require('../arithmetic/matrix')(F, 0, 1);

var text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text).forEach(function(ds) {
  var d = DS.dim(ds);
  var t = tiling(ds);

  if (t.cover.elements().every(function(D) {
    var A = M.make(t.positions.get(D).valueSeq().map(function(x) {
      return x.data;
    }));
    return M.rank(A) == d;
  }))
    console.log(''+ds);
});
