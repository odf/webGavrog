import * as I from 'immutable';

import * as util from '../common/util';
import * as io from '../io/cgd';
import * as pgr from '../pgraphs/periodic';

import { rationalMatrices } from '../arithmetic/types';
import modularSolver from '../arithmetic/solveRational';

const fs = require('fs');

Array.prototype.toString = function() {
  return `${this.map(x => x.toString()).join(' ')}`;
};

const ops = rationalMatrices;


const barycentricPlacement = (graph, timers) => {
  timers && timers.start('barycentricPlacement');

  const adj   = pgr.adjacencies(graph);
  const verts = pgr.vertices(graph);
  const vIdcs = I.Map(I.Range(0, verts.size).map(i => [verts.get(i), i]));

  const n = verts.size;
  const d = graph.dim;
  let A = ops.matrix(n+1, n);
  let t = ops.matrix(n+1, d);

  verts.forEach((v, i) => {
    adj.get(v).forEach(c => {
      if (c.v != v) {
        const j = vIdcs.get(c.v);
        A[i][j] -= 1;
        A[i][i] += 1;
        t[i] = ops.plus(t[i], c.s);
      }
    });
  });
  A[n][0] = 1;

  const p = modularSolver(A.slice(1), t.slice(1), timers);

  const result = I.Map(I.Range(0, n).map(i => [verts.get(i), p[i]]));

  timers && timers.stop('barycentricPlacement');

  return result;
};


const timers = util.timers();


process.argv.slice(2).forEach(file => {
  const text = fs.readFileSync(file, { encoding: 'utf8' });

  for (const { graph, name } of io.structures(text)) {
    console.log(name);
    const pos = barycentricPlacement(graph, timers);
    for (const v of pgr.vertices(graph).sort((v, w) => v - w))
      console.log(`  ${v} ${pos.get(v)}`);
    console.log();
  }
});

console.log(`${JSON.stringify(timers.current(), null, 2)}`);
