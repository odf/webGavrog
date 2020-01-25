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

    good = Object.values(periodic.incidences(G)).every(
      es => dim == ops.rank(es.map(e => periodic.edgeVector(e, pos)))
    );
  }

  if (good)
    console.log(`${ds}`);
});
