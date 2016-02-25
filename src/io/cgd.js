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


const splitLine = (s, lineNr) => {
  const fields = [];
  let inString = false;
  let fieldStart = null;

  for (let i = 0; i < s.length; ++i) {
    const c = s[i];

    if (c == '#')
      break;
    else if (c.match(/\s/)) {
      if (fieldStart != null && !inString) {
        fields.push(s.slice(fieldStart, i));
        fieldStart = null;
      }
    }
    else if (fieldStart == null)
      fieldStart = i;
    else if (!inString && s[fieldStart] == '"')
      throw new Error(`whitespace missing after string at line ${lineNr}`);

    if (c == '"')
      inString = !inString;
  }

  if (inString)
    throw new Error(`closing quotes missing at line ${lineNr}`);
  else if (fieldStart != null)
    fields.push(s.slice(fieldStart));

  return fields;
};


const rawBlocks = function*(lines) {
  let i = 0;
  let current = null;

  for (const line of lines) {
    const lineNr = ++i;
    const fields = splitLine(line, lineNr);
    if (fields.length == 0)
      continue;

    if (fields[0].toLowerCase() == 'end') {
      if (current == null)
        throw new Error(`no active block to be closed at line ${lineNr}`);
      yield current;
      current = null;
    }
    else {
      if (current == null)
        current = [];

      current.push({ lineNr, fields });
    }
  }

  if (current != null)
    throw new Error('file ends within a block');
};


const parseField = s => {
  if (s[0] == '"')
    return s.slice(1, -1);
  else if (s.match(/^[\d+-.]/)) {
    const parts = s.split('/');
    if (parts.length > 2)
      return s;
    else if (parts.length == 2)
      return { n: parseFloat(parts[0]), d: parseFloat(parts[1]) };
    else
      return parseFloat(s);
  }
  else
    return s;
};


const preprocessBlock = block => {
  const content = [];
  let key = null;

  for (let i = 1; i < block.length; ++i) {
    const { lineNr, fields } = block[i];
    const args = fields.map(parseField);

    if (fields[0].match(/^[a-z]/i)) {
      key = fields[0].toLowerCase();
      if (translation[key] != null)
        key = translation[key];
      args.shift();
    }

    if (args.length)
      content.push({ lineNr, key, args });
  }

  return {
    lineNr: block[0].lineNr,
    type  : block[0].fields[0].toLowerCase(),
    content
  };
};


const unknown = data => {
  return {
    content: data,
    errors : ["Unknown type"]
  }
};


const processPeriodicGraphData = data => {
  const warnings = [];
  const errors = [];
  const edges = [];
  let dim = null;
  let name = null;

  for (const { lineNr, key, args } of data.content) {
    if (key == 'name') {
      if (name != null)
        warnings.push("Multiple names at line #{lineNr}");
      else if (args.length == 0)
        warnings.push("Empty name at line #{lineNr}");
      else
        name = args.join(' ');
    }
    else if (key == 'edge') {
      let [v, w, ...shift] = args;

      if (w == null)
        errors.push("Incomplete edge specification at line #{lineNr}");
      else {
        if (shift.length == 0 && dim != null) {
          warnings.push("Missing shift vector at line #{lineNr}");
          shift = new Array(dim).fill(0);
        }

        if (dim == null)
          dim = shift.length
        else if (shift.length != dim)
          errors.push("Inconsistent shift dimensions at line #{lineNr}");

        edges.push([v, w, shift]);
      }
    }
    else
      warnings.push("Unknown keyword '#{key}' at line #{lineNr}");
  }

  return { name, warnings, errors, graph: pg.make(edges) };
};


const makeStructure = {
  periodic_graph: processPeriodicGraphData
};


export function* structures(lines) {
  for (const b of rawBlocks(lines)) {
    const data = preprocessBlock(b);
    yield (makeStructure[data.type] || unknown)(data);
  }
};


if (require.main == module) {
  const fs = require('fs');
  let lineNr = 0;

  const test = s => {
    try {
      console.log(splitLine(s, ++lineNr).map(parseField));
    } catch(ex) {
      console.log(ex);
    }
  }

  test('mutus nomen dedit cocis');
  test('mutus nomen "dedit" cocis  ');
  test('   mutus nomen "ded it" cocis 123 # done! ');
  test('  # comment!');
  test('mutus nomen "ded"it cocis');
  test('mutus nomen "dedit cocis');
  test('+1/3 -1.23e3 +15');

  process.argv.slice(2).forEach(file => {
    const txt = fs.readFileSync(file, { encoding: 'utf8' });
    const lines = txt.split(/\r?\n/);
    for (const b of structures(lines))
      console.log(JSON.stringify(b, null, 2));
  });
}
