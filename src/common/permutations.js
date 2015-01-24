'use strict';


var _swap = function(a, i, j) {
  var t = a[i];
  a[i] = a[j];
  a[j] = t;
};


module.exports = function(n) {
  var i, j;

  var p = [];
  for (i = 1; i <= n; ++i)
    p.push(i);

  var result = [];

  while (true) {
    result.push(p.slice());

    for (i = n-2; i >= 0 && p[i] > p[i+1]; --i)
      ;
    if (i < 0)
      break;

    for (j = n-1; p[j] < p[i]; --j)
      ;

    _swap(p, i, j);

    for (++i, j = n-1; i < j; ++i, --j)
      _swap(p, i, j);
  }

  return result;
};
