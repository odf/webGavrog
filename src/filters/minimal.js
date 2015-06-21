'use strict';

var fs = require('fs');

var DS         = require('../dsymbols/delaney');
var properties = require('../dsymbols/properties');

var text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text).forEach(function(ds) {
  if (properties.isMinimal(ds))
    console.log(''+ds);
});
