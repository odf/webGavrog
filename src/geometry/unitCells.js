import {
  coordinateChangesQ,
  coordinateChangesF
} from '../geometry/types';

const opsQ = coordinateChangesQ;
const opsF = coordinateChangesF;


export const invariantBasis = gram => {
  const dot = (v, w) => opsF.times(opsF.times(v, gram), w);

  const vs = opsF.identityMatrix(gram.length);
  const ortho = [];

  for (let v of vs) {
    for (const w of ortho)
      v = opsF.minus(v, opsF.times(w, dot(v, w)));
    ortho.push(opsF.div(v, opsF.sqrt(dot(v, v))))
  }

  return opsF.times(gram, opsF.transposed(ortho));
};


export const symmetrizedGramMatrix = (gram, symOps) => {
  const M = symOps
    .map(S => opsQ.toJS(opsQ.linearPart(S)))
    .map(S => opsF.times(S, opsF.times(gram, opsF.transposed(S))))
    .reduce((A, B) => opsF.plus(A, B));

  return opsF.div(M, symOps.length);
};
