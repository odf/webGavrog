'use strict';

var ou      = require('./objective');
var resolve = require('./resolve.js');

exports.schema = function(value, schema, context) {
  var selector, options, selected;

  selector = ou.getIn(schema, ['x-hints', 'form', 'selector']);
  if (!selector) {
    return;
  }

  var dereferenced = schema.oneOf.map(function(alt) {
    return resolve(alt, context);
  });
    
  options = dereferenced.map(function(alt) {
    return ou.getIn(alt, [ 'properties', selector, 'enum', 0 ]) || "";
  });

  selected = (value || {})[selector] || options[0];

  return ou.mergeDeep(
    {
      type: 'object',
      properties: ou.without(schema.properties, 'oneOf', 'selector')
    },
    ou.setIn(dereferenced[options.indexOf(selected)],
             [ 'properties', selector ],
             ou.merge(ou.getIn(schema, [ 'properties', selector]),
                      { enum: options }))
  );
};
