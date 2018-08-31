import { coordinateChangesQ } from './types';
import parseOperator from './parseOperator';
import spaceGroupData from '../data/sgtable';

const V = coordinateChangesQ;


const parseSpaceGroupData = data => {
  const lookup = [];
  const alias  = {};
  const table  = {};
  let canonicalName = null;
  let currentName = null;

  for (const line of data.split('\n')) {
    if (line.trim().length == 0 || line.trim()[0] == '#')
      continue;

    if (line[0] == ' ') {
      table[currentName].operators.push(parseOperator(line));
    }
    else {
      const fields = line.trim().split(/\s+/);

      if (fields[0].toLowerCase() == 'alias') {
        alias[fields[1]] = fields[2];
      }
      else if (fields[0].toLowerCase() == 'lookup') {
        lookup.push({
          name: fields[1],
          system: fields[2],
          centering: fields[3],
          fromStd: V.coordinateChange(
            parseOperator(fields.slice(4).join('')))
        });
      }
      else {
        const op = parseOperator(fields.slice(1).join(''));
        currentName = fields[0];

        if (V.eq(op, V.identityMatrix(V.dimension(op))))
          canonicalName = currentName;

        table[currentName] = {
          name: currentName,
          canonicalName,
          transform: V.coordinateChange(op),
          operators: []
        };
      }
    }
  }

  return { lookup, alias, table };
};


const { lookup, alias, table } = parseSpaceGroupData(spaceGroupData);


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


export const settingByName = (name, options = {}) => {
  const [rawBase, ...rest] = name.split(':');
  const base = alias[rawBase] || rawBase;
  const extension = rest.join(':').toUpperCase();

  if (extension && 'RH12'.split('').indexOf(extension) < 0)
    return { error: `Illegal extension ${extension} in group setting ${name}` };

  for (const name of candidates(base, extension, options)) {
    const entry = table[name];
    if (entry)
      return entry;
  }

  return { error: `Unrecognized group setting ${name}` };
};


export function* lookupSettings(crystalSystem, centeringType) {
  for (const { name, system, centering, fromStd } of lookup) {
    if (system == crystalSystem && centering == centeringType)
      yield { name, fromStd };
  }
};


export function* allSettings() {
  for (const name in table)
    yield table[name];
};


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const names = [
    'P1',
    'P211',
    'Pmn21',
    'R3',
    'R3:R',
    'Fd-3m',
    'Fd-3m:1'
  ];

  for (const key of names) {
    console.log();
    const entry = settingByName(key);
    console.log(`     name: ${entry.name}`);
    console.log(`canonical: ${entry.canonicalName}`);
    console.log(`transform: ${entry.transform}`);
    console.log(`operators: ${entry.operators[0]}`);
    entry.operators.slice(1).forEach(op => console.log(`           ${op}`));
  }
};
