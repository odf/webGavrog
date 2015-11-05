import * as React from 'react';

import Selection from './Selection';


export default React.createClass({
  handleSelect(i) {
    console.log(`=> ${i}`);
  },

  render() {
    return (
      <Selection className={this.props.className || "Menu"}
                 onSelect={this.handleSelect}>
        { this.props.spec.map(({ label }) => label) }
      </Selection>
    );
  }
});
