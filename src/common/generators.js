export const backtracker = (spec, stack=[[spec.root]]) => ({
  current() {
    return stack[0][0];
  },
  result() {
    return spec.extract(stack[0][0]);
  },
  skip() {
    const k = stack.findIndex(a => a.length >= 2);
    if (k >= 0)
      return backtracker(spec, [stack[k].slice(1)].concat(stack.slice(k + 1)));
  },
  step() {
    const todo = spec.children(stack[0][0]) || [];
    return todo.length ? backtracker(spec, [todo].concat(stack)) : this.skip();
  }
});


export function* results(gen, pred) {
  let g = gen;

  while (g) {
    if (!pred || pred(g.current())) {
      const val = g.result();
      g = g.step();
      if (val != null)
        yield val;
    } else
      g = g.skip();
  }
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

  for (const a of results(gen))
    console.log(`${a}`);
}
