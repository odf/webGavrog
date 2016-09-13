export function extend(scalarOps, scalarTypes) {

  const s = scalarOps;

  class ParameterVector {
    constructor(coords) {
      this.coords = coords;
    }

    toString() {
      const coords = this.coords.map(x => x.toString()).join(', ');
      return `ParameterVector(${coords})`;
    }

    get __typeName() { return 'ParameterVector'; }
  };


  const checkLen = (v, w) => {
    if (w.coords.length == v.coords.length)
      return true;
    else
      throw new Error('size mismatch');
  };


  const make = v => new ParameterVector(v);


  const map = {
    V : f => v => make(v.coords.map(x => f(x))),
    VS: f => (v, s) => make(v.coords.map(x => f(x, s))),
    SV: f => (s, v) => make(v.coords.map(x => f(s, x))),
    VV: f => (v, w) => checkLen(v, w) && make(v.coords.map(
      (x, i) => f(x, w.coords[i])))
  };

  const array = n => Array(n).fill(0);


  const methods = {
    parameterVector: {
      Vector: v => make(v)
    },

    unitParameterVector: {
      Integer: {
        Integer: (n, k) => make(array(n).fill(1, k, k+1))
      }
    },

    dimension: {
      ParameterVector: v => v.coords.length
    },

    negative: {
      ParameterVector: map.V(s.negative)
    }
  };

  for (const name of ['plus', 'minus', 'times', 'div', 'idiv']) {
    methods[name] = { ParameterVector: {} };

    for (const sType of scalarTypes) {
      methods[name]['ParameterVector'][sType] = map.VS(s[name]);
    }
  }

  for (const name of ['plus', 'minus', 'times']) {
    for (const sType of scalarTypes) {
      methods[name][sType] = {
        ParameterVector: map.SV(s[name])
      }
    }
  }

  for (const name of ['plus', 'minus']) {
    methods[name].ParameterVector.ParameterVector = map.VV(s[name]);
  }

  return s.register(methods);
};
