const parser = require('./sgtableParser');


if (require.main == module) {
  const fs   = require('fs');
  const file = process.argv[2]
  const text = fs.readFileSync(file, { encoding: 'utf8' });

  try {
    console.log(`${JSON.stringify(parser.parse(text), null, 2)}`);
  } catch(ex) {
    console.error(ex);
  }
};
