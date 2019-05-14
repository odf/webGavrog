import * as fs from 'fs';

import * as cgd from '../io/cgd';
import * as periodic from '../pgraphs/periodic';
import * as symmetries from '../pgraphs/symmetries';


const checkGraph = (graph, writeInfo) => {
  if (!periodic.isLocallyStable(graph)) {
    writeInfo('Error - next-nearest neighbor collisions');
    return false;
  }

  if (symmetries.isLadder(graph)) {
    writeInfo('Error - non-crystallographic (ladder)');
    return false;
  }

  if (periodic.hasSecondOrderCollisions(graph)) {
    writeInfo('Error - second-order collisions');
    return false;
  }

  return true;
};

const makeCsLookup = data => {
  const result = {};

  for (const { symbol, vertices } of data) {
    if (symbol.match(/-[bcz][*0-9]*$/))
      continue;

    const cs = vertices.map(v => v.coordinationSequence);
    cs.sort(cmpLex);

    if (result[cs] == null)
      result[cs] = { rcsr: [], cgd: [] };
    result[cs].rcsr.push(symbol);
    result[symbol] = cs;
  }

  return result;
};


const cmp = (x, y) => (x > y) - (x < y);
const cmpLex = (xs, ys) => xs.map((x, i) => cmp(x, ys[i])).find(x => x) || 0;


const [inputPath, data2dPath, data3dPath] = process.argv.slice(2, 5);

const data2d = JSON.parse(fs.readFileSync(data2dPath, { encoding: 'utf8' }));
const data3d = JSON.parse(fs.readFileSync(data3dPath, { encoding: 'utf8' }));

const input = fs.readFileSync(inputPath, { encoding: 'utf8' });

const lookup2d = makeCsLookup(data2d);
const lookup3d = makeCsLookup(data3d);


for (const { graph, name } of cgd.structures(input)) {
  const ok = checkGraph(graph, msg => console.log(`${name}: ${msg}`));
  if (!ok)
    continue;

  const G = symmetries.minimalImageWithOrbits(graph).graph;
  const syms = symmetries.symmetries(G).symmetries;
  const nodeOrbits = symmetries.nodeOrbits(G, syms);

  const cs = nodeOrbits.map(
    ([v]) => periodic.coordinationSeq(G, v, 10).slice(1)
  );
  cs.sort(cmpLex);

  const lookup = G.dim == 2 ? lookup2d : lookup3d;
  if (lookup[cs] == null)
    lookup[cs] = { rcsr: [], cgd: [] };

  const entry = lookup[cs];

  if (entry.cgd.indexOf(name) >= 0)
    console.log(`${name}: duplicate`);
  else if (entry.rcsr.indexOf(name) >= 0)
    console.log(`${name}: ok!`);
  else {
    if (entry.rcsr.length == 0)
      console.log(`${name}: does not match anything`);
    else
      console.log(`${name}: mismatch (found ${entry.rcsr})`);

    for (const seq of cs)
      console.log('    ' + seq);

    if (lookup[name]) {
      console.log(`  RCSR entry for '${name}' has:`);
      for (const seq of lookup[name])
        console.log('    ' + seq);
    }
  }

  entry.cgd.push(name);
}
