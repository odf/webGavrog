'use strict';

var React = require('react');
var $ = React.createElement;


class CheckBox extends React.Component {
  handleChange(event) {
    var val = event.target.checked;
    this.props.update(this.props.path, val, val);
  }

  render() {
    return $('input', {
      name: this.props.label,
      type: "checkbox",
      checked: this.props.value || false,
      onChange: this.handleChange.bind(this) });
  }
}


module.exports = CheckBox;
