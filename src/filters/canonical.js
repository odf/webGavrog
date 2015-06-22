'use strict';

var fs = require('fs');

var DS      = require('../dsymbols/delaney');
var derived = require('../dsymbols/derived');
var props   = require('../dsymbols/properties');

var text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text)
  .map(function(ds) {
    return [derived.canonical(ds), props.invariant(ds)];
  })
  .sort(function(a, b) {
    if (DS.dim(a[0]) != DS.dim(b[0]))
      return DS.dim(a[0]) - DS.dim(b[0]);
    if (DS.size(a[0]) != DS.size(b[0]))
      return DS.size(a[0]) - DS.size(b[0]);
    var ia = a[1];
    var ib = b[1];
    for (var i = 0; i < ia.size && i < ib.size; ++i)
      if (ia.get(i) != ib.get(i))
        return ia.get(i) - ib.get(i);
    return ia.size() - ib.size();
  })
  .forEach(function(e) {
    console.log(''+e[0]);
  });
