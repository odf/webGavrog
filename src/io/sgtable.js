const parser = require('./sgtableParser');


if (require.main == module) {
  const fs   = require('fs');
  const file = process.argv[2]
  const text = fs.readFileSync(file, { encoding: 'utf8' });

  const timer = require('../common/util').timer();
  const data  = parser.parse(text);
  const time  = timer();

  try {
    console.log(`${JSON.stringify(data, null, 2)}`);
  } catch(ex) {
    console.error(ex);
  }

  console.log(`Parsing time: ${time} msec`);
};
