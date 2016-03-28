const parser = require('./sgtableParser');
const ops = require('../geometry/types').affineTransformations;


const makeOperator = spec => {
  const d = spec.length;
  const M = ops.matrix(d, d);
  const t = ops.vector(d);

  spec.forEach((row, k) => {
    row.forEach(({i, f}) => {
      const x = typeof f == 'number' ? f : ops.div(f.n, f.d);
      if (i == 0)
        t[k] = x;
      else
        M[k][i-1] = x;
    })
  });

  return ops.affineTransformation(M, t);
};


const postProcess = rawData => {
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


const candidates = (base, extension, options) => {
  if (base[0] == 'R') {
    if (extension == 'R')
      return [`${base}:R`];
    else if (extension == 'H')
      return [`${base}:H`];
    else if (options.preferRhombohedral)
      return [`${base}:R`, `${base}:H`];
    else
      return [`${base}:H`, `${base}:R`];
  }
  else if (extension == '1')
    return [`${base}:1`, base];
  else if (extension == '2')
    return [`${base}:2`, base];
  else if (options.preferFirstOrigin)
    return [base, `${base}:1`, `${base}:2`];
  else
    return [base, `${base}:2`, `${base}:1`];
};


const _settingByName = (name, alias, table, options = {}) => {
  const [rawBase, ...rest] = name.split(':');
  const base = alias[rawBase] || rawBase;
  const extension = rest.join(':').toUpperCase();

  if (extension && 'RH12'.split('').indexOf(extension) < 0)
    return { error: `Illegal extension ${extension} in group setting ${name}` };

  for (const name of candidates(base, extension, options)) {
    const { transform, operators } = table[name] || {};
    if (operators)
      return { name, transform, operators };
  }

  return { error: `Unrecognized group setting ${name}` };
};


const { lookup, alias, table } =
  postProcess(parser.parse(require('../data/sgtable').default));


export const settingByName = (name, options = {}) =>
  _settingByName(name, alias, table, options);


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const names = [
    'P1',
    'Pmn21',
    'R3',
    'R3:R',
    'Fd-3m',
    'Fd-3m:1'
  ];

  for (const key of names) {
    console.log();
    const { name, transform, operators } = settingByName(key);
    console.log(`     name: ${name}`);
    console.log(`transform: ${transform}`);
    console.log(`operators: ${operators[0]}`);
    operators.slice(1).forEach(op => console.log(`           ${op}`));
  }
};
