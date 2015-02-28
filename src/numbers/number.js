'use strict';

var I = require('immutable');


var _allJoiningPathPairs = function _allJoiningPathPairs(upcasts) {
  // TODO implement this
};


var number = function number(promote, types, upcasts, downcasts) {
  var _methods = I.Map(I.fromJS(types).map(function(t) {
    return [t.get('type'), t];
  }));
  var _upcastMatrix = _allJoiningPathPairs(I.fromJS(upcasts));
  var _downcasts = I.Map(I.fromJS(downcasts));

  var _apply = function _apply(x, f) {
    return f(x);
  };

  var _num = function _num(n) {
    if (!!n && n.type)
      return n;
    else
      return promote(n);
  };

  var _upcast = function _upcast(a, b) {
    a = _num(a);
    b = _num(b);

    if (a.type == b.type)
      return [a, b];
    else {
      var paths = _upcastMatrix.getIn([a.type, b.type]);
      return [paths[0].reduce(_apply, a), paths[1].reduce(_apply, b)];
    }
  };

  var _downcast = function _downcast(n) {
    var f = _downcasts.get(n.type);
    return f ? f(n) : n;
  };

  var _property = function _property(name) {
    return function f(n) {
      n = _num(n);
      return n.type[name](n);
    };
  };

  var _unary = function _unary(name) {
    return function f(n) {
      n = _num(n);
      return _downcast(n.type[name](n));
    };
  };

  var _relation = function _unary(name) {
    return function f(a, b) {
      var t = _upcast(a, b);
      return t[0].type[name](t[0], t[1]);
    };
  };

  var _binary = function _unary(name) {
    return function f(a, b) {
      var t = _upcast(a, b);
      return _downcast(t[0].type[name](t[0], t[1]));
    };
  };

  var toString = _property('toString');
  var sgn      = _property('sgn');
  var isEven   = _property('isEven');

  var negative = _unary('negative');
  var abs      = _unary('abs');

  var cmp      = _relation('cmp');

  var plus     = _binary('plus');
  var minus    = _binary('minus');
  var times    = _binary('times');
  var idiv     = _binary('idiv');
  var mod      = _binary('mod');
};
