import * as THREE from 'three';
import * as React from 'react';
import * as I     from 'immutable';

import * as R from '../arithmetic/float';
import _M from '../arithmetic/matrix';
import _V from '../arithmetic/vector';

const M = _M(R, 0, 1);
const vec = _V(R, 0);


const sgn = x => (x > 0) - (x < 0);


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


const MODE = {
  ROTATE: 0,
  TILT  : 1,
  PAN   : 2
};


const CameraParameters = I.Record({
  matrix  : M.identity(3),
  distance: undefined,
  target  : vec.constant(3)
});


const newCameraParameters = function(params, dx, dy, button, wheel, pos) {
  const m = params.matrix.data.map(vec.make);
  const d = params.distance;
  const t = params.target;

  if (pos) {
    pos = vec.make(pos);
    return params.merge({
      distance: vec.norm(vec.minus(pos, vec.plus(t, vec.scaled(d, m[2])))),
      target  : pos
    });
  } else if (wheel) {
    return params.set('distance', d * Math.pow(0.9, -wheel))
  } else if (button == MODE.PAN) {
    return params.set(
      'target',
      vec.plus(t, vec.plus(vec.scaled(-0.2 * d * dx, m[0]),
                           vec.scaled(-0.2 * d * dy, m[1]))));
  } else {
    const rot = M.make(rotation(-dx, -dy, button == MODE.TILT));
    return params.set('matrix', M.orthonormalized(M.times(rot, params.matrix)));
  }
};


const DisplayState = I.Record({
  mouseDown        : false,
  mouseButton      : null,
  ndcX             : 0,
  ndcY             : 0,
  ndcOldX          : null,
  ndcOldY          : null,
  wheel            : 0,
  centeringPosition: null,
  pickedPosition   : null,
  cameraParameters : null,
  renderer         : null
});


const render3d = (function makeRender() {
  let _value;
  let _props;
  let _scheduled;

  const doRender = function doRender() {
    if (_value && _value.renderer) {
      const params = _value.cameraParameters;
      const m = params.matrix.data;
      const e = vec.plus(
        params.target,
        vec.scaled(params.distance, vec.make(m[2])));

      _props.camera.position.x = vec.get(e, 0);
      _props.camera.position.y = vec.get(e, 1);
      _props.camera.position.z = vec.get(e, 2);

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


export default React.createClass({
  displayName: 'Display3d',

  getInitialState() {
    return {
      value: new DisplayState()
    };
  },

  update(mods) {
    this.setState(function(state, props) {
      const value = state.value.merge(mods);

      const params = newCameraParameters(
        value.cameraParameters || new CameraParameters(props.cameraParameters),
        value.ndcOldX == null ? 0 : value.ndcX - value.ndcOldX,
        value.ndcOldY == null ? 0 : value.ndcY - value.ndcOldY,
        value.mouseButton,
        value.wheel,
        value.centeringPosition
      );

      return {
        value: value.merge({
          ndcOldX: value.mouseDown ? value.ndcX : null,
          ndcOldY: value.mouseDown ? value.ndcY : null,
          wheel: 0,
          centeringPosition: null,
          cameraParameters: params
        })
      };
    });
  },

  preventDefault(event) {
    event.preventDefault();
  },

  componentDidMount() {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    React.findDOMNode(this).appendChild(canvas);

    renderer.domElement.addEventListener('contextmenu', this.preventDefault);

    this.update({
      renderer: renderer,
    });
  },

  componentWillUnmount() {
    renderer.domElement.removeEventListener('contextmenu', this.preventDefault);
  },

  handleMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();

    document.addEventListener('mousemove', this.handleMouseMove, false);
    document.addEventListener('mouseup', this.handleMouseUp, false);

    this.update({
      mouseDown  : true,
      mouseButton: event.button,
      ndcOldX    : 2 * (event.clientX / this.props.width) - 1,
      ndcOldY    : 1 - 2 * (event.clientY / this.props.height)
    });
  },

  handleMouseMove(event) {
    event.preventDefault();
    event.stopPropagation();

    this.update({
      ndcX: 2 * (event.clientX / this.props.width) - 1,
      ndcY: 1 - 2 * (event.clientY / this.props.height)
    });
  },

  handleMouseUp(event) {
    event.preventDefault();
    event.stopPropagation();

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);

    this.update({
      mouseDown: false
    });
  },

  handleMouseEnter(event) {
    React.findDOMNode(this.refs.container).focus();
  },

  handleWheel(event) {
    let d = sgn(event.deltaY);

    this.update({
      wheel: this.state.value.wheel + d
    });
  },

  handleKeyDown(event) {
    event.preventDefault();
    event.stopPropagation();

    const key = String.fromCharCode(event.keyCode).toLowerCase();

    if (key == 'c') {
      this.update({
        centeringPosition: this.state.value.pickedPosition || [0,0,0]
      });
    } else {
      const fn = (this.props.keyHandlers || {})[key];
      if (fn)
        fn(event);
    }
  },

  render() {
    render3d(this.state.value, this.props);

    return React.DOM.div({
      className   : this.props.className,
      style       : { outline: 'none' },
      ref         : 'container',
      tabIndex    : 0,
      onMouseDown : this.handleMouseDown,
      onMouseMove : this.handleMouseMove,
      onMouseUp   : this.handleMouseUp,
      onMouseEnter: this.handleMouseEnter,
      onWheel     : this.handleWheel,
      onKeyDown   : this.handleKeyDown
    });
  }
});
