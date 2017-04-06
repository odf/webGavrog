import * as React from 'react';

import Selection from './Selection';


const Menu = React.createClass({
  getInitialState() {
    return { active: null };
  },

  handleSelect(i) {
    this.setState((state, props) => (
      { active: state.active == null ? i : null }
    ));
  },

  handleHighlight(i) {
    this.setState((state, props) =>
      state.active == null ? {} : { active: i }
    );
  },

  handleCancel() {
    this.setState({ active: null });
  },

  render() {
    const baseClass = this.props.className || 'Menu';
    const activeClass = `${baseClass}Active`;

    const entries = this.props.spec.map(({ label, submenu }, i) => (
      <span key={i} className={this.state.active == i ? activeClass : ""}>
        {label}
        {(this.state.active == i && submenu) ? <Menu className="infoBoxMenu" spec={submenu}/> : ''}
      </span>
    ));

    return (
      <Selection className={this.props.className || "Menu"}
                 onSelect={this.handleSelect}
                 onHighlight={this.handleHighlight}
                 onCancel={this.handleCancel}>
        {entries}
      </Selection>
    );
  }
});


export default Menu;
