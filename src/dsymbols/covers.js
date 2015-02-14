'use strict';

var DS          = require('./delaney');
var fundamental = require('./fundamental');
var derived     = require('./derived');
var seq         = require('../common/lazyseq');
var generators  = require('../common/generators');
var cosets      = require('../fpgroups/cosets');


var coverForTable = function coverForTable(ds, table, edgeToWord) {
  return derived.cover(ds, table.size, function(k, i, D) {
    return edgeToWord.getIn([D, i])
      .reduce(function(k, g) { return table.getIn([k, g]); }, k);
  });
};


var subgroupCover = function subgroupCover(ds, subgroupGens) {
  var fun = fundamental.fundamentalGroup(ds);
  var table = cosets.cosetTable(
    fun.get('nrGenerators'), fun.get('relators'), subgroupGens);

  return coverForTable(ds, table, fun.get('edge2word'));
};


var finiteUniversalCover = function finiteUniversalCover(ds) {
  return subgroupCover(ds, []);
};


var covers = function covers(ds, maxDegree) {
  var fun = fundamental.fundamentalGroup(ds);
  var tableGenerator = cosets.tables(
    fun.get('nrGenerators'), fun.get('relators'), maxDegree);

  return seq.map(
    function(table) { return coverForTable(ds, table, fun.get('edge2word')); },
    generators.results(tableGenerator))
};


if (require.main == module) {
  var ds = DS.parse('<1.1:1:1,1,1:4,3>');
  var n = parseInt(process.argv[2]) || 2;

  covers(ds, n).forEach(function(ds) { console.log('' + ds); });
  console.log('' + finiteUniversalCover(ds));
}
