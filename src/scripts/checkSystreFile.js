import * as fs from 'fs';

import * as cgd from '../io/cgd';
import * as periodic from '../pgraphs/periodic';
import * as symmetries from '../pgraphs/symmetries';


const cmp = (x, y) => (x > y) - (x < y);
const cmpLex = (xs, ys) => xs.map((x, i) => cmp(x, ys[i])).find(x => x) || 0;


const checkGraph = graph => {
  if (!periodic.isLocallyStable(graph))
    return 'next-nearest neighbor collisions';
  else if (symmetries.isLadder(graph))
    return 'non-crystallographic (ladder)';
  else if (periodic.hasSecondOrderCollisions(graph))
    return 'second-order collisions';
};


const makeCsLookup = path => {
  const data = JSON.parse(fs.readFileSync(path, { encoding: 'utf8' }));

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


const coordinationSequence = graph => {
  const G = symmetries.minimalImageWithOrbits(graph).graph;
  const syms = symmetries.symmetries(G).symmetries;

  const cs = symmetries.nodeOrbits(G, syms).map(
    ([v]) => Array.from(periodic.coordinationSeq(G, v, 10))
  );
  cs.sort(cmpLex);

  return cs;
};


const [inputPath, data2dPath, data3dPath] = process.argv.slice(2, 5);

const input = fs.readFileSync(inputPath, { encoding: 'utf8' });
const lookup2d = makeCsLookup(data2dPath);
const lookup3d = makeCsLookup(data3dPath);


for (const { graph, name } of cgd.structures(input)) {
  const msg = checkGraph(graph);

  if (msg)
    console.log(`${name}: Error - ${msg}`);
  else {
    const lookup = graph.dim == 2 ? lookup2d : lookup3d;
    const cs = coordinationSequence(graph);

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
}
