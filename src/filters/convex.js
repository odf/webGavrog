import * as fs from 'fs';

import * as DS       from '../dsymbols/delaney';
import * as periodic from '../pgraphs/periodic';
import * as Q        from '../arithmetic/number';

import tiling from '../dsymbols/tilings';
import _M     from '../arithmetic/matrix';
import _V     from '../arithmetic/vector';

const M = _M(Q, 0, 1);
const V = _V(Q, 0);


const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text).forEach(function(ds) {
  const dim = DS.dim(ds);
  const G   = tiling(ds).graph;
  const pos = periodic.barycentricPlacement(G).map(V.make);

  const good = periodic.adjacencies(G).entrySeq().every(function(e) {
    const p = pos.get(e[0]);
    const neighbors =
      e[1].map(n => V.minus(V.plus(pos.get(n.v), V.make(n.s)), p));
    const A = M.make(neighbors.map(v => v.data));
    return M.rank(A) == dim;
  });

  if (good)
    console.log(''+ds);
});
