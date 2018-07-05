import * as csp from 'plexus-csp';

import { rationalLinearAlgebra } from '../arithmetic/types';
import * as periodic from '../pgraphs/periodic';
import * as symmetries from '../pgraphs/symmetries';
import * as tilings from '../dsymbols/tilings';
import parseDSymbols from '../io/ds';
import * as cgd from '../io/cgd';


const ops = rationalLinearAlgebra;

const pluralize = (n, s) => `${n} ${s}${n > 1 ? 's' : ''}`;


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


const nets = function*(data, fileName) {
  if (fileName.match(/\.(ds|tgs)$/))
    for (const t of parseDSymbols(data)) {
      const g = tilings.skeleton(tilings.makeCover(t.symbol));
      yield Object.assign({ warnings: [], errors: [] }, g, t);
    }
  else if (fileName.match(/\.(cgd|pgr)$/))
    for (const g of cgd.structures(data)) {
      yield g;
    }
};


const group = graph => graph.group || (graph.dim == 2 ? 'p1' : 'P1');

const showGraphBasics = (graph, writeInfo) => {
  writeInfo(`   Input structure described as ${graph.dim}-periodic.`);
  writeInfo(`   Given space group is ${group(graph)}.`);

  const nv = pluralize(periodic.vertices(graph).length, 'node');
  const ne = pluralize(graph.edges.length, 'edge');
  writeInfo(`   ${nv} and ${ne} in repeat unit as given.`);
  writeInfo();
};


const checkGraph = (graph, writeInfo) => {
  if (!periodic.isConnected(graph)) {
    const msg = ("Structure is disconnected."
                 + " Only connected structures are supported at this point.");
    reportSystreError("STRUCTURE", msg, writeInfo);
    return false;
  }

  if (!periodic.isLocallyStable(graph)) {
    const msg = ("Structure has collisions between next-nearest neighbors."
                 + " Systre does not currently support such structures.");
    reportSystreError("STRUCTURE", msg, writeInfo);
    return false;
  }

  if (symmetries.isLadder(graph)) {
    const msg = "Structure is non-crystallographic (a 'ladder')";
    reportSystreError("STRUCTURE", msg, writeInfo);
    return false;
  }

  if (periodic.hasSecondOrderCollisions(graph)) {
    const msg = ("Structure has second-order collisions."
                 + " Systre does not currently support such structures.");
    reportSystreError("STRUCTURE", msg, writeInfo);
    return false;
  }

  if (!periodic.isStable(graph)) {
    writeInfo("Structure has collisions.");
    writeInfo();
  }

  return true;
};


export const processGraph = (
  graph,
  name,
  options,
  writeInfo=prefixedLineWriter(),
  writeData=prefixedLineWriter(),
  archives=[],
  outputArchiveFp=null
) => csp.go(function*() {
  showGraphBasics(graph, writeInfo);

  if (!checkGraph(graph, writeInfo))
    return;

  const G = symmetries.minimalImage(graph);

  if (G.edges.length < graph.edges.length) {
    const n = G.edges.length;
    const m = graph.edges.length;
    writeInfo(`   Ideal repeat unit smaller than given (${n} vs ${m} edges).`);
  }
  else
    writeInfo('   Given repeat unit is accurate.');

  const ops = symmetries.symmetries(graph).symmetries;
  writeInfo(`   Point group has ${ops.length} elements.`);
});


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
  
  const inputs = nets(data, fileName);

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

    if (input.warnings.length) {
      for (const s of input.warnings)
        writeInfo(`   (${s})`);
      writeInfo();
    }

    for (const s of input.errors)
      reportSystreError('INPUT', s, writeInfo)

    if (input.errors.length == 0) {
      try {
        yield processGraph(input.graph,
                           input.name,
                           options,
                           writeInfo=writeInfo,
                           writeData=writeData,
                           archives=archives,
                           outputArchiveFp=outputArchiveFp)
      } catch(ex) {
        reportSystreError('INTERNAL', ex + '\n' + ex.stack, writeInfo);
      }
    }

    writeInfo(`Finished structure #${count} - "${name}".`);
  }

  writeInfo();
  writeInfo(`Finished data file "${fileName}".`);
});


if (require.main == module) {
  csp.top(csp.go(function*() {
    const data1 = `
#@ name bcu-tiling
<1.1:2 3:2,1 2,1 2,2:4,4 2,6>
#@ name locally-unstable
<1.1:5:2 3 5,1 3 4 5,4 5 3:3 8,8 3>
`;
    yield processData(data1, "x.ds", {});

    const data2 = `
PERIODIC_GRAPH
  NAME bcu-net
  EDGES
      1 1  1 -1 -1
      1 1  1 -1  0
      1 1  1  0 -1
      1 1  1  0  0
END

PERIODIC_GRAPH
  NAME ladder
  EDGES
      1 1  1 0
      1 1  0 1
      2 2  1 0
      2 2  0 1
      1 2  0 0
END

PERIODIC_GRAPH
  NAME unstable
  EDGES
      1 1  1 0
      2 2  0 1
      1 2  0 0
END

PERIODIC_GRAPH
  NAME second-order-unstable
  EDGES
      1 2  0 0
      1 2  1 0
      1 3  0 0
      1 3  0 1
      2 3  0 0
      2 3  0 1
      2 3 -1 0
      2 3 -1 1
      4 5  0 0
      4 5  1 0
      4 6  0 0
      4 6  0 1
      5 7  0 0
      5 7  0 1
      6 7  0 0
      6 7  1 0
      1 4  0 0
END

PERIODIC_GRAPH
  NAME non-minimal
  EDGES
      1 2  0 0
      1 2  0 1
      1 1  1 0
      2 2  1 0
END
`;
    yield processData(data2, "x.cgd", {});
  }));
}
