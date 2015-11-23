import * as I from 'immutable';


const get = function get(impl, x) {
  let root = x;

  while (impl.parent.get(root) !== undefined)
    root = impl.parent.get(root);

  let p = impl.parent.asMutable();
  for (let z = x; z != root; z = impl.parent.get(z))
    p.set(z, root);
  impl.parent = p.asImmutable();

  return root;
};


const union = function union(impl, x, y) {
  const x0 = get(impl, x);
  const y0 = get(impl, y);

  if (I.is(x0, y0))
    return impl;
  else {
    const rx = impl.rank.get(x0) || 0;
    const ry = impl.rank.get(y0) || 0;

    if (rx < ry)
      return pmake(impl.rank, impl.parent.set(x0, y0));
    else if (rx > ry)
      return pmake(impl.rank, impl.parent.set(y0, x0));
    else
      return pmake(impl.rank.set(x0, rx + 1), impl.parent.set(y0, x0));
  }
};


const pmake = function pmake(rank, parent) {
  const _impl = {
    rank  : rank,
    parent: parent
  };

  return {
    get      : x      => get(_impl, x),
    union    : (x, y) => union(_impl, x, y),
    isTrivial: ()     => _impl.parent.size == 0,
    toString : ()     => `partition(${_impl.parent})`
  };
};


export default function partition(pairs = []) {
  return pairs.reduce((p, [a, b]) => p.union(a, b), pmake(I.Map(), I.Map()));
};


if (require.main == module) {
  const p = partition([[1,2],[3,4],[5,6],[7,8],[2,3],[1,6]]);
  console.log(`${p}`);

  I.Range(0, 10).forEach(i => console.log(`p.get(${i}) = ${p.get(i)}`));
}
