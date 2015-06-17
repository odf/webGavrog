'use strict';

var I = require('immutable');


var _assert = function(condition, message) {
  if (!condition)
    throw new Error(message || 'assertion error');
};


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

var _index = function offset(dsImpl, i, D) {
  return i * dsImpl.size + D - 1;
};

var _get = function offset(dsImpl, list, i, D) {
  return list.get(_index(dsImpl, i, D));
};

var _set = function offset(dsImpl, list, i, D, x) {
  return list.set(_index(dsImpl, i, D), x);
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


var _merge = function _merge(a, b) {
  return a.withMutations(function(list) {
    b.forEach(function(x, i) {
      if (x !== undefined)
        list.set(i, x);
    });
  });
};


var _precheckPairings = function _checkPairings(specs, size) {
  specs.forEach(function(p) {
    _assert(p.size == 1 || p.size == 2,
            'expected pair or singleton, got '+p);

    var D = p.get(0);
    var E = p.size > 1 ? p.get(1) : p.get(0);

    _assert(typeof D == 'number' && D % 1 == 0 && D > 0,
            'expected a positive integer, got '+D);
    _assert(D <= size,
            'expected at most '+size+', got '+D);

    _assert(typeof E == 'number' && E % 1 == 0 && E >= 0,
            'expected a non-negative integer, got '+E);
    _assert(E <= size,
            'expected at most '+size+', got '+E);
  });
};


var _withPairings = function _withPairings(dsImpl, i, inputs) {
  var specs = I.List(inputs).map(I.List);
  _precheckPairings(specs, dsImpl.size);

  _assert(typeof i == 'number' && i % 1 == 0 && i >= 0 && i <= dsImpl.dim,
          'expected an integer between 0 and '+dsImpl.dim+', got i');

  var sNew = I.List().withMutations(function(list) {
    var dangling = [];

    specs.forEach(function(p) {
      var D = p.get(0);
      var E = p.size > 1 ? p.get(1) : p.get(0);
      var Di = _get(dsImpl, list, i, D);
      var Ei = _get(dsImpl, list, i, E);

      _assert(Di === undefined || Di == E,
              'conflicting partners '+Di+' and '+E+' for '+D);
      _assert(Ei === undefined || Ei == D,
              'conflicting partners '+Ei+' and '+D+' for '+E);

      dangling.push(_get(dsImpl, dsImpl.s, i, D));
      dangling.push(_get(dsImpl, dsImpl.s, i, E));

      _set(dsImpl, list, i, D, E);
      _set(dsImpl, list, i, E, D);
    });

    dangling.forEach(function(D) {
      if (D && _get(dsImpl, list, i, D) === undefined)
        _set(dsImpl, list, i, D, 0);
    });
  });

  return _fromData(dsImpl.dim, _merge(dsImpl.s, sNew), dsImpl.v);
};


var _precheckBranchings = function _checkBranchings(specs, size) {
  specs.forEach(function(p) {
    _assert(p.size == 2, 'expected pair, got '+p);

    var D = p.get(0);
    var v = p.get(1);

    _assert(typeof D == 'number' && D % 1 == 0 && D > 0,
            'expected a positive integer, got '+D);
    _assert(D <= size,
            'expected at most '+size+', got '+D);

    _assert(typeof v == 'number' && v % 1 == 0 && v >= 0,
            'expected a non-negative integer, got '+v);
  });
};


var _withBranchings = function _withBranchings(dsImpl, i, inputs) {
  var specs = I.List(inputs).map(I.List);
  _precheckBranchings(specs, dsImpl.size);

  _assert(typeof i == 'number' && i % 1 == 0 && i >= 0 && i <= dsImpl.dim-1,
          'expected integer between 0 and '+dsImpl.dim-1+', got i');

  var vNew = I.List().withMutations(function(list) {
    specs.forEach(function(p) {
      var D = p.get(0);
      var v = p.get(1);
      var vD = _get(dsImpl, list, i, D);

      _assert(vD === undefined || vD == v,
              'conflicting values '+vD+' and '+v+' for '+D);

      var E = D;
      do {
        E = _get(dsImpl, dsImpl.s, i, E) || E;
        _set(dsImpl, list, i, E, v);
        E = _get(dsImpl, dsImpl.s, i+1, E) || E;
        _set(dsImpl, list, i, E, v);
      }
      while (E != D);
    });
  });

  return _fromData(dsImpl.dim, dsImpl.s, _merge(dsImpl.v, vNew));
};


var _fromData = function _fromData(dim, sData, vData) {
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
    toString : function()        { return stringify(this); },

    withPairings  : function(i, inputs) {
      return _withPairings(_ds, i, inputs);
    },
    withBranchings: function(i, inputs) {
      return _withBranchings(_ds, i, inputs);
    }
  }
};


var build = function build(dim, size, pairingsFn, branchingsFn) {
  var s = I.List().setSize((dim+1) * size);
  var v = I.List().setSize(dim * size);
  var ds0 = _fromData(dim, s, v);

  var ds1 = I.Range(0, dim+1).reduce(
    function(tmp, i) {
      return tmp.withPairings(i, pairingsFn(ds0, i));
    },
    ds0);

  var ds2 = I.Range(0, dim).reduce(
    function(tmp, i) {
      return tmp.withBranchings(i, branchingsFn(ds1, i));
    },
    ds1);

  return ds2;
};


var _parseInts = function _parseInts(str) {
  return str.trim().split(/\s+/).map(function(s) { return parseInt(s); });
};


var parse = function parse(str) {
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

  return _fromData(dim, s, v);
};


var orbitReps1 = function orbitReps1(ds, i) {
  return ds.elements().filter(function(D) {
    return (ds.s(i, D) || D) >= D;
  });
};


var orbit2 = function orbit2(ds, i, j, D) {
  return I.Set().withMutations(function(set) {
    var E = D;
    do {
      E = ds.s(i, E) || E;
      set.add(E);
      E = ds.s(j, E) || E;
      set.add(E);
    }
    while (E != D);
  });
};


var orbitReps2 = function orbitReps2(ds, i, j) {
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


var stringify = function stringify(ds) {
  var sDefs = ds.indices()
    .map(function(i) {
      return orbitReps1(ds, i)
        .map(function(D) { return ds.s(i, D) || 0; })
        .join(' ');
    })
    .join(',');

  var mDefs = ds.indices()
    .filter(function(i) { return ds.isIndex(i+1); })
    .map(function(i) {
      return orbitReps2(ds, i, i+1)
        .map(function(D) { return m(ds, i, i+1, D) || 0; })
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
    E = ds.s(j, E) || E;
    ++k;
  }
  while (E != D);

  return k;
};


var m = function m(ds, i, j, D) {
  return ds.v(i, j, D) * r(ds, i, j, D);
};


module.exports = {
  isElement: function(ds, D)       { return ds.isElement(D); },
  elements : function(ds)          { return ds.elements(); },
  isIndex  : function(ds, i)       { return ds.isIndex(i); },
  indices  : function(ds)          { return ds.indices(); },
  s        : function(ds, i, D)    { return ds.s(i, D); },
  v        : function(ds, i, j, D) { return ds.v(i, j, D); },

  r        : r,
  m        : m,
  dim      : function(ds) { return ds.indices().size - 1; },
  size     : function(ds) { return ds.elements().size; },

  build    : build,
  parse    : parse,
  stringify: stringify,

  orbitReps1: orbitReps1,
  orbit2    : orbit2,
  orbitReps2: orbitReps2,

  withPairings: function(ds, i, pairings) {
    return ds.withPairings(i, pairings);
  },

  withBranchings: function(ds, i, branchings) {
    return ds.withBranchings(i, branchings);
  },

  parseSymbols: function(text) {
    return text
      .split('\n')
      .filter(function(line) {
        var t = line.trim();
        return t.length > 0 && t[0] != '#';
      })
      .map(parse);
  }
};


if (require.main == module) {
  var ds = parse('<1.1:3:1 2 3,1 3,2 3:4 8,3>');

  console.log(stringify(ds));
  console.log('' + ds);

  console.log('' + ds.withPairings(1, [[2,1]]));
  console.log('' + ds.withBranchings(0, [[2,3],[1,5]]));
}
