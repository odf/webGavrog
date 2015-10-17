import * as I       from 'immutable';
import * as surface from '../geometry/surface';

import * as R from '../arithmetic/float';
import _V     from '../arithmetic/vector';

const V = _V(R, 0);


const processedSolid = t0 => {
  const t1 = surface.withFlattenedCenterFaces(t0);
  const t2 = I.Range(0, 2).reduce(s => surface.subD(s), t1);
  const t3 = surface.insetAt(t2, 0.03, t2.isFixed);
  const t4 = surface.beveledAt(t3, 0.015, t2.isFixed);

  const isCorner = I.Range(0, t4.pos.size).map(i => i >= t3.pos.size);
  const t5 = surface.beveledAt(t4, 0.005, isCorner);

  return t4;
};


onmessage = event => {
  const { id, input: { cmd, val: { pos, faces, isFixed } } } = event.data;

  const surfIn = {
    pos    : I.fromJS(pos).map(V.make),
    faces  : I.fromJS(faces),
    isFixed: I.fromJS(isFixed)
  };

  const surfOut = processedSolid(surfIn);

  const output = {
    pos    : surfOut.pos.map(v => v.data).toJS(),
    faces  : surfOut.faces.toJS(),
    isFixed: surfOut.isFixed.toJS()
  };

  postMessage({ id, output, ok: true });
};
