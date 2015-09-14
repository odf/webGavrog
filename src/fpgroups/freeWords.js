// Operations for free words over the natural numbers (i.e. positive integers).
// Inverses are represented as negative numbers.
// Words are represented as immutable.js Lists.

import * as I from 'immutable';


const _isInteger = x => typeof x == 'number' && x % 1 == 0;


const _overlap = function _overlap(w1, w2) {
  w1 = word(w1);
  w2 = word(w2);

  const n1 = w1.size;
  const n2 = w2.size;
  const n  = Math.min(n1, n2);

  for (let k = 0; k < n; ++k) {
    if (w2.get(k) != -w1.get(n1 - 1 - k))
      return k;
  }
  return n;
};


const _repeat = (w, m) => I.Range(0, m).reduce(r => r.concat(w), empty);


export const empty = I.List();


export function word(w) {
  return w.reduce(
    function(w, x) {
      if (!_isInteger(x))
        throw new Error('illegal word '+w);
      if (x == 0)
        return w;
      else if (w.last() == -x)
        return w.pop();
      else
        return w.push(x);
    },
    empty
  );
};


export function inverse(w) {
  return word(w).reverse().map(x => -x);
};


export function raisedTo(m, w) {
  w = word(w);

  if (m == 0)
    return empty;
  else if (m < 0)
    return raisedTo(-m, inverse(w));
  else {
    const n = w.size;
    const k = _overlap(w, w);

    if (k == 0)
      return _repeat(w, m);
    else if (k == n)
      return (m % 2 == 0) ? empty : w;
    else {
      const head = w.slice(0, k);
      const tail = w.slice(n - k);
      const mid  = w.slice(k, n - k);

      return head.concat(_repeat(mid, m)).concat(tail);
    }
  }
};


export function product(words) {
  return words.map(word).reduce(
    function(w1, w2) {
      const k = _overlap(w1, w2);
      return w1.slice(0, w1.size - k).concat(w2.slice(k));
    },
    empty
  );
};


export function commutator(a, b) {
  return product([a, b, inverse(a), inverse(b)]);
};


if (require.main == module) {
  console.log(product([[1,2,3], [-3,-2,4]]));
  console.log(raisedTo(3, [1,2,3,4,5,-2,-1]));
  console.log(commutator([1,2], [3,2]));
}
