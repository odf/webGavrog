'use strict';

var I = require('immutable');


var isElement = function isElement(dsImpl, D) {
  return typeof D == 'number' && D >= 1 && D <= dsImpl.size;
};

var elements = function elements(dsImpl) {
  return I.Range(1, dsImpl.size+1);
};

var isIndex = function isIndex(dsImpl, i) {
  return typeof i == 'number' && i >= 0 && i <= dsImpl.dim;
};

var indices = function indices(dsImpl) {
  return I.Range(0, dsImpl.dim+1);
};

var offset = function offset(dsImpl, i, D) {
  return i * dsImpl.size + D - 1;
};

var s = function s(dsImpl, i, D) {
  if (isElement(dsImpl, D) && isIndex(dsImpl, i))
    return dsImpl.s.get(offset(dsImpl, i, D));
};

var v = function v(dsImpl, i, j, D) {
  if (isElement(dsImpl, D) && isIndex(dsImpl, i) && isIndex(dsImpl, j)) {
    if (j == i+1)
      return dsImpl.v.get(offset(dsImpl, i, D));
    else if (j == i-1)
      return dsImpl.v.get(offset(dsImpl, j, D));
    else if (s(dsImpl, i, D) == s(dsImpl, j, D))
      return 2;
    else
      return 1;
  }
};


var dsymbol = function dsymbol(dim, sData, vData) {
  var _s = I.List(sData);
  var _v = I.List(vData);

  var _ds = {
    s   : _s,
    v   : _v,
    dim : dim,
    size: _v.count() / dim
  };

  return {
    isElement: function(D)       { return isElement(_ds, D); },
    elements : function()        { return elements(_ds); },
    isIndex  : function(i)       { return isIndex(_ds, i); },
    indices  : function()        { return indices(_ds); },
    s        : function(i, D)    { return s(_ds, i, D); },
    v        : function(i, j, D) { return v(_ds, i, j, D); }
  }
};


module.exports = {
  dsymbol: dsymbol
};
