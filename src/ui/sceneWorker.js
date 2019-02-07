import 'babel-polyfill';

import * as pickler  from '../common/pickler';
import * as surface  from '../graphics/surface';
import * as delaney  from '../dsymbols/delaney';
import * as tilings  from '../dsymbols/tilings';
import * as periodic from '../pgraphs/periodic';
import * as cgd      from '../io/cgd';

import embed         from '../pgraphs/embedding';


const handlers = {
  processSolids(solidsIn) {
    const scale = 2.0 * surface.averageRadius(solidsIn);

    return solidsIn.map(({ pos, faces, isFixed, subDLevel }) => {
      let t = { pos, faces, isFixed };

      t = surface.withFlattenedCenterFaces(t);
      for (let i = 1; i < subDLevel; ++i)
        t = surface.subD(t);

      const t1 = t;
      t = surface.insetAt(t, 0.03 * scale, t1.isFixed);
      t = surface.beveledAt(t, 0.01 * scale, t1.isFixed);

      if (subDLevel > 0)
        t = surface.subD(t);

      return t;
    });
  },

  dsCover(ds) {
    return tilings.makeCover(ds);
  },

  embedding(graph) {
    return embed(graph);
  },

  skeleton(cov) {
    return tilings.skeleton(cov);
  },

  tilesByTranslations({ ds, cov, skel }) {
    return tilings.tilesByTranslations(ds, cov, skel);
  },

  tileSurfaces({ cov, skel, pos, seeds }) {
    return tilings.tileSurfaces(cov, skel, pos, seeds);
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
    console.log(ex);
    console.log(ex.stack);
  }

  postMessage(pickler.pickle({ id, output, ok }));
};
