import * as pickler  from '../common/pickler';
import * as surface  from '../graphics/surface';
import * as delaney  from '../dsymbols/delaney';
import * as tilings  from '../dsymbols/tilings';
import * as periodic from '../pgraphs/periodic';
import * as cgd      from '../io/cgd';

import embed         from '../pgraphs/embedding';


const handlers = {
  processSolids(solidsIn) {
    return solidsIn.map(({ pos, faces, isFixed, subDLevel }) => {
      const t1 = surface.withFlattenedCenterFaces({ pos, faces, isFixed });
      const t2 = Array(subDLevel).fill(0).reduce(s => surface.subD(s), t1);
      const t3 = surface.insetAt(t2, 0.02, t2.isFixed);
      return surface.beveledAt(t3, 0.01, t2.isFixed);
    });
  },

  dsCover(ds) {
    return tilings.makeCover(ds);
  },

  embedding({ graph, relax }) {
    return embed(graph, relax);
  },

  skeleton(cov) {
    return tilings.skeleton(cov);
  },

  tileSurfaces({ ds, cov, skel, pos, basis }) {
    return tilings.tileSurfaces(ds, cov, skel, pos, basis);
  },

  parseCGD(data) {
    const blocks = cgd.blocks(data);
    for (const b of blocks) {
      const spec = b.content.find(s => s.key == 'name');
      b.name = ((spec || {}).args || [])[0];
    }
    return blocks;
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
