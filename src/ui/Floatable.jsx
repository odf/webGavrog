import * as React from 'react';
import * as ReactDOM from 'react-dom';


const clamp = (val, lo, hi) => Math.max(lo, Math.min(hi, val));


export default class Floatable extends React.Component {
  constructor() {
    super();
    this.state = {
      posX: 10,
      posY: 10
    };
  }

  handleMouseDown(event) {
    event.preventDefault();

    this.mouseMoveListener = event => this.handleMouseMove(event);
    this.mouseUpListener = event => this.handleMouseUp(event);

    document.addEventListener('mousemove', this.mouseMoveListener, false);
    document.addEventListener('mouseup', this.mouseUpListener, false);

    const element = ReactDOM.findDOMNode(this);

    this.setState({
      mouseDown: true,
      offsetX: this.state.posX - event.clientX,
      offsetY: this.state.posY - event.clientY,
      maxX   : window.innerWidth  - element.offsetWidth,
      maxY   : window.innerHeight - element.offsetHeight
    });
  }

  handleMouseMove(event) {
    event.preventDefault();

    this.setState({
      posX: clamp(event.clientX + this.state.offsetX, 0, this.state.maxX),
      posY: clamp(event.clientY + this.state.offsetY, 0, this.state.maxY)
    });
  }

  handleMouseUp(event) {
    event.preventDefault();

    document.removeEventListener('mousemove', this.mouseMoveListener);
    document.removeEventListener('mouseup', this.mouseUpListener);

    this.setState({
      mouseDown: false
    });
  }

  render() {
    return (
      <div className={`floatable ${this.props.className}`}
           style={{ left  : `${this.state.posX}px`,
                    top   : `${this.state.posY}px`,
                    cursor: this.state.mouseDown ? 'grabbing' : 'grab' }}
           onMouseDown={event => this.handleMouseDown(event)}>
        {this.props.children}
      </div>
    );
  }
}
