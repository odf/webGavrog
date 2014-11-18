'use strict';


var I = require('immutable');


var find = function find(impl, x) {
  var root = x;
  var p, z, t;

  while (impl.parent.get(root) !== undefined)
    root = impl.parent.get(root);

  p = impl.parent;
  for (z = x; z != root;) {
    t = z;
    z = p.get(z);
    p.set(t, root);
  }
  impl.parent = p;

  return root;
};


var union = function union(impl, x, y) {
  var x0 = find(impl, x);
  var y0 = find(impl, y);

  if (I.is(x0, y0))
    return impl;
  else {
    var rx = impl.rank.get(x0) || 0;
    var ry = impl.rank.get(y0) || 0;

    if (rx < ry)
      return pmake(impl.rank, impl.parent.set(x0, y0));
    else if (rx > ry)
      return pmake(impl.rank, impl.parent.set(y0, x0));
    else
      return pmake(impl.rank.set(x0, rx + 1), impl.parent.set(y0, x0));
  }
};


var pmake = function pmake(rank, parent) {
  var _impl = {
    rank  : rank,
    parent: parent
  };

  return {
    find : function(x) { return find(_impl, x); },
    union: function(x, y) { return union(_impl, x, y); }
  };
};


var partition = function partition(pairs) {
  var p = pmake(I.Map(), I.Map());
  pairs.forEach(function(pair) {
    p = p.union(pair[0], pair[1]);
  });
  return p;
};


module.exports = partition;


if (require.main == module) {
  var p = partition([[1,2],[3,4],[5,6],[7,8],[2,3],[1,6]]);

  for (var i = 0; i < 10; ++i)
    console.log('p.find('+i+') = '+p.find(i));
}
