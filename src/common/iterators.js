const last = as => as[as.length - 1];


export function* backtrack({ extract, root, children }) {
  const stack = [[root]];

  while (stack.length) {
    const val = extract(last(last(stack)));

    if (val != null)
      yield val;

    const todo = children(last(last(stack)));

    if (todo && todo.length)
      stack.push(todo.slice().reverse());
    else {
      while (stack.length && last(stack).length < 2)
        stack.pop();
      if (stack.length)
        last(stack).pop();
    }
  }
}


export const buffered = iterator => {
  const generated = [];
  let returned = null;

  const advance = () => {
    const { value, done } = iterator.next();

    if (!done)
      generated.push(value);
    else if (value != null)
      returned = value;

    return !done;
  }

  return {
    get(i) {
      while (generated.length <= i && advance()) {}
      return generated[i];
    },
    result() {
      while (advance()) {}
      return { generated, returned };
    }
  };
};


if (require.main == module) {
  const n = parseInt(process.argv[2]) || 4;

  const spec ={
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
  };

  for (const a of backtrack(spec))
    console.log(`${a}`);
}
