import * as I from 'immutable';

import * as surface   from '../graphics/surface';
import * as delaney   from '../dsymbols/delaney';
import * as delaney3d from '../dsymbols/delaney3d';
import * as util      from '../common/util';


const processedSolid = (t0, timers) => {
  surface.useTimers(timers);

  timers && timers.start('adding flattened center faces');
  const t1 = surface.withFlattenedCenterFaces(t0);
  timers && timers.stop('adding flattened center faces');

  timers && timers.start('subdividing the faces');
  const t2 = I.Range(0, 2).reduce(s => surface.subD(s), t1);
  timers && timers.stop('subdividing the faces');

  timers && timers.start('insetting');
  const t3 = surface.insetAt(t2, 0.03, t2.isFixed);
  timers && timers.stop('insetting');

  timers && timers.start('beveling');
  const t4 = surface.beveledAt(t3, 0.015, t2.isFixed);
  timers && timers.stop('beveling');

  surface.useTimers(null);

  return t4;
};


const handlers = {
  processSolid({ pos, faces, isFixed }) {
    const surfIn = {
      pos    : I.List(pos),
      faces  : I.fromJS(faces),
      isFixed: I.fromJS(isFixed)
    };

    const timer = util.timer();
    const timers = util.timers();

    const surfOut = processedSolid(surfIn, timers);

    console.log(`${Math.round(timer())} msec in total to process the surfaces`);
    console.log(`  surface processing details:`);
    console.log(`${JSON.stringify(timers.current(), null, 2)}`);

    return {
      pos    : surfOut.pos.toJS(),
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
