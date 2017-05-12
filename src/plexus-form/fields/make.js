'use strict';

var React = require('react');

var ou = require('../objective');

var resolve = require('../resolve');
var types = require('../types');
var wrapped = require('./utils/wrapped');


module.exports = function(fields, props) {
  var schema = resolve(props.schema, props.context);
  var hints = schema['x-hints'] || {};
  var inputComponent = ou.getIn(hints, ['form', 'inputComponent']);
  var inputHandler = inputComponent && props.handlers[inputComponent];
  var key = makeKey(props.path);

  props = ou.merge(props, {
    schema: schema,
    key   : key,
    label : key,
    value : props.getValue(props.path),
    errors: props.getErrors(props.path),
    type  : schema.type
  });

  var itemProps = ou.without(props, 'deleteable');

  if (inputHandler) {
    itemProps = ou.merge(itemProps, { component: inputHandler });
    return wrapped.field(props, React.createElement(fields.UserDefinedField,
                                                    itemProps));
  }
  else if (schema['oneOf']) {
    return wrapped.section(props, types.alternative(fields, itemProps));
  }
  else if (schema['enum']) {
    itemProps = ou.merge(itemProps, {
        values: schema['enum'],
        names: schema['enumNames'] || schema['enum'] });
    return wrapped.field(props, React.createElement(fields.Selection,
                                                    itemProps));
  }

  switch (schema.type) {
  case "boolean":
    return wrapped.field(props, React.createElement(fields.CheckBox, itemProps));
  case "object" :
    return wrapped.section(props, types.object(fields, itemProps));
  case "array"  :
    return wrapped.section(props, types.array(fields, itemProps));
  case "number" :
  case "integer":
  case "string" :
  default:
    return wrapped.field(props, React.createElement(fields.InputField,
                                                    itemProps));
  }
};

function makeKey(path) {
  return path.join('_');
}
