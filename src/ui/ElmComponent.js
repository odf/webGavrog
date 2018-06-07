import * as React from 'react';


export default class Elm extends React.Component {
  initialize(node) {
    if (node == null)
      return;
    
    const app = this.props.src.embed(node, this.props.flags);

    if (this.props.ports)
      this.props.ports(app.ports);
  }

  shouldComponentUpdate(prevProps) {
    return false;
  }

  render() {
    return React.createElement('div', { ref: this.initialize.bind(this) });
  }
}
