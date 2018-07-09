import { rationals } from '../arithmetic/types';
const ops = rationals;


const tokenizeLine = rawLine => {
  const line = rawLine.trim();

  const fields = [];
  let i = 0;

  while (i < line.length && line[i] != '#') {
    if (!line[i].trim()) {
      ++i;
      continue;
    }

    let j = i;
    if (line[i] == '"') {
      ++j;
      while (j < line.length - 1 && line[j] != '"')
        ++j;

      if (line[j] == '"')
        ++j;
      else {
        const msg = "the line ended in the middle of a quoted text";
        fields.push(line.slice(i) + '"');
        return { fields, start: i, pos: j, msg };
      }

      if (j < line.length && line[j].trim() && line[j] != '#') {
        const msg = "missing space after a quoted text";
        fields.push(line.slice(i, j));
        return { fields, start: i, pos: j, msg };
      }
    }
    else {
      while (j < line.length && line[j].trim() && line[j] != '#')
        ++j
    }

    if (j > i)
      fields.push(line.slice(i, j));
    i = j;
  }

  return { fields };
};


const parseToken = token => {
  if (token.match(/^".*"$/))
    return token.slice(1, -1);
  else if (token.match(/^\d+(\/\d+)?$/))
    return ops.rational(token);
  else if (token.match(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/))
    return parseFloat(token);
  else
    return token;
};


const newBlock = () => ({
  type: null,
  entriesInOrder: [],
  entriesByKey: {},
  start: null,
  end: null,
  errors: []
});


export function* parsedDataBlocks(lines, synonyms={}, defaultKey=null) {
  let lineno = 0;
  let block = null;
  let key = null;
  let originalKey = null;

  for (const line of lines) {
    ++lineno;

    if (block == null) {
      block = newBlock(lineno)
      key = defaultKey;
      originalKey = null;
    }

    const { fields, start, pos, msg } = tokenizeLine(line);
    if (msg)
      block.errors.push({ lineno, line, start, pos, msg });

    if (fields.length == 0)
      continue;

    const newKey = fields[0].toLowerCase();

    if (newKey == 'end') {
      block.end = lineno;
      yield block;
      block = null;
    }
    else if (block.type == null) {
      if (newKey.match(/^[a-z]/)) {
        block.start = lineno;
        block.type = newKey;
      }
      else {
        const msg = `extra data found before this block started`;
        block.errors.push({ lineno, line, msg });
      }
    }
    else {
      if (newKey.match(/^[a-z]/)) {
        if (synonyms[newKey]) {
          originalKey = newKey;
          key = synonyms[newKey];
        }
        else {
          originalKey = null;
          key = newKey;
        }

        fields.shift();
      }

      if (fields.length) {
        if (key) {
          const data = fields.map(parseToken);
          const entry = { lineno, line, originalKey, key, data };

          if (!block.entriesByKey[key])
            block.entriesByKey[key] = [];
          block.entriesByKey[key].push(entry);
          block.entriesInOrder.push(entry)
        }
        else {
          const msg = 'data found without a keyword saying what it means';
          block.errors.push({ lineno, line, msg });
        }
      }
    }
  }

  if (block) {
    const msg = 'the final block is missing an "end" statement';
    block.errors.push({ lineno, msg });
    yield block;
  }
};


if (require.main == module) {
  const testTokenizer = s => {
    console.log(`'${s}' =>`);
    console.log(`    ${JSON.stringify(tokenizeLine(s))}`);
  }

  testTokenizer('  s = "Hi there!" 123 asd fl # asdf  ');
  testTokenizer('  s = "Hi there!"');
  testTokenizer('  s = "Hi there!"a');
  testTokenizer('  s = "Hi there!');
  console.log();
  console.log();

  const testBlockParser = s => {
    console.log(`'${s}' => `);
    for (const block of parsedDataBlocks(s.split('\n'))) {
      console.log(JSON.stringify(block, null, 2));
      console.log();
    }
  }

  testBlockParser(`
FIRST
  Data 1 two 27/25
       3 four +27.25E-3
  Name "Gavrog"
  Data "some more" "s"a
END

SECOND
  456
END

123

THIRD
`);
}
