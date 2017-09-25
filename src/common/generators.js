const skip = (spec, stack) => {
  const k = stack.findIndex(a => a.length >= 2);
  if (k >= 0)
    return backtracker(spec, [stack[k].slice(1)].concat(stack.slice(k + 1)));
};


const step = (spec, stack) => {
  const children = spec.children(stack[0][0]);

  if (children && children.length)
    return backtracker(spec, [children].concat(stack));
  else
    return skip(spec, stack);
};


export const backtracker = (spec, stack=[[spec.root]]) => ({
  current: () => stack[0][0],
  result : () => spec.extract(stack[0][0]),
  step   : () => step(spec, stack),
  skip   : () => skip(spec, stack)
});


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


export const empty = () => backtracker({
  root    : null,
  extract : () => {},
  children: () => {}
});


export const singleton = x => backtracker({
  root    : x,
  extract : x => x,
  children: () => {}
});


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
