// Operations for free words over the natural numbers (i.e. positive integers).
// Inverses are represented as negative numbers.
// Words are represented as immutable.js Lists.

import * as I from 'immutable';


const _isInteger = x => typeof x == 'number' && x % 1 == 0;


const _normalize = ws => {
  const tmp = [];
  let head = 0;

  for (const w of ws) {
    for (const x of w) {
      if (!_isInteger(x))
        throw new Error(`illegal word ${w} - all letters must be integers`);
      if (x == 0)
        break;
      else if (head > 0 && x == - tmp[head-1])
        --head;
      else {
        tmp[head] = x;
        ++head;
      }
    }
  }

  return I.List(tmp.slice(0, head));
};


export const empty = I.List();


export function word(w) {
  return _normalize([w]);
};


export function inverse(w) {
  return word(w).reverse().map(x => -x);
};


export function raisedTo(m, w) {
  if (m == 0)
    return empty;
  else if (m < 0)
    return raisedTo(-m, inverse(w));
  else
    return _normalize(Array(m).fill(w));
};


export function product(words) {
  return _normalize(words);
};


export function commutator(a, b) {
  return product([a, b, inverse(a), inverse(b)]);
};


if (require.main == module) {
  const timer = require('../common/util').timer();

  console.log(product([[1,2,3], [-3,-2,4]]));
  console.log(raisedTo(3, [1,2,3,4,5,-2,-1]));
  console.log(commutator([1,2], [3,2]));

  console.log();
  console.log(`Computation time: ${timer()} msec`);
}
