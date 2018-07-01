import * as csp from 'plexus-csp';

import parseDSymbols from '../io/ds';
import { structures } from '../io/cgd';


export const prefixedLineWriter = (prefix='') => (s='') => {
  for (const line of s.split('\n'))
    console.log(`${prefix}${line}`);
};


const reportSystreError = (errorType, message, writeInfo) => {
  writeInfo("==================================================");
  writeInfo(`!!! ERROR (${errorType}) - ${message}`);
  writeInfo("==================================================");
  writeInfo();
};


export const processData = (
  data,
  fileName,
  options,
  writeInfo=prefixedLineWriter('## '),
  writeData=prefixedLineWriter(),
  archives=[],
  outputArchiveFp=null
) => csp.go(function*() {

  let count = 0;

  writeInfo(`Data file "${fileName}".`);
  
  let inputs = [];

  if (fileName.match(/\.(ds|tgs)$/))
    inputs = parseDSymbols(data);
  else if (fileName.match(/\.(cgd|pgr)$/))
    inputs = structures(data);

  for (const input of inputs) {
    writeInfo();
    if (count) {
      writeInfo();
      writeInfo();
    }

    const name = input.name || '-';
    count += 1;

    writeInfo(`Structure #${count} - "${name}".`);
    writeInfo();

    if (input.warnings && input.warnings.length) {
      for (const s of input.warnings)
        writeInfo(`   (${s})`);
      writeInfo();
    }

    for (const s of input.errors || [])
      reportSystreError('INPUT', s, writeInfo)

    if (input.errors && input.errors.length == 0) {
      // TODO process graph
    }

    writeInfo(`Finished structure #${count} - "${name}".`);
  }

  writeInfo();
  writeInfo(`Finished data file "${fileName}".`);
});


if (require.main == module) {
  csp.top(csp.go(function*() {
    const data1 = `
#@ name bcu
<1.1:2 3:2,1 2,1 2,2:4,4 2,6>`;
    
    yield processData(data1, "x.ds", {});

    const data2 = `
PERIODIC_GRAPH
  NAME bcu-net
  EDGES
      1   1     1 -1 -1
      1   1     1 -1  0
      1   1     1  0 -1
      1   1     1  0  0
END`;
    
    yield processData(data2, "x.cgd", {});
  }));
}
