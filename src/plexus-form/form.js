'use strict';

var React = require('react');
var $ = React.createElement;

var ou = require('./objective');

var fields = require('./fields');
var normalise = require('./normalise');


export default class Form extends React.Component {
  constructor(props) {
    super(props);

    var values = props.values;
    var errors = this.validate(props.schema, values, context(props));

    this.state = { values: values,
                   output: values,
                   errors: errors };
  }

  componentWillReceiveProps(props) {
    var values = props.values || this.state.values;
    var output = props.values || this.state.output;
    this.setState({
      values: values,
      output: output,
      errors: this.validate(props.schema, output, context(props))
    });
  }

  setValue(path, raw, parsed) {
    var schema = this.props.schema;
    var ctx    = context(this.props);
    var values = normalise(ou.setIn(this.state.values, path, raw),
                           schema, ctx);
    var output = normalise(ou.setIn(this.state.output, path, parsed),
                           schema, ctx);
    var errors = this.validate(schema, output, ctx);

    this.props.onChange && this.props.onChange(output, errors);

    if (this.props.submitOnChange) {
      this.props.onSubmit(output, null, errors);
    }
    else {
      this.setState({
        values: values,
        output: output,
        errors: errors
      });
    }
  }

  getValue(path) {
    return ou.getIn(this.state.values, path);
  }

  getErrors(path) {
    return this.state.errors[makeKey(path)];
  }

  validate(schema, values, context) {
    return hashedErrors(this.props.validate(schema, values, context));
  }

  preventSubmit(event) {
    event.preventDefault();
  }

  handleSubmit(event) {
    event.preventDefault();
    this.props.onSubmit(this.state.output,
                        event.target.value,
                        this.state.errors);
  }

  handleKeyPress(event) {
    if (event.key == 'Enter' && this.props.enterKeySubmits) {
      this.props.onSubmit(this.state.output, this.props.enterKeySubmits);
    }
  }

  renderButtons() {
    var submit = this.handleSubmit.bind(this);

    if (typeof this.props.buttons === 'function') {
      return this.props.buttons(submit);
    }
    else {
      var buttons = (this.props.buttons || ['Cancel', 'Submit'])
        .map(function(value) {
          return $('input',
                   { type   : 'submit',
                     key    : value,
                     value  : value,
                     onClick: submit
                   });
        });
      return $('p', { className: 'form-buttons' }, buttons);
    }
  }

  render() {
    var renderedFields = fields.make(fields, {
      schema        : this.props.schema,
      context       : context(this.props),
      fieldWrapper  : this.props.fieldWrapper,
      sectionWrapper: this.props.sectionWrapper,
      handlers      : this.props.handlers,
      hints         : this.props.hints,
      path          : [],
      update        : this.setValue.bind(this),
      getValue      : this.getValue.bind(this),
      getErrors     : this.getErrors.bind(this)
    });

    return $('form',
             { onSubmit  : this.preventSubmit.bind(this),
               onKeyPress: this.handleKeyPress.bind(this),
               className : this.props.className
             },
             this.props.extraButtons ? this.renderButtons() : null,
             renderedFields,
             this.renderButtons());
  }
}


function hashedErrors(errors) {
  var result = {};
  var i, entry;
  for (i = 0; i < errors.length; ++i) {
    entry = errors[i];
    result[makeKey(entry.path)] = entry.errors;
  }
  return result;
}

function makeKey(path) {
  return path.join('_');
}

function context(props) {
  return props.context || props.schema;
}
