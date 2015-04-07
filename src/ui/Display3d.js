'use strict';

var THREE = require('three');
var React = require('react');
var I     = require('immutable');

var R     = require('../arithmetic/float');
var M     = require('../arithmetic/matrix')(R, 0, 1);
var vec   = require('../arithmetic/vector')(R, 0);


var rotate = function(m, xrot, yrot, aboutZ) {
  var phi, s, c, t, n, vx, vy, vxx, vyy, vxy, a, b;

  if (aboutZ) {
    phi = (Math.abs(xrot) > Math.abs(yrot)) ? -xrot : yrot;
    s = Math.sin(phi);
    c = Math.cos(phi);
    a = M.make([ [  c,  s,  0 ],
                 [ -s,  c,  0 ],
                 [  0,  0,  1 ] ]);
  } else {
    phi = Math.sqrt(xrot * xrot + yrot * yrot);
    if (phi == 0)
      return m;

    s = Math.sin(phi);
    c = Math.cos(phi);

    vx = -xrot / phi;
    vy = -yrot / phi;
    vxx = vx * vx;
    vxy = vx * vy;
    vyy = vy * vy;

    a = M.make([ [    vyy + c*vxx, vxy * (c-1.0), s*vx ],
                 [ -vxy * (c-1.0),   vxx + c*vyy, s*vy ],
                 [           s*vy,         -s*vx,    c ] ]);
  }

  return M.orthonormalized(M.times(a, m));
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


var updateCameraParameters = function(params, dx, dy, button, wheel, pos) {
  var m = params.matrix.data.map(vec.make);
  var d = params.distance;
  var t = params.target;

  if (pos) {
    return params.update({
      distance: vec.norm(vec.minus(pos, vec.plus(t, vec.scaled(d, m.get(2))))),
      target  : vec.make(pos)
    });
  } else if (wheel) {
    return params.set('distance', d * Math.pow(0.9, -wheel))
  } else if (button == MODE.PAN) {
    return params.set(
      'target',
      vec.plus(t, vec.scaled(-0.2 * d,
                             vec.plus(vec.scaled(dx, m.get(0)),
                                      vec.scaled(dy, m.get(1))))));
  } else {
    return params.set(
      'matrix',
      rotate(params.matrix, -dx, -dy, button == MODE.TILT));
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


var Display3d = React.createClass({
  displayName: 'Display3d',

  getInitialState: function() {
    return {
      value: new DisplayState()
    };
  },

  updateCamera: function(mods) {
    this.setState(function(state, props) {
      var value = state.value.merge(mods);
      if (!value.cameraParameters)
        value = value.set(
          'cameraParameters',
          new CameraParameters(props.cameraParameters));

      var params = updateCameraParameters(
        value.cameraParameters,
        value.ndcX - value.ndcOldX,
        value.ndcY - value.ndcOldY,
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

  update: function(props) {
    if (!this.state.value.cameraParameters ||
        props.camera != this.props.camera)
    {
      this.updateCamera({
        cameraParameters: new CameraParameters(props.cameraParameters)
      });
    }
  },

  componentWillReceiveProps: function(props) {
    this.update(props);
  },

  componentDidMount: function() {
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    this.getDOMNode().appendChild(renderer.domElement);

    renderer.domElement.addEventListener('contextmenu', function (event) {
      event.preventDefault();
    });

    this.updateCamera({
      renderer: renderer,
    });

    this.update(this.props, renderer);
  },

  handleMouseDown: function(event) {
    event.preventDefault();
    event.stopPropagation();

    document.addEventListener('mousemove', this.handleMouseMove, false);
    document.addEventListener('mouseup', this.handleMouseUp, false);

    this.updateCamera({
      mouseDown  : true,
      mouseButton: event.button,
      ndcOldX    : 2 * (event.clientX / this.props.width) - 1,
      ndcOldY    : 1 - 2 * (event.clientY / this.props.height)
    });
  },

  handleMouseMove: function(event) {
    event.preventDefault();
    event.stopPropagation();

    this.updateCamera({
      ndcX: 2 * (event.clientX / this.props.width) - 1,
      ndcY: 1 - 2 * (event.clientY / this.props.height)
    });
  },

  handleMouseUp: function(event) {
    event.preventDefault();
    event.stopPropagation();

    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);

    this.updateCamera({
      mouseDown: false
    });
  },

  handleMouseEnter: function(event) {
    this.refs.container.getDOMNode().focus();
  },

  handleWheel: function(event) {
    var d = event.deltaY;
    d = (d > 0) - (d < 0);

    this.updateCamera({
      wheel: this.state.value.wheel + d
    });
  },

  handleKeyDown: function(event) {
    event.preventDefault();
    event.stopPropagation();

    var key = String.fromCharCode(event.keyCode).toLowerCase();

    if (key == 'c') {
      this.updateCamera({
        centeringPosition: this.state.value.pickedPosition || [0,0,0]
      });
    } else {
      var fn = (this.props.keyHandlers || {})[key];
      if (fn)
        fn(event);
    }
  },

  render3d: function() {
    var renderer = this.state.value.renderer;

    if (renderer) {
      var params = this.state.value.cameraParameters;
      var m = params.matrix.data.toJS();
      var e = vec.plus(
        params.target,
        vec.scaled(params.distance, vec.make(m[2])));

      this.props.camera.position.x = vec.get(e, 0);
      this.props.camera.position.y = vec.get(e, 1);
      this.props.camera.position.z = vec.get(e, 2);

      var mat = new THREE.Matrix4();
      mat.set(
        m[0][0], m[1][0], m[2][0], 0,
        m[0][1], m[1][1], m[2][1], 0,
        m[0][2], m[1][2], m[2][2], 0,
        0,       0,       0, 1
      );

      this.props.camera.quaternion.setFromRotationMatrix(mat);

      renderer.setSize(this.props.width, this.props.height);
      this.props.camera.aspect = this.props.width / this.props.height;
      this.props.camera.updateProjectionMatrix();

      renderer.render(this.props.scene, this.props.camera);
    }
  },

  render: function() {
    this.render3d();

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
