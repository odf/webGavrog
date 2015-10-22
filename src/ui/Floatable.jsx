import * as React from 'react';

export default React.createClass({
  render() {
    return (
      <div className="floatable">
        {this.props.children}
      </div>
    );
  }
});
