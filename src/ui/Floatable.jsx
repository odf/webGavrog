import * as React from 'react';

export default React.createClass({
  getInitialState() {
    return {
      posX: 10,
      posY: 10
    };
  },

  handleMouseDown(event) {
    event.preventDefault();

    document.addEventListener('mousemove', this.handleMouseMove, false);
    document.addEventListener('mouseup'  , this.handleMouseUp, false);

    this.setState({
      mouseDown: true,
      offsetX: this.state.posX - event.clientX,
      offsetY: this.state.posY - event.clientY
    });
  },

  handleMouseMove(event) {
    event.preventDefault();

    this.setState({
      posX: event.clientX + this.state.offsetX,
      posY: event.clientY + this.state.offsetY
    });
  },

  handleMouseUp(event) {
    event.preventDefault();

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup'  , this.handleMouseUp);

    this.setState({
      mouseDown: false
    });
  },

  render() {
    return (
      <div className="floatable"
           style={{ left  : `${this.state.posX}px`,
                    top   : `${this.state.posY}px`,
                    cursor: this.state.mouseDown ? 'grabbing' : 'grab' }}
           onMouseDown={this.handleMouseDown}>
        {this.props.children}
      </div>
    );
  }
});
