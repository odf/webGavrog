'use strict';

var I = require('immutable');
var fw = require('./freeWords');
var partition = require('../common/partition');
var generators = require('../common/generators');


var mergeRows = function mergeRows(table, part, queue, a, b) {
  var ra = table.get(b).merge(table.get(a));
  var rb = table.get(a).merge(table.get(b));

  var nextToMerge = ra
    .map(function(ag, g) {
      return [ag, rb.get(g)];
    })
    .filter(function(pair) {
      return part.get(pair[0]) != part.get(pair[1]);
    });

  return {
    table: table.set(a, ra).set(b, ra),
    queue: queue.concat(nextToMerge)
  };
};


var identify = function identify(table, part, a, b) {
  var queue = I.List([[a, b]]);
  var a, b, merged;

  while (queue.size > 0) {
    a = part.get(queue.first()[0]);
    b = part.get(queue.first()[1]);
    queue = queue.shift();

    if (a != b) {
      part = part.union(a, b);
      merged = mergeRows(table, part, queue, a, b);
      table = merged.table;
      queue = merged.queue;
    }
  }

  return {
    table: table,
    part : part
  };
};


var scan = function scan(table, w, start, from, to) {
  var row = start;
  var i = from;
  var next;

  while (i < to) {
    next = table.getIn([row, w.get(i)]);
    if (next === undefined)
      break;
    else {
      ++i;
      row = next;
    }
  }

  return {
    row  : row,
    index: i
  };
};


var scanAndIdentify = function scanAndIdentify(table, part, w, start) {
  var n = w.size;

  var t = scan(table, w, start, 0, n);
  var head = t.row;
  var i = t.index;

  t = scan(table, fw.inverse(w), start, 0, n - i);
  var tail = t.row;
  var j = n - t.index;

  if (j == i+1)
    return {
      table: table.setIn([head, w.get(i)], tail).setIn([tail, -w.get(i)], head),
      part : part,
      next : head
    };
  else if (i == j && head != tail)
    return identify(table, part, head, tail);
  else
    return {
      table: table,
      part : part
    };
};


var scanRelations = function scanRelations(rels, subgens, table, part, start) {
  var current = {
    table: table,
    part : part
  };

  current = rels.reduce(
    function(c, w) {
      return scanAndIdentify(c.table, c.part, w, start);
    },
    current
  );

  return subgens.reduce(
    function(c, w) {
      return scanAndIdentify(c.table, c.part, w, c.part.get(0));
    },
    current
  );
};


var compressed = function(table, part) {
  var toIdx = table.map(function(_,k) { return k; })
    .filter(function(k) { return part.get(k) == k; })
    .toMap().flip();

  var canon = function(a) { return toIdx.get(part.get(a)); };

  return table.toMap()
    .filter(function(r, k) { return toIdx.get(k) != undefined; })
    .mapKeys(canon)
    .map(function(row) { return row.map(canon); });
};


var maybeCompressed = function(c, factor) {
  var invalid = (c.table.filter(function(k) { return c.part.get(k) != k; }).size
                 / c.table.size);
  if (invalid > factor)
    return { table: compressed(c.table, c.part), part: partition };
  else
    return c;
};


var withInverses = function(words) {
  return I.Set(words).merge(words.map(fw.inverse));
};


var cosetTable = function cosetTable(nrGens, relators, subgroupGens) {
  var gens = I.Range(1, nrGens+1).concat(I.Range(-1, -(nrGens+1)));
  var rels = withInverses(I.List(relators).map(fw.word).flatMap(function(r) {
    return I.Range(0, r.size).map(function(i) {
      return r.slice(i).concat(r.slice(0, i));
    });
  }));
  var subgens = withInverses(subgroupGens.map(fw.word));

  var current = {
    table: I.List([I.Map()]),
    part : partition()
  };

  var i = 0, j = 0;

  while (true) {
    if (current.table.size > 10000)
      throw new Error('maximum coset table size reached');

    if (i >= current.table.size) {
      return compressed(current.table, current.part);
    } else if (j >= gens.size || i != current.part.get(i)) {
      ++i;
      j = 0;
    } else if (current.table.getIn([i, gens.get(j)]) !== undefined) {
      ++j;
    } else {
      var g = gens.get(j);
      var n = current.table.size;
      var table = current.table.setIn([i, g], n).setIn([n, -g], i);
      current = maybeCompressed(
        scanRelations(rels, subgens, table, current.part, n));
      ++j;
    }
  }
};


var cosetRepresentatives = function(table) {
  var queue = I.List([0]);
  var reps = I.Map([[0, fw.empty]]);

  while (queue.size > 0) {
    var i = queue.first();
    var row = table.get(i);
    var free = row.filter(function(v) { return reps.get(v) === undefined; });
    reps = reps.merge(free.entrySeq().map(function(e) {
      return [e[1], fw.product([reps.get(i), [e[0]]])];
    }));
    queue = queue.shift().concat(free.toList());
  }

  return reps;
};


var _expandGenerators = function _expandGenerators(nrGens) {
  return I.Range(1, nrGens+1).concat(I.Range(-1, -(nrGens+1)));
};


var _expandRelators = function _expandRelators(relators) {
  return I.Set(I.List(relators).map(I.List).flatMap(function(w) {
    return I.Range(0, w.size).flatMap(function(i) {
      var wx = fw.product([w.slice(i), w.slice(0, i)]);
      return [wx, fw.inverse(wx)];
    });
  }));
};


var _freeInTable = function _freeInTable(table, gens) {
  return I.Range(0, table.size).flatMap(function(k) {
    var row = table.get(k);
    return gens.map(function(g) {
      if (row.get(g) == null)
        return { index: k, generator: g };
    }).filter(function(x) { return x != null });
  });
};


var _scanRecursively = function _scanRecursively(rels, table, index) {
  var q = I.List();
  var k = index;
  var t = table;
  var rs = rels;

  while (!rs.isEmpty() || !q.isEmpty()) {
    if (!rs.isEmpty()) {
      var out = scanAndIdentify(t, partition(), rs.first(), k);
      if (!out.part.isTrivial())
        return;

      t = out.table;
      if (out.next != null)
        q = q.push(out.next);
      rs = rs.rest();
    } else {
      k = q.first();
      q = q.rest();
      rs = rels;
    }
  }

  return t;
};


var _potentialChildren = function _potentialChildren(
  table, gens, rels, maxCosets
) {
  var free = _freeInTable(table, gens);

  if (!free.isEmpty()) {
    var k = free.first().index;
    var g = free.first().generator;
    var ginv = -g;
    var n = table.size;
    var matches = I.Range(k, n).filter(function(k) {
      return table.getIn([k, ginv]) == null;
    });
    var candidates = n < maxCosets ? I.List(matches).push(n) : matches;

    return candidates
      .map(function(pos) {
        var t = table.setIn([k, g], pos).setIn([pos, ginv], k);
        return _scanRecursively(rels, t, k);
      })
      .filter(function(t) { return t != null; })
  } else
    return I.List();
};


var _compareRenumberedFom = function _compareRenumberedFom(table, gens, start) {
  var o2n = I.Map([[start, 0]]);
  var n2o = I.Map([[0, start]]);
  var row = 0;
  var col = 0;

  while (true) {
    if (row >= o2n.size && row < table.size)
      throw new Error("coset table is not transitive");

    if (row >= table.size)
      return 0;
    else if (col >= gens.size) {
      ++row;
      col = 0;
    } else {
      var oval = table.getIn([row, gens.get(col)]);
      var nval = table.getIn([n2o.get(row), gens.get(col)]);
      if (nval != null && o2n.get(nval) == null) {
        n2o = n2o.set(o2n.size, nval);
        o2n = o2n.set(nval, o2n.size);
      }
      nval = o2n.get(nval);

      if (oval == nval)
        ++col;
      else if (oval == null)
        return -1;
      else if (nval == null)
        return 1;
      else
        return nval - oval;
    }
  }
};


var _isCanonical = function _isCanonical(table, gens) {
  return I.Range(1, table.size).every(function(start) {
    return _compareRenumberedFom(table, gens, start) >= 0; 
  });
};


var tables = function tables(nrGens, relators, maxCosets) {
  var gens = _expandGenerators(nrGens);
  var rels = _expandRelators(relators);
  var free = function free(t) { return _freeInTable(t, gens); };

  return generators.backtracker({
    root: I.List([I.Map()]),
    extract: function(table) {
      return free(table).isEmpty() ? table : undefined;
    },
    children: function(table) {
      return _potentialChildren(table, gens, rels, maxCosets)
        .filter(function(t) {
          return !t.isEmpty() && _isCanonical(t, gens);
        });
    }
  });
};


module.exports = {
  cosetRepresentatives: cosetRepresentatives,
  cosetTable          : cosetTable,
  tables              : tables
};


if (require.main == module) {
  var t = cosetRepresentatives(
    cosetTable(
      3,
      [[1,1], [2,2], [3,3], [1,2,1,2,1,2], [1,3,1,3], fw.raisedTo(3, [2,3])],
      [[1,2]]));

  console.log(t.toList(), t.size);

  console.log(_expandGenerators(4));
  console.log(_expandRelators([[1,2,-3]]));

  generators.results(tables(2, [[1,1],[2,2],[1,2,1,2]], 8)).forEach(function(x) {
    console.log(JSON.stringify(x));
  });
}
