'use strict';

var I = require('immutable');


var _apply = function _apply(x, f) {
  return f(x);
};


var _pathPairs = function _pathPairs(s, t, eOut, eIn) {
  return I.fromJS([[], []]);
};


var _coercionPathPairs = function _coercionPathPairs(upcasts) {
  var _outEdges = upcasts.groupBy(function(e) { return e.get(0); });
  var _inEdges = upcasts.groupBy(function(e) { return e.get(1); });
  var _types = I.Set(_outEdges.keys());

  return I.Map(_types.map(function(s) {
    return [s, I.Map(_types.map(function(t) {
      return [t, _pathPairs(s, t, _outEdges, _inEdges)];
    }))];
  }));
};


var number = function number(promote, types, upcasts, downcasts) {
  var _methods = I.Map(I.fromJS(types).map(function(t) {
    return [t.get('type'), t];
  }));
  var _coercionMatrix = _coercionPathPairs(I.fromJS(upcasts));
  var _downcasts = I.Map(I.fromJS(downcasts));

  console.log(_coercionMatrix);

  var _num = function _num(n) {
    if (!!n && n.type)
      return n;
    else
      return promote(n);
  };

  var _coerce = function _coerce(a, b) {
    a = _num(a);
    b = _num(b);

    if (a.type == b.type)
      return [a, b];
    else {
      var paths = _coercionMatrix.getIn([a.type, b.type]);
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
      return _methods.get(n.type)[name](n);
    };
  };

  var _unary = function _unary(name) {
    var _f = _property(name);
    return function f(n) {
      return _downcast(_f(n));
    };
  };

  var _relation = function _unary(name) {
    return function f(a, b) {
      var t = _coerce(a, b);
      return _methods.get(t[0].type)[name](t[0], t[1]);
    };
  };

  var _binary = function _unary(name) {
    var _f = _relation(name);
    return function f(a, b) {
      return _downcast(_f(a, b));
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


if (require.main == module) {
  number(
    function() {}, // promote
    [], // types
    [[1,2,'a'],[1,3,'b'],[2,3,'c']], //upcasts
    [] // downcasts
  );
}
