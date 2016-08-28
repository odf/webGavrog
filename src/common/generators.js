import * as I from 'immutable';


const current = (spec, stack) => stack.last().first();
const result  = (spec, stack) => spec.extract(current(spec, stack));

const step = function step(spec, stack) {
  const children = I.List(spec.children(current(spec, stack)));

  if (children.size > 0)
    return backtracker(spec, stack.push(I.List([
      children.first(), children.rest(), 0
    ])));
  else
    return skip(spec, stack);
};

const skip = function skip(spec, stack) {
  let s = stack;
  while(s.last() && s.last().get(1).size == 0)
    s = s.pop();

  if (s.size > 0) {
    const siblingsLeft = s.last().get(1);
    const branchNr     = s.last().get(2);

    return backtracker(spec, s.pop().push(I.List([
      siblingsLeft.first(), siblingsLeft.rest(), branchNr + 1
    ])));
  }
};


export function backtracker(spec, stack) {
  if (stack === undefined)
    return backtracker(spec, I.List([I.List([spec.root, I.List([]), 0])]));
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


export function empty() {
  return backtracker({
    root    : null,
    extract : () => {},
    children: () => {}
  });
};


export function singleton(x) {
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

  console.log(JSON.stringify(I.Seq(results(gen))));
}
