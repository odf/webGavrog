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


export function timer() {
  let _last = now();

  return () => {
    const previous = _last;
    _last = now();
    return _last - previous;
  };
};


export function timers() {
  const _accumulated = {};
  const _start = {};

  return {
    start(key) {
      if (key != null && _start[key] == null) {
        _start[key] = now();
      }
    },
    stop(key) {
      if (_start[key] != null) {
        _accumulated[key] = (_accumulated[key] || 0.0) + now() - _start[key];
        _start[key] = null;
      }
    },
    stopAll() {
      for (const k in _start)
        this.stop(k);
    },
    switchTo(key) {
      this.stopAll();
      this.start(key);
    },
    current() {
      for (const k in _start) {
        if (_start[k] != null) {
          this.stop(k);
          this.start(k);
        }
      }

      const result = {};
      for (const k in _accumulated)
        result[k] = _accumulated[k];
      return result;
    }
  };
};
