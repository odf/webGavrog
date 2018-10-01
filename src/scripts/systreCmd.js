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
import { Archive } from '../io/archive';


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


export const processGraph = (
  input,
  options,
  archives=[],
  writeInfo=prefixedLineWriter(),
  writeData=prefixedLineWriter()
) => csp.go(function*() {
  const { graph, name, nodeNames } = input;
  const group = input.group || (graph.dim == 2 ? 'p1' : 'P1');

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
  showSpaceGroup(symOps, group, writeInfo);

  const key = systreKey(G);
  if (options.outputSystreKey) {
    writeInfo(`   Systre key: "${key}"`);
    writeInfo();
  }

  const countMatches = showAndCountGraphMatches(key, archives, writeInfo);

  if (countMatches == 0) {
    writeInfo("   Structure is new for this run.");
    writeInfo();
    archives.find(arc => arc.name == '__internal__').addNet(G, name);
  }

  writeInfo();
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
        yield processGraph(input,
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
  const fs = require('fs');
  const path = require('path');

  const args = process.argv.slice(2);
  const archiveFiles = args.filter(s => path.extname(s) == '.arc');
  const inputFiles = args.filter(s => path.extname(s) != '.arc');

  const archives = archiveFiles.map(name => {
    const archive = new Archive('test');
    archive.addAll(fs.readFileSync(name, { encoding: 'utf8' }));
    return archive;
  });

  archives.push(new Archive('__internal__'));

  const options = { skipWarnings: true };

  csp.top(csp.go(function*() {
    for (const name of inputFiles) {
      const data = fs.readFileSync(name, { encoding: 'utf8' });
      yield processData(data, name, options, archives, prefixedLineWriter());
    }
  }));
}
