const ops = require('../geometry/types').coordinateChangesQ;

import * as pg from '../pgraphs/periodic';
import * as sg from '../geometry/sgtable';
import * as cr from './crystal';

import parseBlocks from './parseCgd';
import parseOperator from '../geometry/parseOperator';


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
  coordination_sequences: "coordination_sequence",
  coordinationsequence  : "coordination_sequence",
  coordinationsequences : "coordination_sequence",
  cs                    : "coordination_sequence"
};


const unknown = data => {
  return {
    entries: data,
    errors : ["Unknown type"]
  }
};


const joinArgs = args => args.join(' ');
const capitalize = s => s[0].toUpperCase() + s.slice(1);

const findGroup = args => sg.settingByName(args.join(''));

const eps    = Math.pow(2, -50);
const trim   = x => Math.abs(x) < eps ? 0 : x;
const cosdeg = deg => trim(Math.cos(deg * Math.PI / 180.0));

const asFloats = v => v.map(x => ops.typeOf(x) == 'Float' ? x : ops.toJS(x));


const makeGramMatrix = args => {
  if (args.length == 3) {
    const [a, b, angle] = args;
    const x = cosdeg(angle) * a * b;
    return trim([[a*a, x], [x, b*b]]);
  }
  else if (args.length == 6) {
    const [a, b, c, alpha, beta, gamma] = args;
    const aG = cosdeg(alpha) * b * c;
    const bG = cosdeg(beta ) * a * c;
    const cG = cosdeg(gamma) * a * b;
    return trim([[a*a, cG, bG], [cG, b*b, aG], [bG, aG, c*c]]);
  }
  else
    return { error: `expected 3 or 6 arguments, got ${args.length}` };
};


const array = n => Array(n).fill(0);

const identity = n => array(n).map((_, i) => array(n).fill(1, i, i+1));


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

  if (good.length == 0) {
    if (!options.silent)
      (options.mandatory ? errors : warnings).push(`Missing ${key} statement`);
  }
  else if (good.length > 1)
    warnings.push('Multiple ${key} statements');
  else if (good[0].args.length == 0)
    (options.mandatory ? errors : warnings).push(`Empty ${key} statement`);
  else if (options.fn == null)
    output[key] = good[0].args;
  else {
    const processed = options.fn(good[0].args);
    if (processed != null) {
      for (const s of (processed.warnings || []))
        warnings.push(s);
      for (const s of (processed.errors || []))
        errors.push(s);
      output[key] = processed;
    }
  }
};


const processPeriodicGraphData = data => {
  const state = initialState(data.entries);
  const edges = [];
  let dim = null;

  extractSingleValue(state, 'name', { fn: joinArgs });

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
          state.errors.push("Inconsistent shift dimensions");

        edges.push([v, w, shift]);
      }
    }
    else
      state.warnings.push(`Unknown keyword '${key}'`);
  }

  return {
    name    : state.output.name,
    graph   : pg.make(edges),
    warnings: state.warnings,
    errors  : state.errors
  };
};


const processSymmetricNet = data => {
  const state = initialState(data.entries);
  const nodes = {};
  const edges = [];
  let dim = null;

  extractSingleValue(state, 'name', { fn: joinArgs });
  extractSingleValue(state, 'group', { fn: findGroup });

  for (const { key, args } of state.input) {
    if (key == 'node') {
      const [name, ...rest] = args;
      const pos = parseOperator(rest.join(''));
      const d = ops.dimension(pos);

      if (dim == null)
        dim = d;
      else if (d != dim)
        state.errors.push("Inconsistent dimensions");

      if (nodes[name] != null)
        state.errors.push(`Node '${name}' specified twice`);
      else
        nodes[name] = pos;
    }
    else if (key == 'edge') {
      let [v, w, ...rest] = args;

      if (w == null)
        state.errors.push("Incomplete edge specification");
      else {
        let shift;

        if (rest.length == 0 && dim != null) {
          state.warnings.push("Missing shift vector");
          shift = new Array(dim).fill(0);
        }
        else
          shift = parseOperator(rest.join(''));

        const d = ops.dimension(shift);

        if (dim == null)
          dim = d;
        else if (d != dim)
          state.errors.push("Inconsistent dimensions");

        edges.push([v, w, shift]);
      }
    }
    else
      state.warnings.push(`Unknown keyword '${key}'`);
  }

  return {
    group   : state.output.group.name,
    nodes   : nodes,
    edges   : edges,
    warnings: state.warnings,
    errors  : state.errors
  };
};


const processCrystal = data => {
  const state = initialState(data.entries);
  const { errors, warnings, output } = state;
  const nodes = [];
  const edges = [];
  const seen = {};
  let dim = null;

  extractSingleValue(state, 'name' , { fn: joinArgs });
  extractSingleValue(state, 'group', { fn: findGroup });
  extractSingleValue(state, 'cell' , { fn: makeGramMatrix });

  if (output.group == null)
    output.group = findGroup(['P1']);

  dim = ops.dimension(output.group.transform);

  if (output.cell == null)
    output.cell = identity(dim);
  else if (output.cell.length != dim)
    errors.push("Inconsistent dimensions");

  for (const { key, args } of state.input) {
    if (key == 'node') {
      const location = `${capitalize(key)} '${name}'`;
      const [name, coordination, ...position] = args;

      if (position.length != dim)
        errors.push("Inconsistent dimensions");

      if (typeof coordination != 'number' || coordination < 0)
        errors.push(`${location}: coordination must be a non-negative number`);

      if (seen[name])
        errors.push(`${location} specified twice`);
      else {
        nodes.push({
          name,
          coordination,
          position: asFloats(position)
        });
        seen[name] = true;
      }
    }
    else if (key == 'edge') {
      if (args.length == 2 * dim)
        edges.push([asFloats(args.slice(0, dim)), asFloats(args.slice(dim))]);
      else if (args.length == 1 + dim)
        edges.push([args[0], asFloats(args.slice(1))]);
      else if (args.length == 2)
        edges.push(args);
      else
        errors.push(`${location}: expected 2, ${dim+1} or ${2*dim} arguments`);
    }
    else
      state.warnings.push(`Unknown keyword '${key}'`);
  }

  return cr.netFromCrystal({
    name: output.name,
    group: output.group,
    cellGram: output.cell,
    nodes,
    edges,
    warnings,
    errors
  });
};


const processFaceListData = data => {
  const state = initialState(data.entries);
  const { errors, warnings, output } = state;
  const faces = [];
  const tiles = [];
  let dim = null;
  let currentFaceSize = null;
  let currentFaceData = null;

  extractSingleValue(state, 'name' , { fn: joinArgs });
  extractSingleValue(state, 'group', { fn: findGroup });
  extractSingleValue(state, 'cell' , { fn: makeGramMatrix });

  if (output.group == null)
    output.group = findGroup(['P1']);

  dim = ops.dimension(output.group.transform);

  if (output.cell == null)
    output.cell = identity(dim);
  else if (output.cell.length != dim)
    errors.push("Inconsistent dimensions");

  for (const { key, args } of state.input) {
    if (key == 'face') {
      for (const item of args) {
        if (currentFaceSize == null) {
          if (ops.typeOf(item) == 'Integer' && item > 0) {
            currentFaceSize = item;
            currentFaceData = [];
          } else
            errors.push("Face size must be a positive integer");
        } else {
          currentFaceData.push(item);
          if (currentFaceData.length == currentFaceSize * dim) {
            const face = [];
            for (let i = 0; i < currentFaceData.length; i += dim)
              face.push(currentFaceData.slice(i, i + dim));

            if (tiles.length)
              tiles[tiles.length - 1].push(faces.length);
            faces.push(face);

            currentFaceSize = null;
            currentFaceData = null;
          }
        }
      }
    } else if (key == 'tile') {
      tiles.push([]);
    } else
      state.warnings.push(`Unknown keyword '${key}'`);
  }

  return cr.tilingFromFacelist({
    type: data.type,
    name: output.name,
    group: output.group,
    cellGram: output.cell,
    faces,
    tiles,
    warnings,
    errors
  });
};


const makeStructure = {
  periodic_graph: processPeriodicGraphData,
  net           : processSymmetricNet,
  crystal       : processCrystal,
  tiling        : processFaceListData
};


const reportError = (text, ex) => {
  if (ex.location) {
    var n = ex.location.start.line - 1;
    var m = ex.location.start.column || 0;
    var lines = text.split('\n');
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


export function *blocks(text) {
  for (const s of parseBlocks(text.split('\n'), translation))
    yield { ...s, isRaw: true };
};


export const processed = block => {
  const output = (makeStructure[block.type] || unknown)(block);

  return { ...output, type: block.type };
};


export function* structures(text) {
  for (const b of blocks(text))
    yield processed(b);
};


if (require.main == module) {
  const input = `
PERIODIC_GRAPH
ID diamond
EDGES
  1 2 0 0 0
  1 2 1 0 0
  1 2 0 1 0
  1 2 0 0 1
END


NET # the diamond net
  Group Fd-3m
  Node 1 3/8,3/8,3/8
  Edge 1 1 1-x,1-y,1-z
END


# The type of data to expect
CRYSTAL
  # Structure id (optional; ID and NAME both work)
  ID    diamond
  # The space group
  GROUP Fd-3m
  # Cell parameters: a b c alpha beta gamma
  CELL         2.3094 2.3094 2.3094  90.00000   90.00000   90.00000
  # Atom specification: name coordination x y z
  #   (decimal numbers or fractions can be used for coordinates)
  ATOM  1  4   5/8 5/8 5/8
# This ends the structure description
END


CRYSTAL
  ID    diamond-with-cell-error
  GROUP Fd-3m
  CELL  2.3094 2.3094 2.3094  90.00000   90.00000   95.00000
  ATOM  1  4   5/8 5/8 5/8
END


CRYSTAL
  NAME  real CdSO4
  GROUP Pmn21
  CELL  6.558 4.698 4.719 90.0 90.0 90.0
  # First kind of atom
  ATOM  1 4  0.0000  0.6657  0.7306
  # Edges can be specified by giving the names of the endpoints
  EDGE  1 2
  # or by giving a number for the first and coordinates for the second. 
  EDGE  1    0.0000  0.1416  0.2500
  # or by giving coordinates for both
  EDGE  0.0000  0.6657  0.7306    0.0000  1.1416  1.2500
  # The Keyword EDGE may be missing on consecutive lines.
        1   -0.5000  0.8584  0.7500
  # Second kind of atom.
  ATOM  2 4  0.5000  0.8584  0.7500
  # Second group of edge specifications.
  EDGE  2    0.0000  0.6657  0.7306
        2    1.0000  0.6657  0.7306
        2    0.5000  1.3343  0.2306
        2    0.5000  0.3343  1.2306
END


TILING
  NAME srs
  GROUP I4132
  FACES 10
     0.12500  0.12500 0.12500
    -0.12500  0.37500 0.12500
    -0.12500  0.62500 0.37500
    -0.37500  0.62500 0.62500
    -0.37500  0.37500 0.87500
    -0.12500  0.37500 1.12500
     0.12500  0.12500 1.12500
     0.37500  0.12500 0.87500
     0.37500 -0.12500 0.62500
     0.12500 -0.12500 0.37500
END


CRYSTAL
  ID    LTN
  # Group Fd-3m with first origin choice instead of second
  #     (likewise, use ":R" for rhombohedral setting, where applicable)
  GROUP "Fd-3m:1"
  CELL  35.622 35.622 35.622 90.000 90.000 90.000
  ATOM
    # If the first field in a line starts with a letter, it is assumed
    # to be a keyword, so in this example, the atom names need to be quoted.
    "SI1" 4 0.3112 0.2500 0.3727
    "SI2" 4 0.4345 0.2481 0.3721
    "SI3" 4 0.3897 0.3285 0.4532
    "SI4" 4 0.5396 0.3394 0.3996
END
`;

  for (const b of structures(input))
    console.log(JSON.stringify(b, null, 2));
}
