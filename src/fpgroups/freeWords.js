// Operations for free words over the natural numbers (i.e. positive integers).
// Inverses are represented as negative numbers.
// Words are represented as plain JavaScript arrays.

const _normalize = ws => {
  const tmp = [];
  let head = 0;

  for (const w of ws) {
    for (const x of w) {
      if (!Number.isSafeInteger(x))
        throw new Error(`illegal word ${w} - all letters must be integers`);
      else if (x == 0)
        throw new Error(`illegal word ${w} - all letters must be non-zero`);
      else if (head > 0 && x == - tmp[head-1])
        --head;
      else {
        tmp[head] = x;
        ++head;
      }
    }
  }

  return tmp.slice(0, head);
};


export const empty = _normalize([]);

export const word = w => _normalize([w]);

export const inverse = w => word(w).reverse().map(x => -x);

export const raisedTo = (m, w) =>
  m < 0 ? raisedTo(-m, inverse(w)) : _normalize(Array(m).fill(w));

export const product = words => _normalize(words);

export const commutator = (a, b) => product([a, b, inverse(a), inverse(b)]);

export const rotated = (a, i) => product([a.slice(i), a.slice(0, i)]);


export const relatorPermutations = wd => {
  const w = word(wd);

  const result = [];
  for (let i = 0; i < w.length; ++i) {
    const wx = rotated(w, i);
    result.push(wx);
    result.push(inverse(wx));
  }
  return result;
};


const _cmp = (x, y) => x * y * (x - y);


export const compare = (a, b) => {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; ++i) {
    const d = _cmp(a[i], b[i]);
    if (d)
      return d;
  }
  return a.length - b.length;
};


export const relatorRepresentative = w => relatorPermutations(w)
  .reduce((a, b) => a == null || compare(a, b) > 0 ? b : a, null)


if (require.main == module) {
  const timer = require('../common/timing').timer();

  console.log(product([[1,2,3], [-3,-2,4]]));
  console.log(raisedTo(3, [1,2,3,4,5,-2,-1]));
  console.log(commutator([1,2], [3,2]));

  console.log();
  console.log(`Computation time: ${timer()} msec`);
}
