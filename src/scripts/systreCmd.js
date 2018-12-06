import * as csp from 'plexus-csp';

import * as sgtable from '../geometry/sgtable';
import { identifySpacegroup } from '../geometry/spacegroupFinder';
import * as periodic from '../pgraphs/periodic';
import * as symmetries from '../pgraphs/symmetries';
import { systreKey } from '../pgraphs/invariant';
import { embeddingData } from '../pgraphs/embeddingData';
import * as tilings from '../dsymbols/tilings';
import parseDSymbols from '../io/ds';
import * as cgd from '../io/cgd';
import { Archive } from '../io/archive';


import {
  coordinateChangesQ,
  coordinateChangesF
} from '../geometry/types';

const opsQ = coordinateChangesQ;
const opsF = coordinateChangesF;


const pluralize = (n, s) => `${n} ${s}${n > 1 ? 's' : ''}`;


const prefixedLineWriter = (prefix='') => (s='') => {
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


const showGraphBasics = (graph, group, writeInfo) => {
  writeInfo(`   Input structure described as ${graph.dim}-periodic.`);
  writeInfo(`   Given space group is ${group}.`);

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
  else {
    const nodesSorted = nodes.sort((a, b) => {
      if (typeof a != typeof b)
        return (typeof a > typeof b) - (typeof a < typeof b);
      else
        return (a > b) - (a < b);
    });

    const t = {};
    for (const i in nodesSorted)
      t[nodesSorted[i]] = nodeNames[i];

    nodeNames = nodes.map(v => t[v]);
  }

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
    const name = nodeNames[i];
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


const showSpaceGroup = (sgInfo, givenGroup, writeInfo) => {
  if (sgInfo == null) {
    const msg = "Space group could not be identified.";
      reportSystreError("INTERNAL", msg, writeInfo);
    return;
  }

  writeInfo(`   Ideal space group is ${sgInfo.groupName}.`);

  const givenName = sgtable.settingByName(givenGroup).name;

  if (sgInfo.fullName != givenName)
    writeInfo('   Ideal group or setting differs from given ' +
              `(${sgInfo.fullName} vs ${givenName}).`);

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


const showAndCountGraphMatches = (key, archives, writeInfo) => {
  let count = 0;

  for (const arc of archives) {
    const name = arc.name;
    const found = arc.getByKey(key)

    if (found) {
      ++count;
      if (name == '__rcsr__')
        writeInfo('   Structure was identified with RCSR symbol:');
      else if (name == '__internal__')
        writeInfo('   Structure already seen in this run.');
      else
        writeInfo(`   Structure was found in archive "${name}":`);

      writeInfo(`       Name:            ${found.id}`);
      writeInfo();
    }
  }

  return count;
}


const affineSymmetries = (graph, syms) => {
  const I = opsQ.identityMatrix(graph.dim);
  const pos = periodic.barycentricPlacement(graph);
  const v = periodic.vertices(graph)[0];

  return syms.map(({ src2img, transform }) => {
    const s = opsQ.minus(pos[src2img[v]], opsQ.times(pos[v], transform));
    return opsQ.times(opsQ.affineTransformation(I, s),
                      opsQ.transposed(transform));
  });
}


const formatPoint = p => p.map(x => x.toFixed(5)).join(' ');


const showEmbedding = (
  {
    cellParameters,
    cellVolume,
    nodeReps,
    edgeReps,
    edgeStats,
    angleStats,
    posType,
    shortestSeparation,
    degreesOfFreedom
  },
  nodeToName,
  writeInfo
) => {
  if (cellParameters.length == 3) {
    const [a, b, gamma] = cellParameters;
    writeInfo(`   Relaxed cell parameters:`);
    writeInfo(`       a = ${a.toFixed(5)}, b = ${b.toFixed(5)}`);
    writeInfo(`       gamma = ${gamma.toFixed(4)}`);
  }
  else if (cellParameters.length == 6) {
    const [a, b, c, alpha, beta, gamma] = cellParameters;
    writeInfo(`   Relaxed cell parameters:`);
    writeInfo(`       ` +
              `a = ${a.toFixed(5)}, ` +
              `b = ${b.toFixed(5)}, ` +
              `c = ${c.toFixed(5)}`);
    writeInfo(`       ` +
              `alpha = ${alpha.toFixed(4)}, ` +
              `beta = ${beta.toFixed(4)}, ` +
              `gamma = ${gamma.toFixed(4)}`);
    writeInfo(`   Cell volume: ${cellVolume.toFixed(5)}`);
  }

  writeInfo(`   ${posType} positions:`);

  for (const [p, node] of nodeReps)
    writeInfo(`      Node ${nodeToName[node]}:    ${formatPoint(p)}`);

  writeInfo('   Edges:');
  for (const [p, v] of edgeReps)
    writeInfo(`      ${formatPoint(p)}  <->  ${formatPoint(opsF.plus(p, v))}`);

  writeInfo('   Edge centers:');
  for (const [p, v] of edgeReps)
    writeInfo(`      ${formatPoint(opsF.plus(p, opsF.times(0.5, v)))}`);

  writeInfo();

  const { minimum: emin, maximum: emax, average: eavg } = edgeStats;
  writeInfo('   Edge statistics: ' +
            `minimum = ${emin.toFixed(5)}, ` +
            `maximum = ${emax.toFixed(5)}, ` +
            `average = ${eavg.toFixed(5)}`);

  const { minimum: amin, maximum: amax, average: aavg } = angleStats;
  writeInfo('   Angle statistics: ' +
            `minimum = ${amin.toFixed(5)}, ` +
            `maximum = ${amax.toFixed(5)}, ` +
            `average = ${aavg.toFixed(5)}`);

  const d = shortestSeparation;
  writeInfo(`   Shortest non-bonded distance = ${d.toFixed(5)}`);
  writeInfo();

  writeInfo(`   Degrees of freedom: ${degreesOfFreedom}`);
  writeInfo();
};


const writeCgd = (
  name,
  group,
  { cellParameters, cellVolume, nodeReps, edgeReps, posType },
  nodeNames,
  degrees,
  writeData
) => {
  writeData('CRYSTAL');
  writeData(`  NAME ${name}`);
  writeData(`  GROUP ${group}`);
  writeData(`  CELL ${cellParameters.map(x => x.toFixed(5)).join(' ')}`);

  for (const [p, node] of nodeReps)
    writeData(`  NODE ${nodeNames[node]} ${degrees[node]}  ${formatPoint(p)}`);

  for (const [p, v] of edgeReps)
    writeData(`  EDGE  ${formatPoint(p)}   ${formatPoint(opsF.plus(p, v))}`);

  for (const [p, v] of edgeReps) {
    const c = formatPoint(opsF.plus(p, opsF.times(0.5, v)));
    writeData(`# EDGE_CENTER  ${c}`);
  }

  writeData('END');
};


const processDisconnectedGraph = (
  input,
  options,
  archives=[],
  writeInfo=prefixedLineWriter(),
  writeData=prefixedLineWriter()
) => csp.go(function*() {
  const { graph, name, nodeNames } = input;
  const group = input.group || (/*graph.dim == 2 ? 'p1' :*/ 'P1');

  showGraphBasics(graph, group, writeInfo);

  writeInfo("   Structure is not connected.");
  writeInfo("   Processing components separately.");
  writeInfo();

  // TODO implement this
});


const processGraph = (
  input,
  options,
  archives=[],
  writeInfo=prefixedLineWriter(),
  writeData=prefixedLineWriter()
) => csp.go(function*() {
  const { graph, name, nodes: originalNodes } = input;
  const group = input.group || (/*graph.dim == 2 ? 'p1' :*/ 'P1');

  showGraphBasics(graph, group, writeInfo);

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

  const nodeOrbits = symmetries.nodeOrbits(G, syms);
  writeInfo(`   ${pluralize(nodeOrbits.length, 'kind')} of node.`);
  writeInfo();

  const nodeNames = originalNodes && originalNodes.map(({ name }) => name);
  const nodes = periodic.vertices(graph);
  const [nodeToName, mergedNames] = nodeNameMapping(
    nodes, nodeNames, translationOrbits, nodeOrbits, writeInfo);

  if (mergedNames.length) {
    writeInfo("   Equivalences for non-unique nodes:");
    for (const [oldName, newName] of mergedNames)
      writeInfo(`      ${oldName} --> ${newName}`);
    writeInfo();
  }

  showCoordinationSequences(G, nodeOrbits, nodeToName, writeInfo);

  const symOps = affineSymmetries(G, syms);
  const sgInfo = identifySpacegroup(symOps);
  showSpaceGroup(sgInfo, group, writeInfo);

  const key = systreKey(G);
  if (options.outputSystreKey) {
    writeInfo(`   Systre key: "${key}"`);
    writeInfo();
  }

  const countMatches = showAndCountGraphMatches(key, archives, writeInfo);

  if (countMatches == 0) {
    writeInfo("   Structure is new for this run.");
    writeInfo();
    archives.find(arc => arc.name == '__internal__').addNet(G, name, key);
  }

  const data = embeddingData(G, sgInfo, syms, options);

  if (options.outputEmbedding)
    showEmbedding(data, nodeToName, writeInfo);

  if (options.outputCgd) {
    const adj = periodic.adjacencies(G);
    const degrees = {};
    for (const v of periodic.vertices(G))
      degrees[v] = adj[v].length;

    writeCgd(name, group, data, nodeToName, degrees, writeData);
  }
});


export const processData = (
  data,
  fileName,
  options,
  archives=[],
  writeInfo=prefixedLineWriter('## '),
  writeData=prefixedLineWriter()
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

    if (input.warnings.length && !options.skipWarnings) {
      for (const s of input.warnings)
        writeInfo(`   (${s})`);
      writeInfo();
    }

    for (const s of input.errors)
      reportSystreError('INPUT', s, writeInfo)

    if (input.errors.length == 0) {
      try {
        const process = periodic.isConnected(input.graph) ?
              processGraph : processDisconnectedGraph;

        yield process(input,
                      options,
                      archives=archives,
                      writeInfo=writeInfo,
                      writeData=writeData)
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
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const fs = require('fs');
  const path = require('path');

  const args = process.argv.slice(2);
  const archiveFiles = args.filter(s => path.extname(s) == '.arc');
  const inputFiles = args.filter(s => path.extname(s) != '.arc');

  const archives = archiveFiles.map(name => {
    const archive = new Archive(path.basename(name, '.arc'));
    archive.addAll(fs.readFileSync(name, { encoding: 'utf8' }));
    return archive;
  });

  archives.push(new Archive('__internal__'));

  const options = {
    outputEmbedding: true,
    relaxPositions: true,
    skipWarnings: true
  };

  csp.top(csp.go(function*() {
    for (const name of inputFiles) {
      const data = fs.readFileSync(name, { encoding: 'utf8' });
      yield processData(data, name, options, archives, prefixedLineWriter());
    }
  }));
}
