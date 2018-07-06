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
      else
        return { fields, start: i, pos: j, msg: "no closing quotes" };

      if (j < line.length && line[j].trim() && line[j] != '#')
        return { fields, start: i, pos: j, msg: "missing space after string" };
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


if (require.main == module) {
  const testTokenizer = s => {
    console.log(`'${s}' =>`);
    console.log(`    ${JSON.stringify(tokenizeLine(s))}`);
  }

  testTokenizer('  s = "Hi there!" 123 asd fl # asdf  ');
  testTokenizer('  s = "Hi there!"');
  testTokenizer('  s = "Hi there!"a');
  testTokenizer('  s = "Hi there!');
}
