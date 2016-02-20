import * as fs from 'fs';

import * as DS       from '../dsymbols/delaney';
import * as periodic from '../pgraphs/periodic';

import tiling from '../dsymbols/tilings';

import { matrices } from '../arithmetic/types';
const ops = matrices;


const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text).forEach(function(ds) {
  const dim = DS.dim(ds);
  const G   = tiling(ds).graph;
  const pos = periodic.barycentricPlacement(G).map(v => v.toArray());

  const good = periodic.adjacencies(G).entrySeq().every(function(e) {
    const p = pos.get(e[0]);
    const neighbors =
      e[1].map(n => ops.minus(ops.plus(pos.get(n.v), n.s.toArray()), p));
    const A = neighbors.toArray();
    return ops.rank(A) == dim;
  });

  if (good)
    console.log(''+ds);
});
