'use strict';

var I = require('immutable');


var _BASE_LENGTH = I.Range(1)
  .filter(function(n) {
    if (n % 2)
      return false;
    var b = Math.pow(10, n);
    return 2 * b - 2 == 2 * b - 1 || -2 * b + 2 == -2 * b + 1;
  }).first() - 1;

var _BASE = Math.pow(10, _BASE_LENGTH);
var _HALFBASE = Math.sqrt(_BASE);


var _asNum = function(n) {
  return Math.abs(n) < _BASE ? _makeCheckedInt(n) : _longIntFromNative(n);
};


var num = function(n) {
  if (n == null)
    return num.fromNative(0);
  else if (typeof n == "number")
    return num.fromNative(n);
  else if (typeof n == "string")
    return num.parse(n);
  else {
    if (n instanceof NumberBase)
      return n;
    else
      throw new Error("expected a number, got "+n);
  }
};


num.fromNative = function(n) {
  if (n % 1)
    throw new Error("expected an integer, got "+n);
  return _asNum(n);
};


num.parse = function(n) {
  if (!n.match(/^[+-]?\d+$/))
    throw new Error("expected an integer literal, got "+n);

  var s = 1, m = n;
  if (n[0] == "+")
    m = n.slice(1);
  else if (n[0] == "-") {
    s = -1;
    m = n.slice(1);
  }

  if (m.length <= _BASE_LENGTH)
    return _makeCheckedInt(parseInt(n));
  else {
    var a = m.length % _BASE_LENGTH;
    var b = m.length / _BASE_LENGTH;
    var sections = I.List(I.Range(0, b-1).map(function(i) {
      return [a + i * _BASE_LENGTH, a + (i+1) * _BASE_LENGTH];
    }));
    if (a > 0)
      sections = sections.unshift([0, a]);

    return _makeLongInt(s, sections.map(function(r) {
      return parseInt(m.slice(r[0], r[1]));
    }));
  }
};


var _makeLongInt = function(s, a) {
  console.log(s, a);
};


num.parse("1234567890123456789012345678901234567890123456789012");
