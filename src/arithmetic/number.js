'use strict';

var I = require('immutable');


var _apply = function _apply(x, f) {
  return f(x);
};


var _operationPath = function _operationPath(t, op, eOut, methods) {
  if (methods.get(t)[op])
    return;

  var q = I.List([t]);
  var backEdge = I.Map();

  while (!q.isEmpty()) {
    var v = q.first();
    q = q.rest();

    var next = eOut.get(v);

    if (next) {
      var e = next.find(function(e) {
        return !!methods.get(e.get(1))[op];
      });

      if (e) {
        return I.List([e.get(2)]).withMutations(function(list) {
          while (backEdge.get(v)) {
            var e = backEdge.get(v);
            list.unshift(e.get(2));
            v = e.get(0);
          }
        }).reverse();
      } else {
        next
          .filter(function(e) {
            return !backEdge.get(e.get(1));
          })
          .forEach(function(e) {
            var w = e.get(1);
            q = q.push(w);
            backEdge = backEdge.set(w, e);
          });
      }
    }
  };
};


var _operationUpcastPaths = function _coercionPathPairs(upcasts, methods) {
  var _outEdges = upcasts.groupBy(function(e) { return e.get(0); });
  var _inEdges = upcasts.groupBy(function(e) { return e.get(1); });
  var _types = I.Set(_outEdges.keySeq().concat(_inEdges.keySeq()));

  var _ops = methods.reduce(
    function(s, ops) {
      return s.union(Object.keys(ops));
    },
    I.Set());

  return I.Map(_types.map(function(t) {
    return [t, I.Map(_ops.map(function(op) {
      return [op, _operationPath(t, op, _outEdges, methods) || []];
    }))];
  }));
};


var _joiningPathPair = function _joiningPathPair(s, t, eOut, eIn) {
  if (s == t)
    return I.fromJS([[],[]]);

  var qs = I.List([s]);
  var qt = I.List([t]);
  var seenFrom = I.Map([[s, s], [t, t]]);
  var backEdge = I.Map();

  var _step = function _step(queue, thisStart, otherStart) {
    var v = queue.first();
    queue = queue.rest();

    var next = eOut.get(v);

    if (next) {
      var e = next.find(function(e) {
        return seenFrom.get(e.get(1)) == otherStart;
      });

      if (e)
        return { bridge: e };
      else
        next
        .filter(function(e) { return !seenFrom.get(e.get(1)); })
        .forEach(function(e) {
          var v = e.get(1);
          queue = queue.push(v);
          seenFrom = seenFrom.set(v, thisStart);
          backEdge = backEdge.set(v, e);
        });
    }

    return { queue: queue };
  };

  var _trace = function _trace(v) {
    return I.List().withMutations(function(list) {
      while (backEdge.get(v)) {
        var e = backEdge.get(v);
        list.unshift(e.get(2));
        v = e.get(0);
      }
    });
  };

  var _tracePaths = function _tracePaths(bridge) {
    return I.List([_trace(bridge.get(0)).push(bridge.get(2)),
                   _trace(bridge.get(1))]);
  };

  var tmp;

  while (!(qs.isEmpty() && qt.isEmpty())) {
    if (!qs.isEmpty()) {
      tmp = _step(qs, s, t);
      if (tmp.bridge)
        return _tracePaths(tmp.bridge);
      else
        qs = tmp.queue;
    }
    if (!qt.isEmpty()) {
      tmp = _step(qt, t, s);
      if (tmp.bridge)
        return _tracePaths(tmp.bridge).reverse();
      else
        qt = tmp.queue;
    }
  }
};


var _coercionPathPairs = function _coercionPathPairs(upcasts) {
  var _outEdges = upcasts.groupBy(function(e) { return e.get(0); });
  var _inEdges = upcasts.groupBy(function(e) { return e.get(1); });
  var _types = I.Set(_outEdges.keySeq().concat(_inEdges.keySeq()));

  return I.Map(_types.map(function(s) {
    return [s, I.Map(_types.map(function(t) {
      return [t, _joiningPathPair(s, t, _outEdges, _inEdges)];
    }))];
  }));
};


var number = function number(spec) {
  var _methods = I.Map(spec.types.map(function(t) {
    return [t.type, t];
  }));
  var _coercionMatrix = _coercionPathPairs(I.fromJS(spec.upcasts));
  var _downcasts = I.Map(I.fromJS(spec.downcasts).toJS());
  var _upcastPaths = _operationUpcastPaths(I.fromJS(spec.upcasts), _methods);

  var _type = function _type(n) {
    if (n != null && _methods.get(n.constructor))
      return n.constructor;
  };

  var _num = function _num(n) {
    if (_type(n))
      return n;
    else
      return spec.promote(n);
  };

  var _coerce = function _coerce(a, b) {
    a = _num(a);
    b = _num(b);

    if (_type(a) == _type(b))
      return [a, b];
    else {
      var paths = _coercionMatrix.getIn([_type(a), _type(b)]);
      return [paths.get(0).reduce(_apply, a), paths.get(1).reduce(_apply, b)];
    }
  };

  var _upcast = function _upcast(n, op) {
    n = _num(n);
    return _upcastPaths.getIn([_type(n), op]).reduce(_apply, n);
  };

  var _downcast = function _downcast(n) {
    var f = _downcasts.get(_type(n));
    if (!f)
      return n;
    else {
      var val = f(n);
      return _type(val) == _type(n) ? val : _downcast(val);
    }
  };

  var _property = function _property(name) {
    return function f(n) {
      n = _upcast(n, name);
      return _methods.get(_type(n))[name](n);
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
      var a = _upcast(t[0], name);
      var b = _upcast(t[1], name);
      return _methods.get(_type(a))[name](a, b);
    };
  };

  var _binary = function _unary(name) {
    var _f = _relation(name);
    return function f(a, b) {
      return _downcast(_f(a, b));
    };
  };

  var toJS     = _property('toJS');
  var sgn      = _property('sgn');
  var isEven   = _property('isEven');

  var negative = _unary('negative');
  var abs      = _unary('abs');
  var inverse  = _unary('inverse');

  var cmp      = _relation('cmp');

  var plus     = _binary('plus');
  var minus    = _binary('minus');
  var times    = _binary('times');
  var div      = _binary('div');
  var idiv     = _binary('idiv');
  var mod      = _binary('mod');

  return {
    toJS    : toJS,
    sgn     : sgn,
    isEven  : isEven,
    negative: negative,
    abs     : abs,
    inverse : inverse,
    cmp     : cmp,
    plus    : plus,
    minus   : minus,
    times   : times,
    div     : div,
    idiv    : idiv,
    mod     : mod
  };
};


var longInt    = require('./longInt')();
var checkedInt = require('./checkedInt')();

var promoteToInt = function(n) {
  if (typeof n == 'string')
    return longInt.parse(n);
  else if (typeof n == 'number' && n % 1 == 0)
    return checkedInt.promote(n);
  else
    throw new Error('value '+n+' cannot be cast to a number');
};


var integer = number({
  promote: promoteToInt,

  types: [checkedInt, longInt],

  upcasts: [
    [checkedInt.type, longInt.type, function(n) {
      return longInt.promote(checkedInt.toJS(n));
    }]
  ],

  downcasts: [
    [longInt.type, function(n) {
      if (checkedInt.canDowncast(n))
        return checkedInt.promote(longInt.toJS(n));
      else
        return n;
    }]
  ]
});


var fraction = require('./fraction')(integer, promoteToInt);


var rational = number({
  promote: promoteToInt,

  types: [checkedInt, longInt, fraction],

  upcasts: [
    [checkedInt.type, longInt.type, function(n) {
      return longInt.promote(checkedInt.toJS(n));
    }],
    [checkedInt.type, fraction.type, fraction.promote],
    [longInt.type, fraction.type, fraction.promote]
  ],

  downcasts: [
    [longInt.type, function(n) {
      if (checkedInt.canDowncast(n))
        return checkedInt.promote(longInt.toJS(n));
      else
        return n;
    }],
    [fraction.type, function(q) {
      var n = fraction.asInteger(q);
      if (n !== undefined)
        return n;
      else
        return q;
    }]
  ]
});


module.exports = rational;


if (require.main == module) {
  var num = module.exports;

  var t = 1;
  for (var i = 1; i < 50; ++i)
    t = num.times(t, i);
  console.log(t);
  for (var i = 1; i < 50; ++i)
    t = num.idiv(t, i);
  console.log(t);
  console.log(num.idiv('111111111', '12345679'));

  var t = 0;
  var q = 1;
  for (var i = 0; i < 128; ++i) {
    q = num.div(q, 2);
    t = num.plus(t, q);
  }
  console.log(t);
  console.log(num.plus(t, q));

  console.log(num.div('18645978973801', '9991365345280000250718715904'));
}
