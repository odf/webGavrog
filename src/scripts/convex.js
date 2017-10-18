import * as fs from 'fs';

import * as DS       from '../dsymbols/delaney';
import * as periodic from '../pgraphs/periodic';
import * as tilings  from '../dsymbols/tilings';

import { rationalLinearAlgebra } from '../arithmetic/types';
const ops = rationalLinearAlgebra


const text = fs.readFileSync(process.argv[2], { encoding: 'utf8' });

DS.parseSymbols(text).forEach(function(ds) {
  let good = false;

  if (ds.elements().every(D => DS.m(ds, 0, 1, D) >= 3)) {
    const dim = DS.dim(ds);
    const G   = tilings.skeleton(tilings.makeCover(ds)).graph;
    const pos = periodic.barycentricPlacement(G);

    good = Object.entries(periodic.adjacencies(G)).every(function(e) {
      const p = pos.get(e[0]);
      const nbrs = e[1].map(n => ops.minus(ops.plus(pos.get(n.v), n.s), p));
      return ops.rank(nbrs) == dim;
    });
  }

  if (good)
    console.log(`${ds}`);
});
