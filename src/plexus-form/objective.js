'use strict';

var isNat = function(x) {
  return typeof x == 'number' && x >= 0 && x % 1 == 0;
};

var object = function() {
  var args = Array.prototype.slice.call(arguments);
  var result = [];
  var i;

  for (i = 0; i+1 < args.length; i += 2)
    if (!isNat(args[i]))
      result = {};

  for (i = 0; i+1 < args.length; i += 2)
    result[args[i]] = args[i + 1];

  return result;
};


var merge = function() {
  var args = Array.prototype.slice.call(arguments);
  var result = args.every(Array.isArray) ? [] : {};
  var i, obj, key;
  for (i in args) {
    obj = args[i];
    for (key in obj)
      result[key] = obj[key];
  }
  return result;
};


var mergeDeep = function() {
  var args = Array.prototype.slice.call(arguments);
  var result = args.every(Array.isArray) ? [] : {};
  var i, obj, key;
  for (i in args) {
    obj = args[i];
    for (key in obj) {
      if (typeof result[key] == 'object' && typeof obj[key] == 'object')
        result[key] = mergeDeep(result[key], obj[key]);
      else
        result[key] = obj[key];
    }
  }
  return result;
};


var getIn = function(root, path) {
  if (path.length == 0 || root == undefined)
    return root;
  else
    return getIn(root[path[0]], path.slice(1))
};


var setIn = function(root, path, value) {
  if (path.length == 0)
    return value;
  else {
    var child = (root == null) ? null : root[path[0]];
    var value = setIn(child || [], path.slice(1), value);
    return merge(root, object(path[0], value));
  }
};


var without = function(obj) {
  var args = [].slice.call(arguments);
  var result = Array.isArray(obj) ? [] : {};

  for (var key in obj)
    if (args.indexOf(key) < 0)
      result[key] = obj[key];

  return result;
};


var prune = function(root) {
  var result, isArray, key, val

  if (root == null || root === '')
    result = null;
  else if (root.constructor === Array || root.constructor === Object) {
    isArray = Array.isArray(root); 
    result = isArray ? [] : {};
    for (key in root) {
      val = prune(root[key]);
      if (val != null) {
        if (isArray)
          result.push(val);
        else
          result[key] = val;
      }
    }

    if (Object.keys(result).length == 0)
      result = null;
  } else
    result = root;

  return result;
};


var split = function(pred, obj) {
  var good = {};
  var bad = {};

  for (key in obj) {
    var val = obj[key];
    if (pred(key, val))
      good[key] = val;
    else
      bad[key] = val;
  }

  return [good, bad];
};


var map = function(fn, obj) {
  var output = {};
  var key;

  for (key in obj)
    output[key] = fn(obj[key]);

  return output;
};


var mapKeys = function(fn, obj) {
  var output = {};
  var key;

  for (key in obj)
    output[fn(key)] = obj[key];

  return output;
};


module.exports = {
  object : object,
  merge  : merge,
  mergeDeep: mergeDeep,
  getIn  : getIn,
  setIn  : setIn,
  without: without,
  prune  : prune,
  split  : split,
  map    : map,
  mapKeys: mapKeys
};
