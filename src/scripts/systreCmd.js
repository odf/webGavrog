import * as csp from 'plexus-csp';

import { affineTransformationsQ } from '../geometry/types';
import * as sgtable from '../geometry/sgtable';
import { identifySpacegroup } from '../geometry/spacegroupFinder';
import * as periodic from '../pgraphs/periodic';
import * as symmetries from '../pgraphs/symmetries';
import { systreKey } from '../pgraphs/invariant';
import * as tilings from '../dsymbols/tilings';
import parseDSymbols from '../io/ds';
import * as cgd from '../io/cgd';


const V = affineTransformationsQ;

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


const nodeNameMapping = (
  nodes, nodeNames, translationOrbits, orbits, writeInfo
) => {
  if (nodeNames == null)
    nodeNames = nodes.map(v => v);

  const imageNode2Orbit = {};

  for (let i = 0; i < orbits.length; ++i) {
    for (const v of orbits[i])
      imageNode2Orbit[v] = i + 1;
  }

  const node2Image = {};

  if (translationOrbits) {
    for (let i = 0; i < translationOrbits.length; ++i) {
      for (const v of translationOrbits[i])
        node2Image[v] = i + 1;
    }
  }
  else {
    for (const v of nodes)
      node2Image[v] = v;
  }

  const orbit2name = {};
  const node2name = {};
  const mergedNames = [];
  const mergedNamesSeen = {};

  for (const i in nodes) {
    const v = nodes[i];
    const s = nodeNames[i];
    const name = typeof s == 'string' ? s : `Node ${s}`;
    const w = node2Image[v];
    const orbit = imageNode2Orbit[w];
    const oldName = orbit2name[orbit];

    if (oldName != null && oldName != name) {
      const pair = [name, oldName];
      if (!mergedNamesSeen[pair]) {
        mergedNames.push(pair);
        mergedNamesSeen[pair] = true;
      }
    }
    else
      orbit2name[orbit] = name;

    node2name[w] = orbit2name[orbit];
  }

  return [node2name, mergedNames];
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


const showSpaceGroup = (ops, givenGroup, writeInfo) => {
  const sgInfo = identifySpacegroup(ops);

  writeInfo(`   Ideal space group is ${sgInfo.groupName}.`);

  const givenName = sgtable.settingByName(givenGroup).name;

  if (sgInfo.groupName != givenName)
    writeInfo('   Ideal group or setting differs from given ' +
              `(${sgInfo.groupName} vs ${givenName}).`);

  if (sgInfo.extension == '1')
    writeInfo('     (using first origin choice)');
  else if (sgInfo.extension == '2')
    writeInfo('     (using second origin choice)');
  else if (sgInfo.extension == 'H')
    writeInfo('     (using hexagonal setting)');
  else if (sgInfo.extension == 'R')
    writeInfo('     (using rhombohedral setting)');

  writeInfo();
};


const showCoordinationSequences = (G, nodeOrbits, nodeToName, writeInfo) => {
  writeInfo('   Coordination sequences:');

  let cum = 0;
  let complete = true;

  for (const orbit of nodeOrbits) {
    const v = orbit[0];
    const cs = periodic.coordinationSeq(G, v, 10);
    let s = 1;
    const out = [`      Node ${nodeToName[v]}:   `];

    for (let i = 1; i <= 10; ++i) {
      if (s > 100000) {
        complete = false;
        out.push('...');
        break;
      }

      const x = cs[i];
      out.push(x);
      s += x;
    }

    cum += orbit.length * s;
    writeInfo(out.join(' '));
  }

  writeInfo();

  if (complete) {
    const td10 = cum / periodic.vertices(G).length;
    writeInfo(`   TD10 = ${Math.round(td10)}`);
  }
  else {
    writeInfo('   TD10 not computed.');
  }

  writeInfo();
}


export const processGraph = (
  graph,
  name,
  nodeNames,
  options,
  writeInfo=prefixedLineWriter(),
  writeData=prefixedLineWriter(),
  archives=[],
  outputArchiveFp=null
) => csp.go(function*() {
  showGraphBasics(graph, writeInfo);

  if (!checkGraph(graph, writeInfo))
    return;

  const { graph: G, orbits: translationOrbits } =
        symmetries.minimalImageWithOrbits(graph);

  if (G.edges.length < graph.edges.length) {
    const n = G.edges.length;
    const m = graph.edges.length;
    writeInfo(`   Ideal repeat unit smaller than given (${n} vs ${m} edges).`);
  }
  else
    writeInfo('   Given repeat unit is accurate.');

  const syms = symmetries.symmetries(G).symmetries;
  writeInfo(`   Point group has ${syms.length} elements.`);

  const orbits = symmetries.nodeOrbits(G, syms);
  writeInfo(`   ${pluralize(orbits.length, 'kind')} of node.`);
  writeInfo();

  const nodes = periodic.vertices(graph);
  const [nodeToName, mergedNames] =
        nodeNameMapping(nodes, nodeNames, translationOrbits, orbits, writeInfo);

  if (mergedNames.length) {
    writeInfo("   Equivalences for non-unique nodes:");
    for (const [oldName, newName] of mergedNames)
      writeInfo(`      ${oldName} --> ${newName}`);
    writeInfo();
  }

  showCoordinationSequences(G, orbits, nodeToName, writeInfo);

  const symOps = syms.map(phi => V.transposed(phi.transform));
  showSpaceGroup(symOps, group(graph), writeInfo);

  const key = systreKey(G);
  if (options.outputSystreKey) {
    writeInfo(`   Systre key: "${key}"`);
    writeInfo();
  }
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
                           input.nodeNames,
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
  Array.prototype.toString = function() {
    return '[' + this.map(x => x.toString()).join(',') + ']';
  };

  csp.top(csp.go(function*() {
    const data1 = `
#@ name bcu-tiling
<1.1:2 3:2,1 2,1 2,2:4,4 2,6>
#@ name locally-unstable
<1.1:5:2 3 5,1 3 4 5,4 5 3:3 8,8 3>
`;
    yield processData(data1, "x.ds", {}, prefixedLineWriter());

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

CRYSTAL
  NAME  nbo
  GROUP Im-3m
  CELL  2.00000 2.00000 2.00000 90.0000 90.0000 90.0000
  NODE  1 4  0.00000 0.00000 0.50000
  EDGE  0.00000 0.00000 0.50000   0.00000 0.50000 0.50000
END
`;
    yield processData(data2, "x.cgd", {}, prefixedLineWriter());
  }));
}
