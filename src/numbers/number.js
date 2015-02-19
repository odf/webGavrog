'use strict';

var I = require('immutable');
var longInt = require('./longInt');


var num = function num(n) {
  if (n == null)
    return longInt.promote(0);
  else if (typeof n == "number")
    return longInt.promote(n);
  else if (typeof n == "string")
    return longInt.parse(n);
  else
    throw new Error("expected a number, got "+n);
};


[
  null, 0, 1, -1, 345, -456, -1234567890123456,
  "12345678912345678912345678912345678912345678912345"
]
  .forEach(function(n) { console.log(num(n)); });
