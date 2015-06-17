'use strict';

var fs = require('fs');

var DS         = require('../dsymbols/delaney');
var properties = require('../dsymbols/properties');
var derived    = require('../dsymbols/derived');

var text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text).forEach(function(ds) {
  if (properties.invariant(derived.dual(ds)).equals(properties.invariant(ds)))
    console.log(''+ds);
});
