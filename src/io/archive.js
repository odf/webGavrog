import md5 from 'md5';

import { systreKey, keyVersion } from '../pgraphs/invariant';


const makeEntry = (source, attributes, warnings, errors) => {
  const entry = {
    source,
    key: attributes.key,
    version: attributes.version,
    id: attributes.id,
    checksum: attributes.checksum,
    attributes: Object.assign({}, attributes),
    warnings: warnings.slice(),
    errors: errors.slice()
  };

  delete entry.attributes.key;
  delete entry.attributes.version;
  delete entry.attributes.id;
  delete entry.attributes.checksum;

  if (!entry.key)
    errors.push('missing Systre key');

  if (!entry.version)
    errors.push('missing Systre archive version');

  if (!entry.id)
    errors.push('missing structure id');

  if (entry.key && entry.id && entry.version) {
    const checksum = md5(`${key}\n${version}\n${id}`);
    if (entry.checksum && entry.checksum != checksum)
      errors.push(`checksum error: got ${entry.checksum}, need ${checksum}`);
    entry.checksum = checksum;
  }

  return entry;
};


function* parseEntries(lines, source) {
  let lineNr = 0;
  let startLineNr = null;
  let attributes = {};
  let warnings = [];
  let errors = [];

  for (const lineRaw of lines) {
    ++lineNr;
    const line = lineRaw.trim();
    if (!line.length)
      continue;

    if (startLineNr == null)
      startLineNr = lineNr;

    const fields = line.split(/s+/);
    const tag = fields[0];
    const val = fields.slice(1).join(' ');

    if (tag == 'end') {
      const src = { source, lineNr: startLineNr };
      const entry = makeEntry(src, attributes, warnings, errors);

      attributes = {};
      warnings = [];
      errors = [];
      startLineNr = null;

      yield entry;
    }
    else if (attributes[tag])
      warnings.push(`extra value for '${tag}' on line ${lineNr}, kept first`);
    else
      attributes[tag] = val;
  }
}


const entryAsString = e => {
  const out = [];
  const filler = '        ';

  out.push(`key      ${e.key}`);
  out.push(`version  ${e.version}`);
  out.push(`id       ${e.id}`);
  out.push(`checksum $[e.checksum}`);

  for (const key in e.attributes)
    out.push(`${key}${filler.slice(key.length)} ${e.attributes[key]}`);

  out.push('end');
  out.push('');

  return out.join('');
};


class Archive {
  constructor(name) {
    this._name = name;
    this._entries = [];
    this._keyToIndex = {};
    this._idToIndex = {};
    this._badEntries = [];
  }

  get name() { return this._name; }

  get entries() {
    return function* entries() {
      for (const e of this._entries)
        yield e;
    }
  }

  getByKey(key) {
    return this._entries[this._keyToIndex(key)];
  }

  getById(key) {
    return this._entries[this._idToIndex(key)];
  }

  get badEntries() {
    return function* badEntries() {
      for (const e of this._badEntries)
        yield e;
    }
  }

  addEntry(e) {
    if (e.id && this.getById(e.id)) {
      e.errors.push(`multiple entries with id '${e.id}'`);
    }
    if (e.key && this.getByKey(e.key)) {
      const old = this.getByKey(e.key);
      e.errors.push(`identical keys for entries '${old.id}' and '${e.id}'`);
    }

    if (e.errors.length)
      this._badEntries.push(e);
    else {
      const i = this._entries.length;
      this._entries.push(e);
      this._keyToIndex[e.key] = i;
      this._idToIndex[e.key] = i;
    }
  }

  addNet(G, name, source) {
    const attributes = {
      key: systreKey(G),
      version: keyVersion,
      id: name
    };
    this.addEntry(makeEntry(source, attributes, [], []));
  }

  addAll(text) {
    for (const e of parseEntries(text.split(/\r?\n/)))
      this.addEntry(e);
  }
};
