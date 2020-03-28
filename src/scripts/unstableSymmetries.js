import * as fs from 'fs';

import {
  serialize as encode,
  deserialize as decode
} from '../common/pickler';

import { structures } from '../io/cgd';
import { vertices, barycentricPlacement } from '../pgraphs/periodic';
import { stationarySymmetries } from '../pgraphs/symmetries';
import { coordinateChangesQ as ops } from '../geometry/types';


Array.prototype.toString = function() {
  return `[${this.join(', ')}]`;
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

  for (const { graph, name } of structures(text)) {
    console.log(name);
    console.log();

    console.log('edges:');
    for (const e of graph.edges)
      console.log(`  ${e.head} ${e.tail}  ${e.shift.join(' ')}`);
    console.log();

    const verts = vertices(graph).sort((v, w) => ops.cmp(v, w));
    const pos = barycentricPlacement(graph);

    console.log('positions:');
    for (const v of verts)
      console.log(`  ${v} -> ${modZ(pos[v])} + ${idivZ(pos[v])}`);
    console.log();

    const { symmetries, complete } = stationarySymmetries(graph);

    console.log(`stationary symmetries:`);
    for (const { src2img } of symmetries) {
      const cs = cycles(src2img, verts);
      if (cs.length == 0)
        console.log('()');
      else
        console.log(cs.map(c => `(${c.join(',')})`).join(''));
    }

    if (!complete)
      console.log('...');

    console.log();
    console.log();
    console.log();
  }
}
