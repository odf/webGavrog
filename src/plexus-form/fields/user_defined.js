'use strict';

var React = require('react');

var normalizer = require('./utils/normalizer');
var parser = require('./utils/parser');


class UserDefinedField extends React.Component {
  normalize(text) {
    var n = normalizer[this.props.type];
    return n ? n(text) : text;
  }

  parse(text) {
    var p = parser[this.props.type];
    return p ? p(text) : text;
  }

  handleChange(value) {
    var text = this.normalize(value);
    this.props.update(this.props.path, text, this.parse(text));
  }

  handleKeyPress(event) {
    if (event.key == 'Enter') {
      event.preventDefault();
    }
  }

  render() {
    return React.createElement(this.props.component, {
      schema    : this.props.schema,
      value     : this.props.value || '',
      onKeyPress: this.handleKeyPress.bind(this),
      onChange  : this.handleChange.bind(this)
    });
  }
}


module.exports = UserDefinedField;
