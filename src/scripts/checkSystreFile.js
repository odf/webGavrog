import * as fs from 'fs';

import * as cgd from '../io/cgd';
import * as periodic from '../pgraphs/periodic';
import * as symmetries from '../pgraphs/symmetries';


const reportSystreError = (errorType, message, writeInfo) => {
  writeInfo("==================================================");
  writeInfo(`!!! ERROR (${errorType}) - ${message}`);
  writeInfo("==================================================");
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
  const entry = lookup[cs];

  if (entry == null) {
    console.log(`${name}: not found`);
    lookup[cs] = { rcsr: [], cgd: [ name ] };
  }
  else {
    if (entry.rcsr.length > 1)
      console.log(`${name}: ambiguous (candidates ${entry.rcsr})`);
    else if (entry.rcsr[0] != name)
      console.log(`${name}: mismatch (found ${entry.rcsr[0]})`);
    else if (entry.cgd.length > 0)
      console.log(`${name}: duplicate`);
    else
      console.log(`${name}: ok!`);

    entry.cgd.push(name);
  }
}

const missing2d = Object.keys(lookup2d)
      .map(k => lookup2d[k])
      .filter(e => e.cgd.length == 0)
      .map(e => e.rcsr);

if (missing2d.length)
  console.log(`RCSR layers not in file: ${missing2d}`);

const missing3d = Object.keys(lookup3d)
      .map(k => lookup3d[k])
      .filter(e => e.cgd.length == 0)
      .map(e => e.rcsr);

if (missing3d.length)
  console.log(`RCSR nets not in file: ${missing3d}`);
