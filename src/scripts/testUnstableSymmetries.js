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

const modZ = v => v.map(x => ops.mod(x, 1));
const idivZ = v => v.map(x => ops.idiv(x, 1));


const cycles = (perm, verts) => {
  const res = [];
  const seen = {};

  for (const v of verts) {
    if (!seen[v]) {
      const c = [v];
      seen[v] = true;

      let w = perm[v];
      while (w != v) {
        c.push(w);
        seen[w] = true;
        w = perm[w];
      }

      if (c.length > 1)
        res.push(c);
    }
  }

  return res;
};


for (const path of process.argv.slice(2)) {
  const text = fs.readFileSync(path, { encoding: 'utf8' });

  for (const { graph, name } of io.structures(text)) {
    console.log(name);
    console.log();

    const verts = periodic.vertices(graph).sort((v, w) => ops.cmp(v, w));
    console.log(`vertices: ${verts}`);
    console.log();

    console.log('edges:');
    for (const e of graph.edges)
      console.log(`  ${e.head} ${e.tail}  ${e.shift}`);
    console.log();

    const pos = periodic.barycentricPlacement(graph);
    console.log('positions:');
    for (const v of verts)
      console.log(`  ${v} -> ${modZ(pos[v])} + ${idivZ(pos[v])}`);

    console.log();

    const adj = periodic.adjacencies(graph);
    if (verts.some(v => adj[v].length < 3))
      console.log(`graph ${name} has vertices with less than 3 incident edges`);
    else {
      console.log(`stationary symmetries:`);

      for (const s of symmetries.stationarySymmetries(graph)) {
        const cs = cycles(s.src2img, verts);
        if (cs.length == 0)
          console.log('()');
        else
          console.log(cs.map(c => `(${c.join(',')})`).join(''));
      }
    }

    console.log();
    console.log();
    console.log();
  }
}
