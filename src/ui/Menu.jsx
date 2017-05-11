import * as React from 'react';

import Selection from './Selection';


export default class Menu extends React.Component {
  constructor() {
    super();
    this.state = { active: null };
  }

  handleSelect(i) {
    const { action } = this.props.spec[i];

    if (action)
      action();
  }

  handleHighlight(i) {
    this.setState({ active: i });
  }

  handleCancel() {
    this.setState({ active: null });
  }

  render() {
    const baseClass = this.props.className || 'Menu';
    const submenuClass = `${baseClass}Submenu`;

    const entries = this.props.spec.map(({ label, submenu }, i) => (
      <span key={i}>
        {label}
        {(this.state.active == i && submenu)
           ? <Menu className={submenuClass} spec={submenu}/> : ''}
      </span>
    ));

    return (
      <Selection className={this.props.className || "Menu"}
                 onSelect={i => this.handleSelect(i)}
                 onHighlight={i => this.handleHighlight(i)}
                 onCancel={() => this.handleCancel()}>
        {entries}
      </Selection>
    );
  }
}
