const _last = a => a[a.length - 1];


const current = (spec, stack) => _last(stack)[0];
const result  = (spec, stack) => spec.extract(current(spec, stack));


const step = (spec, stack) => {
  const children = spec.children(current(spec, stack));

  if (children && children.length > 0)
    return backtracker(spec, stack.concat([[
      children[0], children.slice(1), 0 ]]));
  else
    return skip(spec, stack);
};


const skip = (spec, stack) => {
  let s = stack;
  while(s.length && _last(s)[1].length == 0)
    s = s.slice(0, -1);

  if (s.length > 0) {
    const siblingsLeft = _last(s)[1];
    const branchNr     = _last(s)[2];

    return backtracker(spec, s.slice(0, -1).concat([[
      siblingsLeft[0], siblingsLeft.slice(1), branchNr + 1
    ]]));
  }
};


export const backtracker = (spec, stack) => {
  if (stack === undefined)
    return backtracker(spec, [[spec.root, [], 0]]);
  else {
    return {
      current: () => current(spec, stack),
      result : () => result(spec, stack),
      step   : () => step(spec, stack),
      skip   : () => skip(spec, stack)
    };
  }
};


export function* results(gen, pred) {
  let g = gen;

  while (g) {
    if (!pred || pred(g.current())) {
      const val = g.result();
      g = g.step();
      if (val !== undefined)
        yield val;
    } else
      g = g.skip();
  }
};


export const empty = () => {
  return backtracker({
    root    : null,
    extract : () => {},
    children: () => {}
  });
};


export const singleton = (x) => {
  return backtracker({
    root    : x,
    extract : x => x,
    children: () => {}
  });
};


if (require.main == module) {
  const n = parseInt(process.argv[2]) || 4;

  const gen = backtracker({
    root: {
      xs: [],
      sz: 0,
      mx: 1
    },
    extract(node) {
      if (node.sz == n)
        return node.xs;
    },
    children(node) {
      const ch = [];

      for (let i = node.mx; i < n - node.sz + 1; ++i)
        ch.push({
          xs: node.xs.concat(i),
          sz: node.sz + i,
          mx: Math.max(node.mx, i)
        });

      return ch;
    }
  });

  const out = [];
  for (const a of results(gen))
    out.push(a);

  console.log(JSON.stringify(out));
}
