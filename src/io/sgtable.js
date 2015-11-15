const parseFactor = s => {
  if (s == '' || s == '+')
    return 1;
  else if (s == '-')
    return -1;
  else {
    const parts = s.split('/');
    if (parts.length > 2)
      throw new Error(`bad fraction: ${s}`);
    else if (parts.length == 2)
      return { n: parseInt(parts[0]), d: parseInt(parts[1]) };
    else
      return parseInt(s);
  }
};


const parseComponent = (s, d) => {
  const summands = s.replace(/\s+/g, '').split(/([+-][^+-]*)/).filter(s => s);

  const result = Array(d+1).fill(0);
  summands.forEach(s => {
    if (s.match(/\*?[xyz]$/)) {
      const f = s.replace(/\*?[xyz]$/, '');
      result['xyz'.indexOf(s.slice(-1))] = parseFactor(f);
    }
    else
      result[d] = parseFactor(s);
  });

  return result;
};


const parseOperator = (s, options = {}) => {
  const components = s.trim().split(/\s*,\s*/);
  const d = components.length;
  return components.map(s => parseComponent(s, d));
};


export default function* entries(lines) {
  let current = null;

  for (const line of lines) {
    if (line.match(/^\s*(#.*)?$/))
      continue;

    if (line[0] == ' ') {
      if (current != null)
        current.operators.push(parseOperator(line, { modZ: true }));
      else
        throw new Error('symmetry operator without a group');
    } else {
      if (current) {
        yield current;
        current = null;
      }

      const fields = line.trim().split(/\s+/);
      if (fields[0].toLowerCase() == 'alias') {
        yield { type: 'alias', name: fields[1], fullName: fields[2] }
      }
      else if (fields[0].toLowerCase() == 'lookup') {
        const [name, system, centering, t] = fields.slice(1);
        const fromStd = parseOperator(t);
        yield { type: 'lookup', name, system, centering, fromStd };
      }
      else {
        const [name, t] = fields;
        const transform = parseOperator(t);
        current = { type: 'setting', name, transform, operators: [] };
      }
    }
  }

  if (current)
    yield current;
};


if (require.main == module) {
  const fs = require('fs');
  const file = process.argv[2]
  const lines = fs.readFileSync(file, { encoding: 'utf8' }).split(/\r?\n/);
  
  for (const e of entries(lines))
    console.log(JSON.stringify(e, null, 2));
};
