import * as React from 'react';
import * as ReactDOM from 'react-dom';


export default React.createClass({
  getInitialState() {
    return {};
  },

  componentDidMount() {
    document.addEventListener('mousedown', this.handleMouseDown);
  },

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleMouseDown);
  },

  handleMouseDown(event) {
    const node = ReactDOM.findDOMNode(this);
    const { left, right, top, bottom } = node.getBoundingClientRect();
    const { pageX: x, pageY: y } = event;

    if (x < left || x > right || y < top || y > bottom)
      this.cancel();
    else
      event.preventDefault();
  },

  handleMouseEnter(event) {
    this.focus();
  },

  handleKeyDown(event) {
    const { key, keyCode } = event;

    if (key == 'ArrowLeft' || key == 'ArrowUp' ||
        keyCode == 37 || keyCode == 38)
    {
      event.preventDefault();
      this.previous();
    }
    else if (key == 'ArrowRight' || key == 'ArrowDown' ||
             keyCode == 39 || keyCode == 40)
    {
      event.preventDefault();
      this.next();
    }
    else if (key == 'Enter' || keyCode == 13) {
      event.preventDefault();
      this.select();
    }
    else if (key == 'Escape' || keyCode == 27) {
      event.preventDefault();
      this.cancel();
    }
    else if (key == 'Tab' || keyCode == 9) {
      this.select();
    }
  },

  focus() {
    this.refs.container.focus();
  },

  highlight(i) {
    this.focus();
    this.setState({ highlighted: i });
    if (this.props.onHighlight)
      this.props.onHighlight(i);
  },

  next() {
    const n = this.props.children.length;
    const i = this.state.highlighted + 1;

    if (i < n)
      this.highlight(i);
    else if (this.props.onMenuLeave) {
      this.highlight(null);
      this.props.onMenuLeave();
    } else
      this.highlight(0);
  },

  previous() {
    const n = this.props.children.length;
    const i = this.state.highlighted - 1;

    if (i >= 0)
      this.highlight(i);
    else if (this.props.onMenuLeave) {
      this.highlight(null);
      this.props.onMenuLeave();
    } else
      this.highlight(n-1);
  },

  select(i) {
    const selected = i == null ? this.state.highlighted : i;
    this.setState({ selected: selected, highlighted: selected });
    if (this.props.onSelect)
      this.props.onSelect(selected);
  },

  cancel() {
    if (this.props.onCancel)
      this.props.onCancel();
  },

  render() {
    const baseClass = this.props.className || 'Selection';

    const classes = i => {
      const t = [ [`${baseClass}Item`     , true],
                  [`${baseClass}Highlight`, this.state.highlighted == i],
                  [`${baseClass}Selected` , this.state.selected == i] ];

      return t.filter(([_, val]) => !!val)
              .map(([cl, _]) => cl)
              .join(' ');
    };

    const wrapItem = (item, i) => (
      <li key          = {i}
          className    = {classes(i)}
          onMouseEnter = {event => this.highlight(i)}
          onClick      = {event => this.select(i)}
          >
        {item}
      </li>
    );

    return (
      <ul className = {baseClass}
          tabIndex     = {0}
          ref          = "container"
          onMouseEnter = {this.handleMouseEnter}
          onKeyDown    = {this.handleKeyDown}>
        {this.props.children.map(wrapItem)}
      </ul>
    );
  }
});
