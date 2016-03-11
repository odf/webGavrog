const parser = require('./cgdParser');

import * as pg from '../pgraphs/periodic';


const translation = {
  id      : "name",
  vertex  : "node",
  vertices: "node",
  vertexes: "node",
  atom    : "node",
  atoms   : "node",
  nodes   : "node",
  bond    : "edge",
  bonds   : "edge",
  edges   : "edge",
  faces   : "face",
  ring    : "face",
  rings   : "face",
  tiles   : "tile",
  body    : "tile",
  bodies  : "tile",
  spacegroup  : "group",
  space_group : "group",
  edge_centers: "edge_center",
  edge_centre : "edge_center",
  edge_centres: "edge_center",
  edgecenter  : "edge_center",
  edgecenters : "edge_center",
  edgecentre  : "edge_center",
  edgecentres : "edge_center",
  coordination_sequences: "coordination_sequence",
  coordinationsequence  : "coordination_sequence",
  coordinationsequences : "coordination_sequence",
  cs                    : "coordination_sequence"
};


const unknown = data => {
  return {
    content: data,
    errors : ["Unknown type"]
  }
};


const joinArgs = args => args.join(' ');


const initialState = data => ({
  input   : data,
  output  : {},
  errors  : [],
  warnings: []
});


const extractSingleValue = (state, key, options = {}) => {
  const { input, output, errors, warnings } = state;
  const good = input.filter(s => s.key == key);

  state.input = input.filter(s => s.key != key);

  if (good.length == 0)
    (options.mandatory ? errors : warnings).push(`Missing ${key} statement`);
  else if (good.length > 1)
    warnings.push('Multiple ${key} statements');
  else if (good[0].args.length == 0)
    (options.mandatory ? errors : warnings).push(`Empty ${key} statement`);
  else
    output[key] = options.fn ? options.fn(good[0].args) : good[0].args;
};


const processPeriodicGraphData = data => {
  const state = initialState(data.content);
  const edges = [];
  let dim = null;

  extractSingleValue(state, 'name', { mandatory: true, fn: joinArgs });

  for (const { key, args } of state.input) {
    if (key == 'edge') {
      let [v, w, ...shift] = args;

      if (w == null)
        state.errors.push("Incomplete edge specification");
      else {
        if (shift.length == 0 && dim != null) {
          state.warnings.push("Missing shift vector");
          shift = new Array(dim).fill(0);
        }

        if (dim == null)
          dim = shift.length
        else if (shift.length != dim)
          errors.push("Inconsistent shift dimensions");

        edges.push([v, w, shift]);
      }
    }
    else
      state.warnings.push("Unknown keyword '#{key}'");
  }

  return {
    name    : state.output.name,
    warnings: state.warnings,
    errors  : state.warnings,
    graph   : pg.make(edges)
  };
};


const makeStructure = {
  periodic_graph: processPeriodicGraphData
};


const preprocessBlock = ({ type, content }) => ({
  type,
  content: content.map(({ key, args }) => ({
    key: translation[key] || key,
    args
  }))
});


const reportError = (text, ex) => {
  if (ex.location) {
    var n = ex.location.start.line - 1;
    var m = ex.location.start.column || 0;
    var lines = txt.split('\n');
    var pre  = lines.slice(Math.max(n-5, 0), n);
    var line = lines[n];
    var post = lines.slice(n+1, n+6);
    console.error(ex.message);
    console.error('(line '+(n+1)+', column '+m+')\n');
    if (pre.length > 0)
      console.error('  ' + pre.join('\n  '));
    console.error('* ' + line);
    console.error('  ' + Array(m).join(' ') + '^');
    console.error('  ' + post.join('\n  '));
  }
  else
    console.error(ex);
};


export function* structures(text) {
  let blocks;

  try {
    blocks = parser.parse(text);
  } catch(ex) {
    reportError(text, ex);
  }

  for (const b of blocks) {
    const data = preprocessBlock(b);
    yield (makeStructure[data.type] || unknown)(data);
  }
};


if (require.main == module) {
  const fs = require('fs');

  process.argv.slice(2).forEach(file => {
    const text = fs.readFileSync(file, { encoding: 'utf8' });

    for (const b of structures(text))
      console.log(JSON.stringify(b, null, 2));
  });
}
