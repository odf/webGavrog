const parser = require('./sgtableParser');
const ops = require('../arithmetic/types').rationals;


const makeOperator = spec => {
  const d = spec.length;
  return spec.map(row => {
    const r = new Array(d).fill(0);
    for (const { i, f } of row)
      r[i-1] = typeof f == 'number' ? f : ops.div(f.n, f.d);
    return r;
  });
};


const cook = rawData => {
  const lookup = [];
  const alias  = {};
  const table  = {};

  for (const entry of rawData) {
    const { type, name } = entry;

    if (type == 'alias') {
      alias[name] = entry.fullName;
    }
    else if (type == 'lookup') {
      lookup.push({
        name,
        system    : entry.system,
        centering : entry.centering,
        fromStd   : makeOperator(entry.fromStd)
      });
    }
    else if (type == 'setting') {
      table[name] = {
        transform: makeOperator(entry.transform),
        operators: entry.operators.map(makeOperator)
      };
    }
    else
      throw new Error(`unknown entry type ${type}`);
  }

  return { lookup, alias, table };
};


export default function parse(text) {
  return cook(parser.parse(text));
};


if (require.main == module) {
  const fs   = require('fs');
  const file = process.argv[2]
  const text = fs.readFileSync(file, { encoding: 'utf8' });

  const timer = require('../common/util').timer();
  const data  = parse(text);
  const t     = timer();

  console.log(`${JSON.stringify(data, null, 2)}`);
  console.error(`Processing time: ${t} msec`);
};
