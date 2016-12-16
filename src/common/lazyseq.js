const identity  = x => x;
const defined   = x => x != null;
const onDefined = f => x => defined(x) ? f(x) : x;
const compose   = (f, g) => x => f(g(x));
const curry     = (f, x) => y => f(x, y);
const rcurry    = (f, y) => x => f(x, y);


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

  reverse() {
    let rev = null;
    for (const x of this) {
      const r = rev;
      rev = cons(x, () => r);
    }
    return rev;
  }

  concat(s) {
    const next = this.rest() ? this.rest().concat(s) : s;
    return cons(this.first(), () => next);
  }

  map(fn) {
    return cons(fn(this.first()), () => this.rest() && this.rest().map(fn));
  }

  reduce(fn, z) {
    if (z === undefined)
      return this.rest() ? this.rest().reduce(fn, this.first()) : this.first();

    let out = z;
    for (const x of this)
      out = fn(out, x);
    return out;
  }

  fold(z, fn) {
    return this.reduce(fn, z);
  }

  filter(pred) {
    if (pred(this.first()))
      return cons(this.first(), () => this.rest() && this.rest().filter(pred));

    const r = this.rest().dropUntil(pred);
    return r && r.filter(pred);
  }

  take(n) {
    if (n <= 0)
      return null;

    return cons(
      this.first(),
      () => this.rest() && this.rest().take(n - 1));
  }

  takeWhile(pred) {
    if (!pred(this.first()))
      return null;

    return cons(
      this.first(),
      () => this.rest() && this.rest().takeWhile(pred));
  }

  drop(n) {
    let s = this;
    while (n > 0 && s.rest()) {
      s = s.rest();
      --n;
    }
    return s;
  }

  dropUntil(pred) {
    let s = this;
    while (s && !pred(s.first()))
      s = s.rest();
    return s;
  }

  pick(n) {
    return this.drop(n).first();
  }

  some(pred) {
    return this.dropUntil(pred) != null;
  }

  every(pred) {
    return !this.some(x => !pred(x));
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
  const test = t => {
    const s = eval(t);
    const n = s.constructor == Cons ? ` (length ${s.length})` : '';
    console.log(`${t}: ${s}${n}`);
  };

  test('fromArray([5, 3, 7, 1])');
  test('range(5, 15)');
  test('constant(4).take(8)');
  test('iterate(2, x => x*x).take(5)');
  test('iterate(2, x => x*x).drop(2).take(3)');
  test('iterate(2, x => x*x).takeWhile(x => x < 10000)');
  test('iterate(2, x => x*x).dropUntil(x => x > 100).take(2)');
  test('range(5, 14).reverse()');
  test('range(0, 3).concat(range(1, 4).reverse())');
  test('upFrom(10).pick(5)');
  test('range(1, 5).map(x => 1 / x)');
  test('range(1, 5).reduce((x, y) => x * y)');
  test('range(1, 5).reduce((x, y) => x * y, 0.1)');
  test('range(4, 5).reduce((x, y) => x * y)');
  test('range(4, 5).reduce((x, y) => x * y, 0.1)');
  test('range(0, 20).filter(x => x % 3 == 2)');
  test('range(1, 5).some(x => x % 7 == 2)');
  test('range(1, 5).some(x => x % 7 == 6)');
  test('range(1, 5).every(x => x % 7 == 2)');
  test('range(1, 5).every(x => x < 5)');
}
