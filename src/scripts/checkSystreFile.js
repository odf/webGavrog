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


const [inputPath, data2dPath, data3dPath] = process.argv.slice(2, 5);

const data2d = JSON.parse(fs.readFileSync(data2dPath, { encoding: 'utf8' }));
const data3d = JSON.parse(fs.readFileSync(data3dPath, { encoding: 'utf8' }));

const input = fs.readFileSync(inputPath, { encoding: 'utf8' });

const writeInfo = msg => console.log("    #", msg);


for (const { graph, name } of cgd.structures(input)) {
  console.log(name);
  checkGraph(graph, writeInfo);

  const G = symmetries.minimalImageWithOrbits(graph).graph;
  const syms = symmetries.symmetries(G).symmetries;
  const nodeOrbits = symmetries.nodeOrbits(G, syms);

  const coordinationSequences = nodeOrbits.map(
    ([v]) => periodic.coordinationSeq(G, v, 10)
  );
  for (const cs of coordinationSequences)
    writeInfo(cs);
}
