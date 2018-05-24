'use strict';

var React = require('react');
var $ = React.DOM;

var normalizer = require('./utils/normalizer');
var parser = require('./utils/parser');


class Selection extends React.Component {
  normalize(text) {
    // XXXXX: assume string in case type isn't set
    var type = this.props.type || 'string';

    return normalizer[type](text);
  }

  parse(text) {
    // XXXXX: assume string in case type isn't set
    var type = this.props.type || 'string';

    return parser[type](text);
  }

  handleChange(event) {
    var val = this.normalize(event.target.value);
    this.props.update(this.props.path, val, this.parse(val));
  }

  render() {
    var names = this.props.names;

    return $.select(
      {
        name    : this.props.label,
        value   : this.props.value || this.props.values[0],
        onChange: this.handleChange.bind(this)
      },
      this.props.values.map(function(opt, i) {
        return $.option({ key: opt, value: opt }, names[i] || opt);
      }));
  }
}


module.exports = Selection;
