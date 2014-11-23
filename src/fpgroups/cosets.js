'use strict';

var I = require('immutable');
var fw = require('./freeWords');
var partition = require('../common/partition');


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

  console.log('    identify');

  while (queue.size > 0) {
    a = part.get(queue.first()[0]);
    b = part.get(queue.first()[1]);
    console.log('    a: '+a+', b: '+b);
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

  console.log('  w: '+w+', start: '+start+
              ', head: '+head+', tail: '+tail+', i: '+i+', j: '+j);

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
    function(c, w) { return scanAndIdentify(c.table, c.part, w, start); },
    current
  );

  return subgens.reduce(
    function(c, w) { return scanAndIdentify(c.table, c.part, w, part.get(0)); },
    current
  );
};


var cosetTable = function cosetTable(nrGens, relators, subgroupGens) {
  var withInverses = function(words) {
    return I.Set(words).merge(words.map(fw.inverse));
  };

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
  console.log('gens: '+gens);
  console.log('rels: '+rels);
  console.log('subgens: '+subgens);
  console.log();

  while (true) {
    console.log('i: '+i+', j: '+j);
    console.log('table: '+current.table);
    console.log('partition: '+current.part);
    if (current.table.size > 10)
      return;

    if (i >= current.table.size) {
      return current;
    } else if (j >= gens.size || i != current.part.get(i)) {
      ++i;
      j = 0;
    } else if (current.table.getIn([i, gens.get(j)]) !== undefined) {
      ++j;
    } else {
      var g = gens.get(j);
      var n = current.table.size;
      var table = current.table.setIn([i, g], n).setIn([n, -g], i);
      console.log('  table -> '+table);
      current = scanRelations(rels, subgens, table, current.part, n);
      ++j;
    }

    console.log();
  }
};


if (require.main == module) {
  console.log(cosetTable(1, [[1,1,1,1]], [[]]));
}
