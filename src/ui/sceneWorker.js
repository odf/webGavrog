import '@babel/polyfill';

import * as pickler from '../common/pickler';
import * as delaney from '../dsymbols/delaney';
import * as tilings from '../dsymbols/tilings';
import * as cgd from '../io/cgd';
import * as periodic from '../pgraphs/periodic';
import * as surface from './surface';

import { coordinateChangesF as opsF } from '../geometry/types';
import { embed } from '../pgraphs/embedding';


const handlers = {
  embedding(graph) {
    return embed(graph);
  },

  dsCover(ds) {
    return tilings.makeCover(ds);
  },

  skeleton(cov) {
    return tilings.skeleton(cov);
  },

  tilesByTranslations({ ds, cov, skel }) {
    return tilings.tilesByTranslations(ds, cov, skel);
  },

  makeTileMeshes({
    cov, skel, pos, seeds, basis, subDLevel, edgeWidth
  }) {
    const templates = [];
    for (const surf of tilings.tileSurfaces(cov, skel, pos, seeds))
      templates.push({
        pos: surf.pos.map(v => opsF.times(v, basis)),
        faces: surf.faces,
        isFixed: surf.pos.map(_ => true)
      });

    const scale = 2.0 * surface.averageRadius(templates);

    const result = [];
    for (const template of templates) {
      let t = template;

      t = surface.withFlattenedCenterFaces(t);
      for (let i = 0; i < subDLevel; ++i)
        t = surface.subD(t);

      t = surface.tightened(t);

      const t1 = t;
      t = surface.insetAt(t, 0.05 * edgeWidth * scale, t1.isFixed);
      t = surface.beveledAt(t, 0.02 * edgeWidth * scale, t1.isFixed);

      t = surface.tightened(t);

      result.push(t);
    }

    return result;
  },

  parseCGD(data) {
    const blocks = Array.from(cgd.blocks(data));
    for (const b of blocks) {
      const spec = b.entries.find(s => s.key == 'name');
      b.name = ((spec || {}).args || [])[0];
    }
    return blocks;
  },

  processCGD(block) {
    return cgd.processed(block);
  }
};


onmessage = event => {
  const { id, input: { cmd, val } } = pickler.unpickle(event.data);

  let output = null, ok = false;

  try {
    output = handlers[cmd](val);
    ok = true;
  } catch (ex) {
    output = `${ex}\n${ex.stack}`;
    ok = false;
  }

  postMessage(pickler.pickle({ id, output, ok }));
};
