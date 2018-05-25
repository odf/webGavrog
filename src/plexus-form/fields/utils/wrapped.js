'use strict';

var React = require('react');
var $ = React.createElement;

var ou = require('../../objective');


var errorClass = function(errors) {
  if(!errors || errors.length === 0) {
    return '';
  }

  return 'error';
};

var makeTitle = function(description, errors) {
  var parts = [];
  if (description && description.length > 0) {
    parts.push(description);
  }
  if (errors && errors.length > 0) {
    parts.push(errors.join('\n'));
  }
  return parts.join('\n\n');
};

class FieldWrapper extends React.Component {
  clear() {
    this.props.update(this.props.path, null, null);
  }

  renderDeleteButton() {
    if (this.props.deleteable)
      return $('button', {
        onClick: this.clear.bind(this),
        className: 'deleteButton'
      }, "X");
    else
      return null;
  }

  render() {
    var classes = [].concat(errorClass(this.props.errors) || [],
                            'form-element',
                            this.props.classes || []);

    return $('div',
             { className: classes.join(' '),
               key      : this.props.label,
               title    : makeTitle(this.props.description, this.props.errors)
             },
             $('label', { htmlFor: this.props.label }, this.props.title),
             this.renderDeleteButton(),
             this.props.children);
  }
}


class SectionWrapper extends React.Component {
  clear() {
    this.props.update(this.props.path, null, null);
  }

  renderDeleteButton() {
    if (this.props.deleteable)
      return $('button', {
        onClick: this.clear.bind(this),
        className: 'deleteButton'
      }, "X");
    else
      return null;
  }

  renderLegend() {
    var legendClasses = [].concat(errorClass(this.props.errors) || [],
                                  'form-section-title');
    if (this.props.title)
      return $('legend',
               { className: legendClasses.join(' '),
                 title: makeTitle(this.props.description, this.props.errors)
               },
               this.props.title);
    else
      return null;
  }

  render() {
    var level = this.props.path.length;
    var classes = [].concat('form-section',
                            (level > 0 ? 'form-subsection' : []),
                            this.props.classes || []);

    return $('fieldset',
             { className: classes.join(' '),
               key      : this.props.label
             },
             this.renderLegend(),
             this.renderDeleteButton(),
             this.props.children);
  }
}


var propsForWrapper = function(props) {
  return {
    label      : props.label,
    path       : props.path,
    errors     : props.errors,
    classes    : ou.getIn(props.schema, ['x-hints', 'form', 'classes']),
    title      : props.schema.title,
    type       : props.schema.type,
    description: props.schema.description,
    update     : props.update,
    deleteable : props.deleteable
  };
};

exports.section = function(props, fields) {
  return React.createElement(props.sectionWrapper || SectionWrapper,
    propsForWrapper(props),
    fields);
};

exports.field = function(props, field) {
  return React.createElement(props.fieldWrapper || FieldWrapper,
    propsForWrapper(props),
    field);
};
