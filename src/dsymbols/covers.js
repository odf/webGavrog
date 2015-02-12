'use strict';

var DS          = require('./delaney');
var fundamental = require('./fundamental');
var derived     = require('./derived');
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
  var table = cosets.cosetTable(fun.nrGenerators, fun.relators, subgroupGens);

  return coverForTable(ds, table, fun.edgeToWord);
};


var finiteUniversalCover = function finiteUniversalCover(ds) {
  return subgroupCover(ds, []);
};


var covers = function covers(ds, maxDegree) {
  var fun = fundamental.fundamentalGroup(ds);
  var tableGenerator = cosets.tables(fun.nrGenerators, fun.relators, maxDegree);

  return generators.results(tableGenerator).map(function(table) {
    return coverForTable(ds, table, fun.edgeToWord);
  });
};


if (require.main == module) {
  console.log(finiteUniversalCover(DS.parse('<1.1:1:1,1,1:4,3>')));
}
