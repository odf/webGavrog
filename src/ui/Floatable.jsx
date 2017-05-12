import * as React from 'react';
import * as ReactDOM from 'react-dom';


const clamp = (val, lo, hi) => Math.max(lo, Math.min(hi, val));


export default class Floatable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      posX: props.x || 10,
      posY: props.y || 10
    };
  }

  maxX() {
    return window.innerWidth - ReactDOM.findDOMNode(this).offsetWidth;
  }

  maxY() {
    return window.innerHeight - ReactDOM.findDOMNode(this).offsetHeight;
  }

  componentDidMount() {
    let { posX: x, posY: y } = this.state;

    switch (x) {
      case 'l': x = 0; break;
      case 'c': x = this.maxX() / 2; break;
      case 'r': x = this.maxX(); break;
      default: break;
    }

    switch (y) {
      case 't': y = 0; break;
      case 'c': y = this.maxY() / 2; break;
      case 'b': y = this.maxY(); break;
      default: break;
    }

    this.setState({ posX: x, posY: y });
  }

  handleMouseDown(event) {
    this.mouseMoveListener = event => this.handleMouseMove(event);
    this.mouseUpListener = event => this.handleMouseUp(event);

    document.addEventListener('mousemove', this.mouseMoveListener, false);
    document.addEventListener('mouseup', this.mouseUpListener, false);

    this.setState({
      mouseDown: true,
      offsetX: this.state.posX - event.clientX,
      offsetY: this.state.posY - event.clientY
    });
  }

  handleMouseMove(event) {
    if (!this.props.fixed) {
      this.setState({
        posX: clamp(event.clientX + this.state.offsetX, 0, this.maxX()),
        posY: clamp(event.clientY + this.state.offsetY, 0, this.maxY())
      });
    }
  }

  handleMouseUp(event) {
    document.removeEventListener('mousemove', this.mouseMoveListener);
    document.removeEventListener('mouseup', this.mouseUpListener);

    this.setState({
      mouseDown: false,
      moved: false
    });
  }

  render() {
    return (
      <div className={`floatable ${this.props.className}`}
           style={{ left  : `${this.state.posX}px`,
                    top   : `${this.state.posY}px`,
                    cursor: this.state.mouseDown ? 'grabbing' : 'grab' }}
           onMouseDown={event => this.handleMouseDown(event)}
           onClick={this.props.onClick}>
        {this.props.children}
      </div>
    );
  }
}
