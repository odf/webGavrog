import * as I  from 'immutable';

import { build } from './delaney';
import { invariant, partialOrientation } from './properties';


export function fromCyclicAdjencencies(adjs) {
  const v2ch = I.Map().asMutable();
  const e2ch = I.Map().asMutable();
  const ch2v = I.Map().asMutable();

  let nextch = 1;
  let ne = 0;

  for (const [v, a] of adjs) {
    v2ch.set(v, nextch);

    for (const w of a) {
      if (w == v)
        throw new Error(`found a loop at vertex ${v}`);
      if (w > v)
        ++ne;
      e2ch.set(I.List([v, w]), nextch);
      ch2v.set(nextch, v);
      ch2v.set(nextch+1, v);
      nextch += 2;
    }
  }

  const size = 4 * ne;
  const op = [ [], [], [] ];

  e2ch.forEach((D, [v, w]) => {
    const E = e2ch.get(I.List([w, v]));
    if (E == null)
      console.warn(`missing ${v} in adjacencies for ${w}`);
    op[0].push([D, E+1]);
  });

  for (const [v, a] of adjs) {
    const d = 2 * a.length;
    const D = v2ch.get(v);
    for (let i = 1; i < d; i += 2)
      op[1].push([D+i, D + (i+1)%d]);
  }

  for (let D = 1; D < size; D += 2)
    op[2].push([D, D+1]);

  const ds = build(
    2, size,
    (_, i) => op[i],
    (_, i) => I.Range(1, size+1).map(D => [D, 1])
  ); 

  return {
    symbol: ds,
    chamberToVertex: ch2v.asImmutable()
  };
};


const traceFaces = (ds, ch2v) => {
  const ori = partialOrientation(ds);
  const seen = {};
  const faces = [];

  for (const D of ds.elements()) {
    if (ori[D] < 0 || seen[D])
      continue;

    const newFace = [];
    let E = D;
    do {
      newFace.push(ch2v.get(E));
      seen[E] = true;
      E = ds.s(0, ds.s(1, E));
    } while (E != D);

    faces.push(newFace);
  }

  return faces;
};


if (require.main == module) {
  const fs = require('fs');
  const path = require('path');

  const { minimal } = require('./derived');

  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x.toString()).join(', ') + ' ]';
  };

  const symByInvariant = I.Map().asMutable();
  const minByInvariant = I.Map().asMutable();

  process.argv.slice(2).forEach(file => {
    const name = path.basename(file, '.txt')

    console.log();
    console.log();
    console.log(name);

    const text = fs.readFileSync(file, { encoding: 'utf8' });
    const adjs = text
      .split(/\n+/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim().split(/\s+/).map(f => parseInt(f)))
      .map(a => [a[0], a.slice(1)]);

    console.log();
    console.log(adjs);

    const { symbol: ds, chamberToVertex } = fromCyclicAdjencencies(adjs);

    minByInvariant.update(invariant(minimal(ds)), I.List(), a => a.push(name));
    symByInvariant.update(invariant(ds), I.List(), a => a.push(name));

    console.log();
    console.log(traceFaces(ds, chamberToVertex));
    console.log();
    console.log(`${ds}`);
    console.log();
    console.log(`${minimal(ds)}`);
  });

  console.log();
  console.log('Equivalence classes for maximal symmetry:');
  minByInvariant.valueSeq().forEach(a => console.log(`{ ${a.join(', ')} }`));

  console.log();
  console.log('Equivalence classes for given symmetry:');
  symByInvariant.valueSeq().forEach(a => console.log(`{ ${a.join(', ')} }`));
}
