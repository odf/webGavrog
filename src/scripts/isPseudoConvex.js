import * as fs from 'fs';
import * as readline from 'readline';

import { parse } from '../dsymbols/delaney';
import { isPseudoConvex } from '../dsymbols/delaney2d';


const reader = readline.createInterface({
  input: fs.createReadStream(process.argv[2], { encoding: 'utf8' }),
  crlfDelay: Infinity
});


reader.on('line', line => {
  if (line.match(/^\s*</)) {
    if (isPseudoConvex(parse(line)))
      console.log(line);
  }
});
