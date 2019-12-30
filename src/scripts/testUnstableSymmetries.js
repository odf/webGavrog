const fs = require('fs');

import * as pickler from '../common/pickler';
import { coordinateChangesQ } from '../geometry/types';
import * as periodic from '../pgraphs/periodic';
import * as symmetries from '../pgraphs/symmetries';
import * as io from '../io/cgd';

const ops = coordinateChangesQ;

const encode = pickler.serialize;
const decode = pickler.deserialize;


Array.prototype.toString = function() {
  return `${this.map(x => x.toString()).join(' ')}`;
};


for (const path of process.argv.slice(2)) {
  const text = fs.readFileSync(path, { encoding: 'utf8' });

  for (const { graph, name } of io.structures(text)) {
    console.log(name);
    console.log();

    const verts = periodic.vertices(graph);
    console.log(`vertices: ${verts}`);
    console.log();

    console.log('edges:');
    for (const e of graph.edges)
      console.log(`  ${e.head} ${e.tail}  ${e.shift}`);
    console.log();

    const pos = periodic.barycentricPlacement(graph);
    console.log('positions:');
    for (const v of verts)
      console.log(`  ${v} -> ${pos[v]}`);

    console.log();

    const adj = periodic.adjacencies(graph);
    if (verts.some(v => adj[v].length < 3))
      console.log(`graph ${name} has vertices with less than 3 incident edges`);
    else {
      const syms = symmetries.symmetriesUnstable(graph);
      console.log(`stationary symmetries:`);
      const I = ops.identityMatrix(graph.dim);
      for (const s of syms) {
        if (ops.eq(s.transform, I)) {
          const out = [];
          for (const v of verts) {
            if (s.src2img[v] != v)
              out.push(`${v} -> ${s.src2img[v]}`);
          }
          console.log(`  ${out.join(', ')}`);
        }
      }
    }

    console.log();
    console.log();
    console.log();
  }
}
