'use strict';

var THREE = require('three');
var React = require('react');
var I     = require('immutable');

var R     = require('../arithmetic/float');
var M     = require('../arithmetic/matrix')(R, 0, 1);
var vec   = require('../arithmetic/vector')(R, 0);


var rotation = function(dx, dy, aboutZ) {
  var phi, s, c, vx, vy, vxx, vyy, vxy;

  dx = Math.PI / 2 * dx;
  dy = Math.PI / 2 * dy;

  if (dx == 0 && dy == 0) {
    return [ [ 1, 0, 0 ],
             [ 0, 1, 0 ],
             [ 0, 0, 1 ] ];
  } else if (aboutZ) {
    phi = (Math.abs(dx) > Math.abs(dy)) ? -dx : dy;
    s = Math.sin(phi);
    c = Math.cos(phi);
    return [ [  c,  s,  0 ],
             [ -s,  c,  0 ],
             [  0,  0,  1 ] ];
  } else {
    phi = Math.sqrt(dx * dx + dy * dy);
    s = Math.sin(phi);
    c = Math.cos(phi);

    vx = -dx / phi;
    vy = -dy / phi;
    vxx = vx * vx;
    vxy = vx * vy;
    vyy = vy * vy;

    return [ [    vyy + c*vxx, vxy * (c-1.0), s*vx ],
             [ -vxy * (c-1.0),   vxx + c*vyy, s*vy ],
             [           s*vy,         -s*vx,    c ] ];
  }
};


var MODE = {
  ROTATE: 0,
  TILT  : 1,
  PAN   : 2
};


var CameraParameters = I.Record({
  matrix  : M.identity(3),
  distance: undefined,
  target  : vec.constant(3)
});


var newCameraParameters = function(params, dx, dy, button, wheel, pos) {
  var m = params.matrix.data.map(vec.make);
  var d = params.distance;
  var t = params.target;

  if (pos) {
    pos = vec.make(pos);
    return params.merge({
      distance: vec.norm(vec.minus(pos, vec.plus(t, vec.scaled(d, m.get(2))))),
      target  : pos
    });
  } else if (wheel) {
    return params.set('distance', d * Math.pow(0.9, -wheel))
  } else if (button == MODE.PAN) {
    return params.set(
      'target',
      vec.plus(t, vec.plus(vec.scaled(-0.2 * d * dx, m.get(0)),
                           vec.scaled(-0.2 * d * dy, m.get(1)))));
  } else {
    var rot = M.make(rotation(-dx, -dy, button == MODE.TILT));
    return params.set('matrix', M.orthonormalized(M.times(rot, params.matrix)));
  }
};


var DisplayState = I.Record({
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


var render3d = (function makeRender() {
  var _value;
  var _props;
  var _scheduled;

  var doRender = function doRender() {
    if (_value.renderer) {
      var params = _value.cameraParameters;
      var m = params.matrix.data.toJS();
      var e = vec.plus(
        params.target,
        vec.scaled(params.distance, vec.make(m[2])));

      _props.camera.position.x = vec.get(e, 0);
      _props.camera.position.y = vec.get(e, 1);
      _props.camera.position.z = vec.get(e, 2);

      var mat = new THREE.Matrix4();
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


var Display3d = React.createClass({
  displayName: 'Display3d',

  getInitialState: function() {
    return {
      value: new DisplayState()
    };
  },

  update: function(mods) {
    this.setState(function(state, props) {
      var value = state.value.merge(mods);

      var params = newCameraParameters(
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

  preventDefault: function(event) {
    event.preventDefault();
  },

  componentDidMount: function() {
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    this.getDOMNode().appendChild(renderer.domElement);

    renderer.domElement.addEventListener('contextmenu', this.preventDefault);

    this.update({
      renderer: renderer,
    });
  },

  componentWillUnmount: function() {
    renderer.domElement.removeEventListener('contextmenu', this.preventDefault);
  },

  handleMouseDown: function(event) {
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

  handleMouseMove: function(event) {
    event.preventDefault();
    event.stopPropagation();

    this.update({
      ndcX: 2 * (event.clientX / this.props.width) - 1,
      ndcY: 1 - 2 * (event.clientY / this.props.height)
    });
  },

  handleMouseUp: function(event) {
    event.preventDefault();
    event.stopPropagation();

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);

    this.update({
      mouseDown: false
    });
  },

  handleMouseEnter: function(event) {
    this.refs.container.getDOMNode().focus();
  },

  handleWheel: function(event) {
    var d = event.deltaY;
    d = (d > 0) - (d < 0);

    this.update({
      wheel: this.state.value.wheel + d
    });
  },

  handleKeyDown: function(event) {
    event.preventDefault();
    event.stopPropagation();

    var key = String.fromCharCode(event.keyCode).toLowerCase();

    if (key == 'c') {
      this.update({
        centeringPosition: this.state.value.pickedPosition || [0,0,0]
      });
    } else {
      var fn = (this.props.keyHandlers || {})[key];
      if (fn)
        fn(event);
    }
  },

  render: function() {
    render3d(this.state.value, this.props);

    return React.DOM.div({
      className   : this.props.className,
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


module.exports = Display3d;
