'use strict';

var I = require('immutable');


var vector = function vector(scalar, zero) {

  var Vector = I.Record({
    size: undefined,
    data: undefined
  });

  Vector.prototype.toString = function() {
    return '<vector: '+this.data+'>'
  };

  var get = function get(v, i) {
    return v.data.get(i);
  };

  var make = function make(data) {
    if (data.size == 0)
      throw new Error('must have positive size');

    return new Vector({
      size: data.size,
      data: I.List(data)
    });
  };

  var constant = function constant(size, value) {
    var x = value === undefined ? zero : value;
    return make(I.List(I.Repeat(x, size)));
  };

  var set = function set(v, i, x) {
    return make(v.data.set(i, x));
  };

  var update = function update(v, i, fn) {
    return make(v.data.update(i, fn));
  };

  var plus = function plus(v, w) {
    if (v.size != w.size)
      throw new Error('shapes do not match');

    return make(I.Range(0, v.size).map(function(i) {
      return scalar.plus(get(v, i), get(w, i));
    }));
  };

  var minus = function plus(v, w) {
    if (v.size != w.size)
      throw new Error('shapes do not match');

    return make(I.Range(0, v.size).map(function(i) {
      return scalar.minus(get(v, i), get(w, i));
    }));
  };

  var scaled = function scaled(f, v) {
    return make(v.data.map(function(x) { return scalar.times(f, x); }));
  };

  var cmp = function cmp(v, w) {
    var d = I.Range(0, Math.min(v.size, w.size))
      .map(function(i) { return scalar.cmp(get(v, i), get(w, i)); })
      .filter(function(x) { return !!x; })
      .first();

    return d || v.size - w.size;
  };

  var dotProduct = function dotProduct(v, w) {
    if (v.size != w.size)
      throw new Error('shapes do not match');

    return I.Range(0, v.size)
      .map(function(i) { return scalar.times(get(v, i), get(w, i)); })
      .reduce(scalar.plus, zero);
  };

  var norm = function norm(v) {
    return Math.sqrt(scalar.toJS(dotProduct(v, v)));
  };

  var normalized = function normalized(v) {
    return scaled(1 / norm(v), v);
  };

  return {
    get       : get,
    make      : make,
    constant  : constant,
    set       : set,
    update    : update,
    plus      : plus,
    minus     : minus,
    scaled    : scaled,
    cmp       : cmp,
    dotProduct: dotProduct,
    norm      : norm,
    normalized: normalized
  };
};
