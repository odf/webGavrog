import * as I from 'immutable';


const _apply = (x, f) => f(x);


const _operationPath = function _operationPath(t, op, eOut, methods) {
  if (methods.get(t)[op])
    return;

  let q = I.List([t]);
  let backEdge = I.Map();

  while (!q.isEmpty()) {
    let v = q.first();
    q = q.rest();

    const next = eOut.get(v);

    if (next) {
      const e = next.find(e => !!methods.get(e.get(1))[op]);

      if (e) {
        return I.List([e.get(2)]).withMutations(function(list) {
          while (backEdge.get(v)) {
            const e = backEdge.get(v);
            list.unshift(e.get(2));
            v = e.get(0);
          }
        }).reverse();
      } else {
        next
          .filter(e => !backEdge.get(e.get(1)))
          .forEach(function(e) {
            const w = e.get(1);
            q = q.push(w);
            backEdge = backEdge.set(w, e);
          });
      }
    }
  };
};


const _operationUpcastPaths = function _coercionPathPairs(upcasts, methods) {
  const _outEdges = upcasts.groupBy(e => e.get(0));
  const _inEdges  = upcasts.groupBy(e => e.get(1));
  const _types    = I.Set(_outEdges.keySeq().concat(_inEdges.keySeq()));

  const _ops  = methods.reduce((s, o) => s.union(Object.keys(o)), I.Set());
  const _path = (t, op) => _operationPath(t, op, _outEdges, methods) || [];

  return I.Map(_types.map(t => [t, I.Map(_ops.map(op => [op, _path(t, op)]))]));
};


const _joiningPathPair = function _joiningPathPair(s, t, eOut, eIn) {
  if (s == t)
    return I.fromJS([[],[]]);

  let qs = I.List([s]);
  let qt = I.List([t]);
  let seenFrom = I.Map([[s, s], [t, t]]);
  let backEdge = I.Map();

  const _step = function _step(queue, thisStart, otherStart) {
    const v = queue.first();
    queue = queue.rest();

    const next = eOut.get(v);

    if (next) {
      const e = next.find(e => seenFrom.get(e.get(1)) == otherStart);

      if (e)
        return { bridge: e };
      else
        next
        .filter(e => !seenFrom.get(e.get(1)))
        .forEach(function(e) {
          const v = e.get(1);
          queue = queue.push(v);
          seenFrom = seenFrom.set(v, thisStart);
          backEdge = backEdge.set(v, e);
        });
    }

    return { queue };
  };

  const _trace = function _trace(v) {
    return I.List().withMutations(function(list) {
      while (backEdge.get(v)) {
        const e = backEdge.get(v);
        list.unshift(e.get(2));
        v = e.get(0);
      }
    });
  };

  const _tracePaths = function _tracePaths(bridge) {
    return I.List([_trace(bridge.get(0)).push(bridge.get(2)),
                   _trace(bridge.get(1))]);
  };

  let tmp;

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


const _coercionPathPairs = function _coercionPathPairs(upcasts) {
  const _outEdges = upcasts.groupBy(e => e.get(0));
  const _inEdges  = upcasts.groupBy(e => e.get(1));
  const _types    = I.Set(_outEdges.keySeq().concat(_inEdges.keySeq()));

  const _paths = (s, t) => _joiningPathPair(s, t, _outEdges, _inEdges);

  return I.Map(_types.map(s => [s, I.Map(_types.map(t => [t, _paths(s, t)]))]));
};


const number = function number(spec) {
  const _methods = I.Map(spec.types.map(t => [t.type, t]));
  const _coercionMatrix = _coercionPathPairs(I.fromJS(spec.upcasts));
  const _downcasts = I.Map(I.fromJS(spec.downcasts).toJS());
  const _upcastPaths = _operationUpcastPaths(I.fromJS(spec.upcasts), _methods);

  const _type = function _type(n) {
    if (n != null && _methods.get(n.constructor))
      return n.constructor;
  };

  const _num = n => _type(n) ? n : spec.promote(n);

  const _coerce = function _coerce(a, b) {
    a = _num(a);
    b = _num(b);

    if (_type(a) == _type(b))
      return [a, b];
    else {
      const paths = _coercionMatrix.getIn([_type(a), _type(b)]);
      return [paths.get(0).reduce(_apply, a), paths.get(1).reduce(_apply, b)];
    }
  };

  const _upcast = function _upcast(n, op) {
    n = _num(n);
    return _upcastPaths.getIn([_type(n), op]).reduce(_apply, n);
  };

  const _downcast = function _downcast(n) {
    const f = _downcasts.get(_type(n));
    if (!f)
      return n;
    else {
      const val = f(n);
      return _type(val) == _type(n) ? val : _downcast(val);
    }
  };

  const _property = function _property(name) {
    return function f(n) {
      n = _upcast(n, name);
      return _methods.get(_type(n))[name](n);
    };
  };

  const _unary = function _unary(name) {
    const _f = _property(name);
    return n => _downcast(_f(n));
  };

  const _relation = function _unary(name) {
    return function f(a, b) {
      const t  = _coerce(a, b);
      const au = _upcast(t[0], name);
      const bu = _upcast(t[1], name);
      return _methods.get(_type(au))[name](au, bu);
    };
  };

  const _binary = function _unary(name) {
    const _f = _relation(name);
    return (a, b) => _downcast(_f(a, b));
  };

  return {
    toJS    : _property('toJS'),
    sgn     : _property('sgn'),
    isEven  : _property('isEven'),

    negative: _unary('negative'),
    abs     : _unary('abs'),
    inverse : _unary('inverse'),

    cmp     : _relation('cmp'),

    plus    : _binary('plus'),
    minus   : _binary('minus'),
    times   : _binary('times'),
    div     : _binary('div'),
    idiv    : _binary('idiv'),
    mod     : _binary('mod')
  };
};


const longInt    = require('./longInt')();
const checkedInt = require('./checkedInt')(longInt);

const promoteToInt = function(n) {
  if (typeof n == 'string')
    return longInt.parse(n);
  else if (typeof n == 'number' && n % 1 == 0)
    return checkedInt.promote(n);
  else
    throw new Error('value '+n+' cannot be cast to a number');
};


const integer = number({
  promote: promoteToInt,

  types: [checkedInt, longInt],

  upcasts: [
    [
      checkedInt.type,
      longInt.type,
      n => longInt.promote(checkedInt.toJS(n))
    ]
  ],

  downcasts: [
    [
      longInt.type,
      n => checkedInt.canDowncast(n) ? checkedInt.promote(longInt.toJS(n)) : n
    ]
  ]
});


const fraction = require('./fraction')(integer, promoteToInt);


const rational = number({
  promote: promoteToInt,

  types: [checkedInt, longInt, fraction],

  upcasts: [
    [
      checkedInt.type,
      longInt.type,
      n => longInt.promote(checkedInt.toJS(n))
    ],
    [
      checkedInt.type,
      fraction.type,
      fraction.promote
    ],
    [
      longInt.type,
      fraction.type,
      fraction.promote
    ]
  ],

  downcasts: [
    [
      longInt.type,
      n => checkedInt.canDowncast(n) ? checkedInt.promote(longInt.toJS(n)) : n
    ],
    [
      fraction.type,
      q => {
        const n = fraction.asInteger(q);
        return (n !== undefined) ? n : q
      }
    ]
  ]
});


module.exports = rational;


if (require.main == module) {
  const num = module.exports;

  let t = 1;
  for (let i = 1; i < 50; ++i)
    t = num.times(t, i);
  console.log(t);
  for (let i = 1; i < 50; ++i)
    t = num.idiv(t, i);
  console.log(t);
  console.log(num.idiv('111111111', '12345679'));

  t = 0;
  let q = 1;
  for (let i = 0; i < 128; ++i) {
    q = num.div(q, 2);
    t = num.plus(t, q);
  }
  console.log(t);
  console.log(num.plus(t, q));

  console.log(num.div('18645978973801', '9991365345280000250718715904'));
}
