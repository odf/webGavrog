import * as I from 'immutable';

import * as surface   from '../graphics/surface';
import * as delaney   from '../dsymbols/delaney';
import * as delaney3d from '../dsymbols/delaney3d';
import * as delaney2d from '../dsymbols/delaney2d';
import * as util      from '../common/util';


const processedSolid = (t0, subDLevel, timers) => {
  surface.useTimers(timers);

  timers && timers.start('adding flattened center faces');
  const t1 = surface.withFlattenedCenterFaces(t0);
  timers && timers.stop('adding flattened center faces');

  timers && timers.start('subdividing the faces');
  const t2 = I.Range(0, subDLevel).reduce(s => surface.subD(s), t1);
  timers && timers.stop('subdividing the faces');

  timers && timers.start('insetting');
  const t3 = surface.insetAt(t2, 0.01, t2.isFixed);
  timers && timers.stop('insetting');

  timers && timers.start('beveling');
  const t4 = surface.beveledAt(t3, 0.005, t2.isFixed);
  timers && timers.stop('beveling');

  surface.useTimers(null);

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
    const t = util.timer();
    const solidsOut = solidsIn.map(this.processSolid);
    console.log(`${Math.round(t())} msec in total to process the surfaces`);

    return solidsOut;
  },

  dsCover(dsTxt) {
    const ds = delaney.parse(dsTxt);

    const t = util.timer();

    const cov = delaney.dim(ds) == 3 ?
      delaney3d.pseudoToroidalCover(ds) :
      delaney2d.toroidalCover(ds);

    console.log(`${Math.round(t())} msec in total to compute the cover`);

    return `${cov}`;
  }
};


onmessage = event => {
  const { id, input: { cmd, val } } = event.data;
  postMessage({ id, output: handlers[cmd](val), ok: true });
};
