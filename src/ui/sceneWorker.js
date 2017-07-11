import * as I from 'immutable';

import * as surface   from '../graphics/surface';
import * as delaney   from '../dsymbols/delaney';
import * as delaney3d from '../dsymbols/delaney3d';
import * as delaney2d from '../dsymbols/delaney2d';
import * as periodic  from '../pgraphs/periodic';

import embed from '../pgraphs/embedding';


const processedSolid = (t0, subDLevel) => {
  const t1 = surface.withFlattenedCenterFaces(t0);
  const t2 = I.Range(0, subDLevel).reduce(s => surface.subD(s), t1);
  const t3 = surface.insetAt(t2, 0.02, t2.isFixed);
  const t4 = surface.beveledAt(t3, 0.01, t2.isFixed);

  return surface.standardized(t4);
};


const handlers = {
  processSolid({ pos, faces, isFixed, subDLevel }) {
    const surfIn = {
      pos    : I.List(pos),
      faces  : I.fromJS(faces),
      isFixed: I.fromJS(isFixed)
    };

    const surfOut = processedSolid(surfIn, subDLevel);

    return {
      pos    : surfOut.pos.toJS(),
      faces  : surfOut.faces.toJS(),
      isFixed: surfOut.isFixed.toJS()
    };
  },

  processSolids(solidsIn) {
    return solidsIn.map(this.processSolid);
  },

  dsCover(dsTxt) {
    const ds = delaney.parse(dsTxt);

    const cov = delaney.dim(ds) == 3 ?
      delaney3d.pseudoToroidalCover(ds) :
      delaney2d.toroidalCover(ds);

    return `${cov}`;
  },

  embedding({ graphRepr, relax }) {
    return embed(periodic.fromObject(graphRepr), relax);
  }
};


onmessage = event => {
  const { id, input: { cmd, val } } = event.data;
  postMessage({ id, output: handlers[cmd](val), ok: true });
};
