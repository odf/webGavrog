import * as I from 'immutable';


export function cmpLex(cmp = (x, y) => x < y ? -1 : x > y ? 1 : 0) {
  return function(a, b) {
    const n = Math.min(a.size, b.size);
    for (let i = 0; i < n; ++i) {
      const d = cmp(a.get(i), b.get(i));
      if (d)
        return d;
    }
    return a.size - b.size;
  };
};


export function timer() {
  let _last = performance.now();

  return () => {
    const previous = _last;
    _last = performance.now();
    return Math.round(_last - previous);
  };
};
