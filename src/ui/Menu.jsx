import * as React from 'react';


export default React.createClass({
  prefix() {
    return this.props.className || "Menu";
  },

  renderMenuItem(name) {
    return <li className={`${this.prefix()}Item`} key={name}>{name}</li>;
  },

  render() {
    return (
      <ul className={this.prefix()}>
        { this.props.labels.map(this.renderMenuItem) }
      </ul>
    );
  }
});
