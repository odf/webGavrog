'use strict';

var ou = require('./objective');

var alternative = require('./alternative');
var resolve = require('./resolve');


module.exports = function(data, schema, context) {
  const tmp = ou.prune(withDefaultOptions(data, schema, context));
  if (tmp == null) {
    const effectiveSchema = resolve(schema, context);
    if (effectiveSchema.type == 'array')
      return [];
    else if (effectiveSchema.type == 'object')
      return {};
    else
      return null;
  }
  else
    return tmp;
};

function withDefaultOptions(data, schema, context) {
  var result;
  var key;
  var effectiveSchema = resolve(schema, context);

  if (effectiveSchema.oneOf) {
    effectiveSchema = alternative.schema(data, effectiveSchema, context);
  }

  if (effectiveSchema['enum']) {
    result = data || effectiveSchema['enum'][0];
  } else if (effectiveSchema.type === 'object') {
    result = ou.merge(data);
    for (key in effectiveSchema.properties) {
      result[key] = withDefaultOptions((data || {})[key],
                                       effectiveSchema.properties[key],
                                       context);
    }
  } else if (effectiveSchema.type === 'array') {
    result = [];
    for (const i in data || []) {
      if (data[i] != null)
        result.push(withDefaultOptions(data[i], effectiveSchema.items, context));
    }
  } else {
    result = data;
  }
  return result;
}
