'use strict';


var seq = function seq(value, thunk) {
  var _first = value;
  var _rest  = function _restInitial() {
    var next = thunk();
    _rest = function _restResolved() {
      return next;
    };
    return next;
  };

  return {
    first   : function () { return _first; },
    rest    : function () { return _rest(); },
    toString: function () { return toString(this); },
    toJSON  : function () { return asArray(this); }
  };
};


var size = function size(s) {
  for (var i = 0, r = s; r; ++i, r = r.rest())
    ;
  return i;
};


var asArray = function asArray(s) {
  var a = [];

  for (var r = s; r; r = r.rest())
    a.push(r.first());

  return a;
};


var toString = function(s) {
  var a = asArray(take(17, s));
  return a.slice(0,16).join(' : ') + (a.length > 16 ? ' : ...' : '');
};


var take = function take(n, s) {
  if (s && n > 0)
    return seq(s.first(), function() { return take(n-1, s.rest()); });
};


var takeWhile = function take(pred, s) {
  if (s && pred(s.first()) > 0)
    return seq(s.first(), function() { return takeWhile(pred, s.rest()); });
};


var drop = function drop(n, s) {
  for (var r = s, i = n; r && i > 0; r = r.rest(), --i)
    ;
  return r;
};


var dropWhile = function dropWhile(pred, s) {
  for (var r = s; r && pred(r.first()); r = r.rest())
    ;
  return r;
};


var map = function map(fn, s) {
  if (s)
    return seq(fn(s.first()), function() { return map(fn, s.rest()); });
};


var filter = function filter(pred, s) {
  var r = dropWhile(function(x) { return !pred(x); }, s);
  if (r)
    return seq(r.first(), function() { return filter(pred, r.rest()); });
};


var reduce = function reduce(fn, init, s) {
  var a = init;
  for (var r = s; r; r = r.rest())
    a = fn(a, r.first());
  return a;
};


var range = function range(start, limit) {
  if (limit != start)
    return seq(start, function() { return range(start+1, limit); });
};


module.exports = {
  seq      : seq,
  size     : size,
  asArray  : asArray,
  toString : toString,
  take     : take,
  takeWhile: takeWhile,
  drop     : drop,
  dropWhile: dropWhile,
  map      : map,
  filter   : filter,
  reduce   : reduce,
  range    : range
};


if (require.main == module) {
  console.log(''+range(1, 200));
  console.log(''+size(range(0, 100)));
  console.log(''+take(5, range(1)));
  console.log(''+takeWhile(function(n) { return n * n < 50; }, range(1)));
  console.log(''+drop(10, range(1,20)));
  console.log(''+dropWhile(function(n) { return n % 2 == 1; }, range(1,10)));
  console.log(''+map(function(n) { return 2 * n; }, range(1, 10)));
  console.log(''+filter(function(n) { return n % 7 == 0; }, range(1, 50)));
  console.log(''+reduce(function(a, b) { return a + b; }, 0, range(1, 10)));
}
