// Operations for free words over the natural numbers (i.e. positive integers).
// Inverses are represented as negative numbers.
// Words are represented as immutable.js Lists.

'use strict';

var I = require('immutable');


var _isInteger = function _isInteger(x) {
  return typeof x == 'number' && x % 1 == 0;
};


var _overlap = function _overlap(w1, w2) {
  w1 = word(w1);
  w2 = word(w2);

  var n1 = w1.size;
  var n2 = w2.size;
  var n  = Math.min(n1, n2);

  for (var k = 0; k < n; ++k) {
    if (w2.get(k) != -w1.get(n1 - 1 - k))
      return k;
  }
  return n;
};


var _repeat = function _repeat(w, m) {
  return I.Range(0, m).reduce(
    function(r, _) {
      return r.concat(w);
    },
    empty
  );
};


var empty = I.List();


var word = function word(w) {
  return w.reduce(
    function(w, x) {
      if (!_isInteger(x))
        throw new Error('illegal word '+w);
      if (x == 0)
        return w;
      else if (w.last() == -x)
        return w.pop();
      else
        return w.push(x);
    },
    empty
  );
};


var inverse = function inverse(w) {
  return word(w).reverse().map(function(x) { return -x; });
};


var raisedTo = function raisedTo(m, w) {
  w = word(w);

  if (m == 0)
    return empty;
  else if (m < 0)
    return raisedTo(-m, inverse(w));
  else {
    var n = w.size;
    var k = _overlap(w, w);

    if (k == 0)
      return _repeat(w, m);
    else if (k == n)
      return (m % 2 == 0) ? empty : w;
    else {
      var head = w.slice(0, k);
      var tail = w.slice(n - k);
      var mid  = w.slice(k, n - k);

      return head.concat(_repeat(mid, m)).concat(tail);
    }
  }
};


var product = function product(words) {
  return words.map(word).reduce(
    function(w1, w2) {
      var k = _overlap(w1, w2);
      return w1.slice(0, w1.size - k).concat(w2.slice(k));
    },
    empty
  );
};


var commutator = function commutator(a, b) {
  return product([a, b, inverse(a), inverse(b)]);
};


module.exports = {
  empty     : empty,
  word      : word,
  inverse   : inverse,
  raisedTo  : raisedTo,
  product   : product,
  commutator: commutator
};


if (require.main == module) {
  console.log(product([[1,2,3], [-3,-2,4]]));
  console.log(raisedTo(3, [1,2,3,4,5,-2,-1]));
  console.log(commutator([1,2], [3,2]));
}
