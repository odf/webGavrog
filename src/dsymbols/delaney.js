'use strict';

var I = require('immutable');


var _isElement = function _isElement(dsImpl, D) {
  return typeof D == 'number' && D >= 1 && D <= dsImpl.size;
};

var _elements = function _elements(dsImpl) {
  return I.Range(1, dsImpl.size+1);
};

var _isIndex = function _isIndex(dsImpl, i) {
  return typeof i == 'number' && i >= 0 && i <= dsImpl.dim;
};

var _indices = function _indices(dsImpl) {
  return I.Range(0, dsImpl.dim+1);
};

var _get = function offset(dsImpl, list, i, D) {
  return list.get(i * dsImpl.size + D - 1);
};

var _s = function _s(dsImpl, i, D) {
  if (_isElement(dsImpl, D) && _isIndex(dsImpl, i))
    return _get(dsImpl, dsImpl.s, i, D);
};

var _v = function _v(dsImpl, i, j, D) {
  if (_isElement(dsImpl, D) && _isIndex(dsImpl, i) && _isIndex(dsImpl, j)) {
    if (j == i+1)
      return _get(dsImpl, dsImpl.v, i, D);
    else if (j == i-1)
      return _get(dsImpl, dsImpl.v, j, D);
    else if (_get(dsImpl, dsImpl.s, i, D) == _get(dsImpl, dsImpl.s, j, D))
      return 2;
    else
      return 1;
  }
};


var fromData = function fromData(dim, sData, vData) {
  var s = I.List(sData);
  var v = I.List(vData);

  var _ds = {
    s   : s,
    v   : v,
    dim : dim,
    size: v.size / dim
  };

  return {
    isElement: function(D)       { return _isElement(_ds, D); },
    elements : function()        { return _elements(_ds); },
    isIndex  : function(i)       { return _isIndex(_ds, i); },
    indices  : function()        { return _indices(_ds); },
    s        : function(i, D)    { return _s(_ds, i, D); },
    v        : function(i, j, D) { return _v(_ds, i, j, D); },
    toString : function()        { return toString(this); }
  }
};


var _parseInts = function _parseInts(str) {
  return str.trim().split(/\s+/).map(function(s) { return parseInt(s); });
};


var fromString = function fromString(str) {
  var parts = str.trim().replace(/^</, '').replace(/>$/, '').split(/:/);
  if (parts[0].match(/\d+\.\d+/))
    parts.shift();

  var dims = _parseInts(parts[0]);
  var size = dims[0];
  var dim  = dims[1] || 2;

  var gluings = parts[1].split(/,/).map(_parseInts);
  var degrees = parts[2].split(/,/).map(_parseInts);

  var s = new Array((dim+1) * size);
  var v = new Array(dim * size);

  var get = function get(a, i, D) { return a[i * size + D - 1]; };
  var set = function set(a, i, D, x) { a[i * size + D - 1] = x; };

  for (var i = 0; i <= dim; ++i) {
    var k = -1;
    for (var D = 1; D <= size; ++D) {
      if (!get(s, i, D)) {
        var E = gluings[i][++k];
        set(s, i, D, E);
        set(s, i, E, D);
      }
    }
  }

  for (var i = 0; i < dim; ++i) {
    var k = -1;
    for (var D = 1; D <= size; ++D) {
      if (!get(v, i, D)) {
        var m = degrees[i][++k];
        var E = D;
        var r = 0;

        do {
          E = get(s, i, E) || E;
          E = get(s, i+1, E) || E;
          ++r;
        }
        while (E != D);

        var b = m / r;

        do {
          E = get(s, i, E) || E;
          set(v, i, E, b);
          E = get(s, i+1, E) || E;
          set(v, i, E, b);
        }
        while (E != D);
      }
    }
  }

  return fromData(dim, s, v);
};


var _orbitReps1 = function _orbitReps1(ds, i) {
  return ds.elements().filter(function(D) {
    return ds.s(i, D) >= D;
  });
};


var _orbitReps2 = function _orbitReps2(ds, i, j) {
  var seen = new Array(ds.elements().size + 1);
  var result = [];

  ds.elements().forEach(function(D) {
    if (!seen[D]) {
      var E = D;

      do {
        E = ds.s(i, E) || E;
        seen[E] = true;
        E = ds.s(i+1, E) || E;
        seen[E] = true;
      }
      while (E != D);

      result.push(D);
    }
  });

  return I.List(result);
};


var toString = function toString(ds) {
  var sDefs = ds.indices()
    .map(function(i) {
      return _orbitReps1(ds, i)
        .map(function(D) { return ds.s(i, D); })
        .join(' ');
    })
    .join(',');

  var mDefs = ds.indices()
    .filter(function(i) { return ds.isIndex(i+1); })
    .map(function(i) {
      return _orbitReps2(ds, i, i+1)
        .map(function(D) { return m(ds, i, i+1, D); })
        .join(' ');
    })
    .join(',');

  var n = ds.elements().size;
  var d = ds.indices().size - 1;

  return '<1.1:'+n+(d == 2 ? '' : ' '+d)+':'+sDefs+':'+mDefs+'>';
};


var r = function r(ds, i, j, D) {
  var k = 0;
  var E = D;

  do {
    E = ds.s(i, E) || E;
    E = ds.s(i+1, E) || E;
    ++k;
  }
  while (E != D);

  return k;
};


var m = function m(ds, i, j, D) {
  return ds.v(i, j, D) * r(ds, i, j, D);
};


module.exports = {
  fromData  : fromData,
  fromString: fromString,

  isElement : function(ds, D)       { return ds.isElement(D); },
  elements  : function(ds)          { return ds.elements(); },
  isIndex   : function(ds, i)       { return ds.isIndex(i); },
  indices   : function(ds)          { return ds.indices(); },
  s         : function(ds, i, D)    { return ds.s(i, D); },
  v         : function(ds, i, j, D) { return ds.v(i, j, D); },

  r         : r,
  m         : m
};


if (require.main == module)
  console.log('' + fromString('<1.1:3:1 2 3,1 3,2 3:4 8,3>'));
