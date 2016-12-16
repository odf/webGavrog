const identity = x => x;
const defined  = x => x != null;
const compose  = (f, g) => x => f(g(x));
const option   = f => x => defined(x) ? f(x) : x;
const curry    = (f, x) => y => f(x, y);
const rcurry   = (f, y) => x => f(x, y);


class Cons {
  constructor(firstVal, restFn) {
    this.first = () => firstVal;
    this.rest = () => {
      const val = restFn && restFn();
      this.rest = () => val;
      return val;
    }
  }

  force() {
    for (const x of this)
      ;
  }

  get length() {
    let n = 0;
    for (const x of this)
      ++n;
    return n;
  }

  toArray() {
    const a = [];
    for (const x of this)
      a.push(x);
    return a;
  }

  toString() {
    return this.toArray().join(' -> ');
  }

  take(n) {
    if (n <= 0)
      return null;
    return cons(this.first(), () => this.rest() && this.rest().take(n - 1));
  }

  drop(n) {
    let s = this;
    while (n > 0 && s.rest()) {
      s = s.rest();
      --n;
    }
    return s;
  }
};


Cons.prototype[Symbol.iterator] = function*() {
  let s = this;
  while (s) {
    yield s.first();
    s = s.rest();
  }
};


export const cons = (firstVal, restFn) => new Cons(firstVal, restFn);

export const fromArray = (a, start=0) => 
  start < a.length ? cons(a[start], () => fromArray(a, start + 1)) : null;

export const upFrom = start => cons(start, () => upFrom(start + 1));
export const downFrom = start => cons(start, () => downFrom(start - 1));
export const range = (start, limit) => upFrom(start).take(limit - start);
export const constant = x => cons(x, () => constant(x));
export const iterate = (x, f) => cons(x, () => iterate(f(x), f));


if (require.main == module) {
  console.log(`${fromArray([5, 3, 7, 1])}`);
  console.log(`${range(5, 15)} (length ${range(5, 15).length})`);
  console.log(`${constant(4).take(10)}`);
  console.log(`${iterate(2, x => x*x).take(6)}`);
  console.log(`${iterate(2, x => x*x).drop(2).take(5)}`);
}
