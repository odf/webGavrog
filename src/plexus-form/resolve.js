'use strict';

var ou = require('./objective');


module.exports = function(schema, context) {
  var reference = schema['$ref'];

  if (reference) {
    if (!reference.match(/^#(\/([a-zA-Z_][a-zA-Z_0-9]*|[0-9]+))*$/)) {
      throw new Error('reference '+reference+' has unsupported format');
    }

    return ou.merge(
      ou.getIn(context, reference.split('/').slice(1)),
      ou.without(schema, '$ref'));
  }
  else {
    return schema;
  }
};
