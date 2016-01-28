const parser = require('./sgtableParser');


const makeOperator = spec => {
  const d = spec.length;
  return spec.map(row => {
    const r = new Array(d).fill(0);
    for (const { i, f } of row)
      r[i-1] = f;
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


if (require.main == module) {
  const fs   = require('fs');
  const file = process.argv[2]
  const text = fs.readFileSync(file, { encoding: 'utf8' });

  const timer  = require('../common/util').timer();
  const raw    = parser.parse(text);
  const tparse = timer();
  const data   = cook(raw);
  const tcook  = timer();

  console.log(`${JSON.stringify(data, null, 2)}`);
  console.error(`Parsing time   : ${tparse} msec`);
  console.error(`Processing time: ${tcook} msec`);
};
