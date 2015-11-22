import * as I from 'immutable';


const now = (() => {
  if (typeof performance != 'undefined' && performance.now)
    return performance.now.bind(performance);
  else if (typeof process != 'undefined' && process.hrtime)
    return () => {
      const [sec, nsec] = process.hrtime();
      return sec * 1000 + nsec / 1000000;
    };
  else
    return Date.now.bind(Date);
})();


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
  let _last = now();

  return () => {
    const previous = _last;
    _last = now();
    return _last - previous;
  };
};
