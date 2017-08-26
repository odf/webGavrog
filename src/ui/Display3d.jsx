import * as THREE from 'three';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { matrices } from '../arithmetic/types';
const ops = matrices;


const rotation = function(dx, dy, aboutZ) {
  dx = Math.PI / 2 * dx;
  dy = Math.PI / 2 * dy;

  if (dx == 0 && dy == 0) {
    return [ [ 1, 0, 0 ],
             [ 0, 1, 0 ],
             [ 0, 0, 1 ] ];
  } else if (aboutZ) {
    const phi = (Math.abs(dx) > Math.abs(dy)) ? -dx : dy;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    return [ [  c,  s,  0 ],
             [ -s,  c,  0 ],
             [  0,  0,  1 ] ];
  } else {
    const phi = Math.sqrt(dx * dx + dy * dy);
    const s = Math.sin(phi);
    const c = Math.cos(phi);

    const vx = -dx / phi;
    const vy = -dy / phi;
    const vxx = vx * vx;
    const vxy = vx * vy;
    const vyy = vy * vy;

    return [ [    vyy + c*vxx, vxy * (c-1.0), s*vx ],
             [ -vxy * (c-1.0),   vxx + c*vyy, s*vy ],
             [           s*vy,         -s*vx,    c ] ];
  }
};


const orthonormalized = vs => {
  const out = [];
  for (let v of vs) {
    for (const w of out)
      v = ops.minus(v, ops.times(w, ops.times(v, w)))
    out.push(ops.div(v, ops.norm(v)));
  }
  return out;
};


const MODE = {
  ROTATE: 0,
  TILT  : 1,
  PAN   : 2
};


const defaultCameraParameters = {
  matrix  : ops.identityMatrix(3),
  distance: undefined,
  target  : ops.vector(3)
};


const newCameraParameters = function(params, dx, dy, button, wheel, pos) {
  const m = params.matrix;
  const d = params.distance;
  const t = params.target;

  if (pos) {
    return Object.assign({}, params, {
      distance: ops.norm(ops.minus(pos, ops.plus(t, ops.times(d, m[2])))),
      target  : pos
    });
  } else if (wheel) {
    return Object.assign({}, params, { distance: d * Math.pow(0.9, -wheel) });
  } else if (button == MODE.PAN) {
    return Object.assign({}, params, {
      target: ops.plus(t, ops.plus(ops.times(-0.2 * d * dx, m[0]),
                                   ops.times(-0.2 * d * dy, m[1]))) });
  } else {
    const rot = rotation(-dx, -dy, button == MODE.TILT);
    return Object.assign({}, params, {
      matrix: orthonormalized(ops.times(rot, params.matrix)) });
  }
};


const defaultDisplayState = {
  mouseDown        : false,
  mouseButton      : null,
  ndcX             : 0,
  ndcY             : 0,
  ndcOldX          : null,
  ndcOldY          : null,
  wheel            : 0,
  centeringPosition: null,
  cameraParameters : null,
  renderer         : null
};


const render3d = (function makeRender() {
  let _value;
  let _props;
  let _scheduled;
  let _intersected = null;
  const _raycaster = new THREE.Raycaster();
  const _mouse = new THREE.Vector2();

  const doRender = function doRender() {
    if (_value && _value.renderer) {
      const params = _value.cameraParameters;
      const m = params.matrix;
      const e = ops.plus(
        params.target,
        ops.times(params.distance, m[2]));

      _props.camera.position.x = e[0];
      _props.camera.position.y = e[1];
      _props.camera.position.z = e[2];

      const mat = new THREE.Matrix4();
      mat.set(
        m[0][0], m[1][0], m[2][0], 0,
        m[0][1], m[1][1], m[2][1], 0,
        m[0][2], m[1][2], m[2][2], 0,
        0,       0,       0, 1
      );

      _props.camera.quaternion.setFromRotationMatrix(mat);

      _value.renderer.setSize(_props.width, _props.height);
      _props.camera.aspect = _props.width / _props.height;
      _props.camera.updateProjectionMatrix();

      _mouse.x = _value.ndcX;
      _mouse.y = _value.ndcY;
      _raycaster.setFromCamera(_mouse, _props.camera);

      let newIntersected = null;

      if (_props.options.highlightPicked) {
        const intersects = _raycaster.intersectObjects(
          _props.scene.children, true);

        let i = 0;
        while (i < intersects.length && intersects[i].object.isLineSegments)
          ++i;

        if (i < intersects.length)
          newIntersected = intersects[i].object;
      }

      if (newIntersected != _intersected) {
	if (_intersected)
          _intersected.material.emissive.setHex(_intersected.currentHex);

	_intersected = newIntersected;

        if (_intersected) {
	  _intersected.currentHex = _intersected.material.emissive.getHex();
	  _intersected.material.emissive.setHex(0xff0000);
        }
      }

      _value.renderer.render(_props.scene, _props.camera);
      _scheduled = false;
    }
  };

  requestAnimationFrame(doRender);

  return function update(value, props) {
    _value = value;
    _props = props;

    if (!_scheduled)
      requestAnimationFrame(doRender);

    _scheduled = true;
  };
})();


export default class Display3d extends React.Component {
  constructor() {
    super();
    this.state = {
      value: Object.assign({}, defaultDisplayState)
    };
  }

  update(mods) {
    this.setState((state, props) => {
      const value = Object.assign({}, state.value, mods);

      const params = newCameraParameters(
        value.cameraParameters || Object.assign(
          {}, defaultCameraParameters, props.cameraParameters),
        value.ndcOldX == null ? 0 : value.ndcX - value.ndcOldX,
        value.ndcOldY == null ? 0 : value.ndcY - value.ndcOldY,
        value.mouseButton,
        value.wheel,
        value.centeringPosition
      );

      if (mods.matrix)
        params.matrix = mods.matrix;

      return {
        value: Object.assign({}, value, {
          ndcOldX: value.mouseDown ? value.ndcX : null,
          ndcOldY: value.mouseDown ? value.ndcY : null,
          wheel: 0,
          centeringPosition: null,
          cameraParameters: params
        })
      };
    });
  }

  center() {
    this.update({
      centeringPosition: [0,0,0]
    });
  }

  viewAlongX() {
    this.update({
      matrix: [[ 0, 0, 1],
               [ 0, 1, 0],
               [-1, 0, 0]]
    });
  }

  viewAlongY() {
    this.update({
      matrix: [[1,  0, 0],
               [0,  0, 1],
               [0, -1, 0]]
    });
  }

  viewAlongZ() {
    this.update({
      matrix: [[1, 0, 0],
               [0, 1, 0],
               [0, 0, 1]]
    });
  }

  preventDefault(event) {
    event.preventDefault();
  }

  componentDidMount() {
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.id = 'main-3d-canvas';
    ReactDOM.findDOMNode(this).appendChild(canvas);

    renderer.domElement.addEventListener(
      'contextmenu', event => this.preventDefault(event));

    this.update({
      renderer: renderer,
    });
  }

  componentWillUnmount() {
    renderer.domElement.removeEventListener(
      'contextmenu', event => this.preventDefault(event));
  }

  handleMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();

    this.mouseMoveListener = event => this.handleMouseMove(event);
    this.mouseUpListener = event => this.handleMouseUp(event);

    document.addEventListener('mousemove', this.mouseMoveListener, false);
    document.addEventListener('mouseup', this.mouseUpListener, false);

    this.update({
      mouseDown  : true,
      mouseButton: event.button,
      ndcOldX    : 2 * (event.clientX / this.props.width) - 1,
      ndcOldY    : 1 - 2 * (event.clientY / this.props.height)
    });
  }

  handleMouseMove(event) {
    event.preventDefault();
    event.stopPropagation();

    this.update({
      ndcX: 2 * (event.clientX / this.props.width) - 1,
      ndcY: 1 - 2 * (event.clientY / this.props.height)
    });
  }

  handleMouseUp(event) {
    event.preventDefault();
    event.stopPropagation();

    document.removeEventListener('mousemove', this.mouseMoveListener);
    document.removeEventListener('mouseup', this.mouseUpListener);

    this.update({
      mouseDown: false
    });
  }

  handleClick(event) {
    this.refs.container.focus();
  }

  handleWheel(event) {
    let d = ops.sgn(event.deltaY);

    this.update({
      wheel: this.state.value.wheel + d
    });
  }

  handleKeyDown(event) {
    const key = String.fromCharCode(event.keyCode).toLowerCase();

    if (key == 'c') {
      event.preventDefault();
      event.stopPropagation();

      this.center();
    } else {
      const fn = (this.props.keyHandlers || {})[key];
      if (fn) {
        event.preventDefault();
        event.stopPropagation();

        fn(event);
      }
    }
  }

  render() {
    render3d(this.state.value, this.props);

    return (
      <div className   = {this.props.className}
           style       = {{ outline: 'none' }}
           ref         = "container"
           tabIndex    = {0}
           onMouseDown = {event => this.handleMouseDown(event)}
           onMouseMove = {event => this.handleMouseMove(event)}
           onMouseUp   = {event => this.handleMouseUp(event)}
           onClick     = {event => this.handleClick(event)}
           onWheel     = {event => this.handleWheel(event)}
           onKeyDown   = {event => this.handleKeyDown(event)}>
      </div>
    );
  }
}
