import * as csp from 'plexus-csp';

import * as tilings from '../dsymbols/tilings';
import { coordinateChangesF as opsF } from '../geometry/types';
import { Archive } from '../io/archive';
import { structures } from '../io/cgd';
import parseDSymbols from '../io/ds';
import embed from '../pgraphs/embedding';
import { embeddingData } from '../pgraphs/embeddingData';
import { systreKey } from '../pgraphs/invariant';
import * as periodic from '../pgraphs/periodic';
import * as symmetries from '../pgraphs/symmetries';
import { settingByName } from '../spacegroups/sgtable';
import { identifySpacegroup } from '../spacegroups/spacegroupFinder';


const pluralize = (n, s) => `${n} ${s}${n > 1 ? 's' : ''}`;
const formatPoint = p => p.map(x => x.toFixed(5)).join(' ');


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
    yield* structures(data);
};


const showGraphBasics = (graph, group, writeInfo) => {
  writeInfo(`   Input structure described as ${graph.dim}-periodic.`);
  writeInfo(`   Given space group is ${group}.`);

  const nv = pluralize(periodic.vertices(graph).length, 'node');
  const ne = pluralize(graph.edges.length, 'edge');
  writeInfo(`   ${nv} and ${ne} in repeat unit as given.`);
  writeInfo();
};


const checkGraph = (graph, writeInfo) => {
  if (!periodic.isLocallyStable(graph)) {
    const msg = ("Structure has collisions between next-nearest neighbors."
                 + " Systre does not currently support such structures.");
    reportSystreError("STRUCTURE", msg, writeInfo);
    return false;
  }

  if (symmetries.isLadder(graph)) {
    writeInfo("   Structure is non-crystallographic (a 'ladder')");
    writeInfo();
  }
  else if (periodic.hasSecondOrderCollisions(graph)) {
    writeInfo("   Structure has second-order collisions.");
    writeInfo();
  }
  else if (!periodic.isStable(graph)) {
    writeInfo("   Structure has collisions.");
    writeInfo();
  }

  return true;
};


const nodeNameMapping = (nodes, originalNodes, translationOrbits, orbits) => {
  // TODO simplify once we no longer try to exactly match Java Systre

  const originalNodeNames = {};
  if (originalNodes) {
    const nodesSorted = nodes.sort((a, b) => (a > b) - (a < b));
    for (const i in nodesSorted)
      originalNodeNames[nodesSorted[i]] = originalNodes[i].name;
  }
  else {
    for (const v of nodes)
      originalNodeNames[v] = v;
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

  const imageNode2Orbit = {};
  for (let i = 0; i < orbits.length; ++i) {
    for (const v of orbits[i])
      imageNode2Orbit[v] = i + 1;
  }

  const orbit2name = {};
  const node2name = {};
  for (const v of nodes) {
    const w = node2Image[v];
    const orbit = imageNode2Orbit[w];

    if (orbit2name[orbit] == null)
      orbit2name[orbit] = originalNodeNames[v];
    node2name[w] = orbit2name[orbit];
  }

  const mergedNames = {};
  for (const v of nodes) {
    const pair = [originalNodeNames[v], node2name[node2Image[v]]];
    if (pair[0] != pair[1])
      mergedNames[pair] = pair;
  }

  return [node2name, Object.values(mergedNames)];
};


const showCoordinationSequences = (G, nodeOrbits, nodeToName, writeInfo) => {
  writeInfo('   Coordination sequences:');

  let cum = 0;
  let complete = true;

  for (const orbit of nodeOrbits) {
    const v = orbit[0];
    const out = [`      Node ${nodeToName[v]}:   `];

    let s = 1;
    for (const x of periodic.coordinationSeq(G, v, 10)) {
      out.push(x);
      s += x;

      if (s > 100000) {
        complete = false;
        out.push('...');
        break;
      }
    }

    cum += orbit.length * s;
    writeInfo(out.join(' '));
  }

  writeInfo();

  if (complete) {
    const td10 = cum / periodic.vertices(G).length;
    writeInfo(`   TD10 = ${Math.round(td10)}`);
  }
  else
    writeInfo('   TD10 not computed.');

  writeInfo();
}


const showSpaceGroup = (sgInfo, givenGroup, writeInfo) => {
  if (sgInfo == null) {
    const msg = "Space group could not be identified.";
    reportSystreError("INTERNAL", msg, writeInfo);
    return;
  }
  writeInfo(`   Ideal space group is ${sgInfo.groupName}.`);

  const givenName = settingByName(givenGroup).name;
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


const findAndReportMatches = (graph, name, archives, options, writeInfo) => {
  const key = systreKey(graph);
  if (options.outputSystreKey) {
    writeInfo(`   Systre key: "${key}"`);
    writeInfo();
  }

  let count = 0;
  for (const arc of archives) {
    const found = arc.getByKey(key);

    if (found) {
      ++count;
      if (arc.name == '__rcsr__')
        writeInfo('   Structure was identified with RCSR symbol:');
      else if (arc.name == '__internal__')
        writeInfo('   Structure already seen in this run.');
      else
        writeInfo(`   Structure was found in archive "${arc.name}":`);

      writeInfo(`       Name:            ${found.id}`);
      writeInfo();
    }
  }

  if (count == 0) {
    writeInfo("   Structure is new for this run.");
    writeInfo();
    archives.find(arc => arc.name == '__internal__').addNet(graph, name, key);
  }
}


const showEmbedding = (data, nodeToName, isRelaxed, writeInfo) => {
  if (data.cellParameters.length == 3) {
    const [a, b, gamma] = data.cellParameters;
    writeInfo(`   Relaxed cell parameters:`);
    writeInfo(`       a = ${a.toFixed(5)}, b = ${b.toFixed(5)}`);
    writeInfo(`       gamma = ${gamma.toFixed(4)}`);
  }
  else if (data.cellParameters.length == 6) {
    const [a, b, c, alpha, beta, gamma] = data.cellParameters;
    writeInfo(`   Relaxed cell parameters:`);
    writeInfo(`       ` +
              `a = ${a.toFixed(5)}, ` +
              `b = ${b.toFixed(5)}, ` +
              `c = ${c.toFixed(5)}`);
    writeInfo(`       ` +
              `alpha = ${alpha.toFixed(4)}, ` +
              `beta = ${beta.toFixed(4)}, ` +
              `gamma = ${gamma.toFixed(4)}`);
    writeInfo(`   Cell volume: ${data.cellVolume.toFixed(5)}`);
  }

  const posType = isRelaxed ? 'Relaxed' : 'Barycentric';
  writeInfo(`   ${posType} positions:`);

  for (const [p, node] of data.nodeReps)
    writeInfo(`      Node ${nodeToName[node]}:    ${formatPoint(p)}`);

  writeInfo('   Edges:');
  for (const [p, v] of data.edgeReps)
    writeInfo(`      ${formatPoint(p)}  <->  ${formatPoint(opsF.plus(p, v))}`);

  writeInfo('   Edge centers:');
  for (const [p, v] of data.edgeReps)
    writeInfo(`      ${formatPoint(opsF.plus(p, opsF.times(0.5, v)))}`);

  writeInfo();

  const { minimum: emin, maximum: emax, average: eavg } = data.edgeStats;
  writeInfo('   Edge statistics: ' +
            `minimum = ${emin.toFixed(5)}, ` +
            `maximum = ${emax.toFixed(5)}, ` +
            `average = ${eavg.toFixed(5)}`);

  const { minimum: amin, maximum: amax, average: aavg } = data.angleStats;
  writeInfo('   Angle statistics: ' +
            `minimum = ${amin.toFixed(5)}, ` +
            `maximum = ${amax.toFixed(5)}, ` +
            `average = ${aavg.toFixed(5)}`);

  const d = data.shortestSeparation;
  writeInfo(`   Shortest non-bonded distance = ${d.toFixed(5)}`);
  writeInfo();

  writeInfo(`   Degrees of freedom: ${data.degreesOfFreedom}`);
  writeInfo();
};


const writeCgd = (name, group, data, nodeNames, degrees, writeData) => {
  writeData('CRYSTAL');
  writeData(`  NAME ${name}`);
  writeData(`  GROUP ${group}`);
  writeData(`  CELL ${data.cellParameters.map(x => x.toFixed(5)).join(' ')}`);

  for (const [p, node] of data.nodeReps)
    writeData(`  NODE ${nodeNames[node]} ${degrees[node]}  ${formatPoint(p)}`);

  for (const [p, v] of data.edgeReps)
    writeData(`  EDGE  ${formatPoint(p)}   ${formatPoint(opsF.plus(p, v))}`);

  for (const [p, v] of data.edgeReps) {
    const c = formatPoint(opsF.plus(p, opsF.times(0.5, v)));
    writeData(`# EDGE_CENTER  ${c}`);
  }

  writeData('END');
};


const processDisconnectedGraph = (
  input, options, archives, writeInfo, writeData
) => csp.go(function*() {
  showGraphBasics(input.graph, input.group || 'P1', writeInfo);

  writeInfo('   Structure is not connected.');
  writeInfo('   Processing components separately.');
  writeInfo();
  writeInfo('   ==========');

  const components = periodic.connectedComponents(input.graph);
  for (let i = 1; i <= components.length; ++i) {
    const comp = components[i - 1];
    writeInfo(`   Processing component ${i}`);

    if (comp.graph.dim < input.graph.dim)
      writeInfo(`      dimension = ${comp.graph.dim}`);
    else
      writeInfo(`      multiplicity = ${comp.multiplicity}`);

    yield processGraph(
      { graph: comp.graph, name: `${input.name}_component_${i}` },
      options, archives, writeInfo, writeData
    );

    writeInfo();
    writeInfo(`   Finished component ${i}`);
    writeInfo();
    writeInfo(`   ==========`);
  }
});


const processGraph = (
  input, options, archives, writeInfo, writeData
) => csp.go(function*() {
  const group = input.group || 'P1';

  showGraphBasics(input.graph, group, writeInfo);

  if (!checkGraph(input.graph, writeInfo))
    return;

  const image = symmetries.minimalImageWithOrbits(input.graph);
  const G = image.graph;

  if (G.edges.length < input.graph.edges.length) {
    const n = G.edges.length;
    const m = input.graph.edges.length;
    writeInfo(`   Ideal repeat unit smaller than given (${n} vs ${m} edges).`);
  }
  else
    writeInfo('   Given repeat unit is accurate.');

  const syms = symmetries.symmetries(G).symmetries;
  writeInfo(`   Point group has ${syms.length} elements.`);

  const nodeOrbits = symmetries.nodeOrbits(G, syms);
  nodeOrbits.sort((a, b) => a[0] - b[0]);

  writeInfo(`   ${pluralize(nodeOrbits.length, 'kind')} of node.`);
  writeInfo();

  const [nodeToName, mergedNames] = nodeNameMapping(
    periodic.vertices(input.graph), input.nodes, image.orbits, nodeOrbits
  );

  if (mergedNames.length) {
    writeInfo("   Equivalences for non-unique nodes:");
    for (const [oldName, newName] of mergedNames)
      writeInfo(`      ${oldName} --> ${newName}`);
    writeInfo();
  }

  showCoordinationSequences(G, nodeOrbits, nodeToName, writeInfo);

  if (!symmetries.isLadder(G)) {
    const symOps = symmetries.affineSymmetries(G, syms);
    const sgInfo = identifySpacegroup(symOps);
    showSpaceGroup(sgInfo, group, writeInfo);
  }

  findAndReportMatches(G, input.name, archives, options, writeInfo);

  if (!symmetries.isLadder(G)) {
    const eOut = embed(G);
    const embedding = options.relaxPositions ? eOut.relaxed : eOut.barycentric;
    const data = embeddingData(G, sgInfo.toStd, syms, embedding);

    if (options.outputEmbedding)
      showEmbedding(data, nodeToName, options.relaxPositions, writeInfo);

    if (options.outputCgd) {
      const degrees = {};
      for (const v of periodic.vertices(G))
        degrees[v] = periodic.incidences(G)[v].length;

      writeCgd(
        input.name, sgInfo.groupName, data, nodeToName, degrees, writeData
      );
    }
  }
});


export const processData = (
  data, fileName, options, archives, writeInfo, writeData
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

        yield process(input, options, archives, writeInfo, writeData)
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

  const lineWriter = (s='') => {
    for (const line of s.split('\n'))
      console.log(`${line}`);
  };

  csp.top(csp.go(function*() {
    for (const name of inputFiles) {
      const data = fs.readFileSync(name, { encoding: 'utf8' });
      yield processData(data, name, options, archives, lineWriter, lineWriter);
    }
  }));
}
