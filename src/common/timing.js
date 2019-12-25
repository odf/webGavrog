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


export const timer = () => {
  let _last = now();

  return () => {
    const previous = _last;
    _last = now();
    return _last - previous;
  };
};


export const timers = () => {
  const _accumulated = {};
  const _start = {};
  const _count = {};

  return {
    start(key) {
      if (key != null && _start[key] == null) {
        _start[key] = now();
        _count[key] = (_count[key] || 0) + 1
      }
    },

    stop(key) {
      if (_start[key] != null) {
        _accumulated[key] = (_accumulated[key] || 0.0) + now() - _start[key];
        _start[key] = null;
      }
    },

    current() {
      const t = now();
      for (const k in _start) {
        if (_start[k] != null) {
          _accumulated[k] = (_accumulated[k] || 0.0) + t - _start[k];
          _start[k] = null;
        }
      }

      const result = {};
      for (const k in _accumulated)
        result[k] = [_accumulated[k], _count[k]];
      return result;
    }
  };
};
