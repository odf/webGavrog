import * as I from 'immutable';

import * as R from '../arithmetic/float';
import _V     from '../arithmetic/vector';

const V = _V(R, 0);

import * as surface   from '../geometry/surface';
import * as delaney   from '../dsymbols/delaney';
import * as delaney3d from '../dsymbols/delaney3d';
import * as util      from '../common/util';


const processedSolid = t0 => {
  const t1 = surface.withFlattenedCenterFaces(t0);
  const t2 = I.Range(0, 2).reduce(s => surface.subD(s), t1);
  const t3 = surface.insetAt(t2, 0.03, t2.isFixed);
  const t4 = surface.beveledAt(t3, 0.015, t2.isFixed);

  const isCorner = I.Range(0, t4.pos.size).map(i => i >= t3.pos.size);
  const t5 = surface.beveledAt(t4, 0.005, isCorner);

  return t4;
};


const handlers = {
  processSolid({ pos, faces, isFixed }) {
    const surfIn = {
      pos    : I.fromJS(pos).map(V.make),
      faces  : I.fromJS(faces),
      isFixed: I.fromJS(isFixed)
    };

    const t = util.timer();
    const surfOut = processedSolid(surfIn);
    console.log(`${Math.round(t())} msec in total to process the surfaces`);

    return {
      pos    : surfOut.pos.map(v => v.data).toJS(),
      faces  : surfOut.faces.toJS(),
      isFixed: surfOut.isFixed.toJS()
    };
  },

  dsCover(dsTxt) {
    const ds = delaney.parse(dsTxt);

    const t = util.timer();
    const cov = delaney3d.pseudoToroidalCover(ds);
    console.log(`${Math.round(t())} msec in total to compute the cover`);

    return `${cov}`;
  }
};


onmessage = event => {
  const { id, input: { cmd, val } } = event.data;
  postMessage({ id, output: handlers[cmd](val), ok: true });
};
