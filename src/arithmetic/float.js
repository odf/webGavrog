export const epsilon  = 1e-14;

export const toJS     = x => x;
export const sgn      = x => (x > 0) - (x < 0);
export const negative = x => -x;
export const abs      = x => Math.abs(x);
export const inverse  = x => 1 / x;

export const cmp      = (x, y) => x - y;
export const plus     = (x, y) => x + y;
export const minus    = (x, y) => x - y;
export const times    = (x, y) => x * y;
export const div      = (x, y) => x / y;
