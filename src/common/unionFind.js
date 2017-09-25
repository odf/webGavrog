export class Partition {
  constructor() {
    this._rank = {};
    this._parent = {};
  }

  find(x) {
    let root = x;

    while (this._parent[root] !== undefined)
      root = this._parent[root];

    while (x != root) {
      const t = x;
      x = this._parent[x];
      this._parent[t] = root;
    }

    return root;
  }

  union(x, y) {
    const x0 = this.find(x);
    const y0 = this.find(y);

    if (x0 != y0) {
      const rx = this._rank[x0] || 0;
      const ry = this._rank[y0] || 0;

      if (rx < ry)
        this._parent[x0] = y0;
      else {
        if (rx == ry)
          this._rank[x0] = rx + 1;

        this._parent[y0] = x0;
      }
    }
  }

  clone() {
    const p = new Partition();
    p._rank = Object.assign({}, this._rank);
    p._parent = Object.assign({}, this._parent);
    return p;
  }

  toString() {
    return `Partition(${JSON.stringify(this._parent)})`;
  }
};


export class LabelledPartition {
  constructor(combineFn) {
    this._combineFn = combineFn;
    this._rank = {};
    this._parent = {};
    this._label = {};
  }

  find(x) {
    let root = x;

    while (this._parent[root] !== undefined)
      root = this._parent[root];

    while (x != root) {
      const t = x;
      x = this._parent[x];
      this._parent[t] = root;
    }

    return root;
  }

  setLabel(x, val) {
    this._label[this.find(x)] = val;
  }

  getLabel(x) {
    return this._label[this.find(x)];
  }

  union(x, y) {
    const x0 = this.find(x);
    const y0 = this.find(y);

    if (x0 != y0) {
      const rx = this._rank[x0] || 0;
      const ry = this._rank[y0] || 0;
      const label = this._combineFn(this._label[x0], this._label[y0]);

      if (rx < ry) {
        this._parent[x0] = y0;
        this._label[y0] = label;
      }
      else {
        if (rx == ry)
          this._rank[x0] = rx + 1;

        this._parent[y0] = x0;
        this._label[x0] = label;
      }
    }
  }
};


if (require.main == module) {
  const p = new Partition();

  for (const [a, b] of [[1,2],[3,4],[5,6],[7,8],[2,3],[1,6]])
    p.union(a, b);

  console.log(`${p}`);

  for (let i = 0; i < 10; ++i)
    console.log(`p.find(${i}) = ${p.find(i)}`);
}
