class Seq {
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
    let rev = nil;
    for (const x of this) {
      const r = rev;
      rev = cons(x, () => r);
    }
    return rev;
  }

  append(s) {
    return this.isNil ? s : cons(this.first(), () => this.rest().append(s));
  }

  appendLazy(s) {
    return this.isNil ? s() : cons(this.first(),
                                   () => this.rest().appendLazy(s));
  }

  flatten() {
    return this.isNil ? nil :
      this.first().appendLazy(() => this.rest().flatten())
  }

  map(fn) {
    return this.isNil ? nil :
      cons(fn(this.first()), () => this.rest().map(fn));
  }

  flatMap(fn) {
    return this.map(fn).flatten();
  }

  foldL(fn, z) {
    if (this.isNil)
      return z;
    else if (z === undefined)
      return this.rest().foldL(fn, this.first());
    else {
      let out = z;
      for (const x of this)
        out = fn(out, x);
      return out;
    }
  }

  foldR(z, fn) {
    if (this.isNil)
      return z;
    else
      return fn(this.first(), () => this.rest().foldR(z, fn));
  }

  take(n) {
    if (this.isNil || n <= 0)
      return nil;
    else
      return cons(this.first(), () => this.rest().take(n - 1));
  }

  takeWhile(pred) {
    if (this.isNil || !pred(this.first()))
      return nil;
    else
      return cons(this.first(), () => this.rest().takeWhile(pred));
  }

  drop(n) {
    let s = this;
    while (!(s.isNil || n <= 0)) {
      s = s.rest();
      --n;
    }
    return s;
  }

  dropUntil(pred) {
    let s = this;
    while (!(s.isNil || pred(s.first())))
      s = s.rest();
    return s;
  }

  filter(pred) {
    if (this.isNil)
      return nil;
    else if (pred(this.first()))
      return cons(this.first(), () => this.rest().filter(pred));
    else {
      const r = this.rest().dropUntil(pred);
      return r && r.filter(pred);
    }
  }

  pick(n) {
    return this.drop(n).first();
  }

  some(pred) {
    return !this.dropUntil(pred).isNil;
  }

  every(pred) {
    return !this.some(x => !pred(x));
  }

  subseqs() {
    return this.isNil ? nil : cons(this, () => this.rest().subseqs());
  }

  consec(n) {
    return this.subseqs().map(s => s.take(n));
  }
};


Seq.prototype[Symbol.iterator] = function*() {
  let s = this;
  while (!s.isNil) {
    yield s.first();
    s = s.rest();
  }
};

Seq.prototype.reduce = Seq.prototype.foldL;
Seq.prototype.fold = Seq.prototype.foldR;


export const nil = new Seq();

nil.isNil = true;
nil.first = () => { throw new Error('empty sequence has no first element'); };
nil.rest  = () => nil;


class Cons extends Seq {
  constructor(firstVal, restFn) {
    super();

    this.isNil = false;
    this.first = () => firstVal;
    this.rest = () => {
      const val = restFn && restFn();
      this.rest = () => val;
      return val;
    }
  }
}


export const cons = (firstVal, restFn) => new Cons(firstVal, restFn);

export const seq = iter => {
  if (typeof iter.next == 'function') {
    const s = iter.next();
    return s.done ? nil : cons(s.value, () => seq(iter));
  }
  else
    return seq(iter[Symbol.iterator]());
};

export const fromArray = (a, start=0) => 
  start < a.length ? cons(a[start], () => fromArray(a, start + 1)) : nil;

export const upFrom = start => cons(start, () => upFrom(start + 1));
export const downFrom = start => cons(start, () => downFrom(start - 1));
export const range = (start, limit) => upFrom(start).take(limit - start);
export const constant = x => cons(x, () => constant(x));
export const iterate = (x, f) => cons(x, () => iterate(f(x), f));

export const zip = (...seqs) => {
  if (seqs.every(x => x.isNil))
    return nil;
  else
    return cons(seqs.map(s => s.isNil ? null : s.first()),
                () => zip(...seqs.map(s => s.rest())));
}

export const zipWith = (fn, ...seqs) => zip(...seqs).map(s => fn(...s));


if (require.main == module) {
  Array.prototype.toString = function() {
    return '[ ' + this.map(x => x && x.toString()).join(', ') + ' ]';
  };

  const test = t => {
    const s = eval(t);
    const n = s instanceof Seq ? ` (length ${s.length})` : '';
    console.log(`${t}:\n    ${s}${n}`);
    console.log();
  };

  const gen = function*() { yield 5; yield 3; yield 7; yield 1; };

  test('nil');
  test('fromArray([5, 3, 7, 1])');
  test('seq([5, 3, 7, 1])');
  test('seq(gen())');
  test('range(5, 15)');
  test('constant(4).take(8)');
  test('iterate(2, x => x*x).take(5)');
  test('iterate(2, x => x*x).drop(2).take(3)');
  test('iterate(2, x => x*x).takeWhile(x => x < 10000)');
  test('iterate(2, x => x*x).dropUntil(x => x > 100).take(2)');
  test('range(5, 14).reverse()');
  test('range(0, 3).append(range(1, 4).reverse())');
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
  test('zip(range(1, 5), range(4, 6), range(2, 5))');
  test('zipWith((x, y) => x * 10 + y, range(1, 5), range(4, 8).reverse())');
  test('range(1, 4).flatMap(i => range(10 * i, 10 * i + 3))');
  test('range(1, 4).subseqs().map(s => cons(0, () => s))');
  test('range(1, 5).consec(3).map(s => cons(0, () => s))');

  const fib = cons(0, () =>
                   cons(1, () =>
                        zipWith((x, y) => x + y, fib, fib.rest())));
  test('fib.take(12)');

  const primes = upFrom(2).filter(
    n => n < 4 || primes.takeWhile(m => m * m <= n).every(m => n % m));
  test('primes.take(12)');
}
