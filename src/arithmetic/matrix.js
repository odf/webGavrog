'use strict';

var I = require('immutable');


var matrix = function matrix(scalar, zero, one) {

  var Matrix = I.Record({
    nrows: undefined,
    ncols: undefined,
    data : undefined
  });

  Matrix.prototype.toString = function() {
    return '<'+this.nrows+'x'+this.ncols+' matrix: '+this.data+'>'
  };

  var get = function set(A, i, j) {
    return A.data.getIn([i, j]);
  };

  var _make = function _make(data) {
    if (data.size == 0 || data.first().size == 0)
      throw new Error('both dimensions must be positive');

    return new Matrix({
      nrows: data.size,
      ncols: data.first().size,
      data : I.List(data.map(I.List))
    });
  };

  var make = function make(data) {
    var tmp = I.List(data.map(I.List));
    var m = tmp.map(function(row) { return row.size; }).max();
    return _make(tmp.map(function(row) {
      return row.concat(I.Repeat(zero, m - row.size));
    }));
  };

  var constant = function constant(nrows, ncols, value) {
    var x = value === undefined ? zero : value;
    return _make(I.List(I.Repeat(I.List(I.Repeat(x, ncols)), nrows)));
  };

  var identity = function identity(n) {
    var zrow = I.List(I.Repeat(zero, n));
    return _make(I.Range(0, n).map(function(i) { return zrow.set(i, one); }));
  };

  var transposed = function transposed(A) {
    return _make(I.Range(0, A.ncols).map(function(j) {
      return I.Range(0, A.nrows).map(function(i) {
        return get(A, i, j);
      });
    }));
  };

  var set = function set(A, i, j, x) {
    return _make(A.data.setIn([i, j], x));
  };

  var times = function times(A, B) {
    if (A.ncols != B.nrows)
      throw new Error('shapes do not match');

    return _make(I.Range(0, A.nrows).map(function(i) {
      return I.Range(0, B.ncols).map(function(j) {
        return I.Range(0, A.ncols)
          .map(function(k) { return scalar.times(get(A, i, k), get(B, k, j)); })
          .reduce(scalar.plus, zero);
      });
    }));
  };


  var _findPivot = function _findPivot(A, row, col, overField) {
    var best = row;
    for (var i = row; i < A.nrows; ++i) {
      var x = scalar.abs(get(A, i, col));
      if (scalar.sgn(x) != 0) {
        var d = scalar.cmp(x, scalar.abs(get(A, best, col)));
        if (overField ? d > 0 : d < 0)
          best = i;
      }
    }
    return best;
  };

  var _swapRows = function _swapRows(A, i, j) {
    return _make(A.data.set(i, A.data.get(j)).set(j, A.data.get(i)));
  };

  var _negateRow = function _swapRows(A, i) {
    return _make(A.data.set(i, A.data.get(i).map(scalar.negative)));
  };

  var _adjustRow = function _swapRows(A, i, j, f) {
    return _make(A.data.set(i, I.Range(0, A.ncols).map(function(k) {
      return scalar.plus(get(A, i, k), scalar.times(get(A, j, k), f));
    })));
  };

  var _Triangulation = I.Record({
    R: undefined,
    U: undefined,
    sign: undefined
  });

  var triangulation = function triangulation(A, overField) {
    var R = A;
    var U = identity(R.ncols);
    var col = 0;
    var sign = 1;
    var overField = !!overField;
    var divide = overField ? scalar.div : scalar.idiv;

    for (var row = 0; row < R.nrows; ++row) {
      var cleared = false;

      while (!cleared && col < R.ncols) {
        var pivotRow = _findPivot(R, row, col, overField);
        var pivot = get(R, pivotRow, col);

        if (scalar.sgn(pivot) == 0) {
          ++col;
          continue;
        }

        if (pivotRow != row) {
          R = _swapRows(R, row, pivotRow);
          U = _swapRows(U, row, pivotRow);
          sign *= -1;
        }

        if (scalar.sgn(pivot) < 0) {
          R = _negateRow(R, row);
          U = _negateRow(U, row);
          sign *= -1;
        }

        cleared = true;

        for (var k = row + 1; k < R.nrows; ++k) {
          if (scalar.sgn(get(R, k, col)) != 0) {
            var f = scalar.negative(divide(get(R, k, col), get(R, row, col)));

            R = _adjustRow(R, k, row, f);
            U = _adjustRow(U, k, row, f);

            if (overField)
              R = set(R, k, col, zero);
            else
              cleared = scalar.sgn(get(R, k, col)) == 0;
          }
        }

        if (cleared)
          ++col;
      }
    }

    return new _Triangulation({ R: R, U: U, sign: sign });
  };


  return {
    make         : make,
    constant     : constant,
    identity     : identity,
    transposed   : transposed,
    set          : set,
    get          : get,
    times        : times,
    triangulation: triangulation
  };
};


if (require.main == module) {
  var Q = require('./number');
  var M = matrix(Q, 0, 1);

  console.log(M.make([[1],[2,3],[4,5,6]]));
  console.log(M.constant(3, 4));
  console.log(M.constant(3, 4, 5));
  console.log(M.identity(3));
  console.log(M.transposed(M.constant(3, 4, 5)));
  console.log(M.set(M.identity(3), 0, 1, 4));
  console.log(M.transposed(M.set(M.identity(3), 0, 1, 4)));
  console.log();

  var A = M.make([[1,2,3],[6,5,4],[7,8,9]]);
  var t = M.triangulation(A);
  console.log('A = '+A);
  console.log('t.U = '+t.U);
  console.log('t.R = '+t.R);
  console.log('t.sign = '+t.sign);
  console.log('t.U * A = '+M.times(t.U, A));
}
