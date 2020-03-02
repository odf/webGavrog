import { parse } from '../dsymbols/delaney';


export default function* symbols(text) {
  const type = 'tiling';

  let lineNr = 0;
  let startLine = null;
  let buffer = [];
  let attributes = {};

  for (const line of text.split(/\r?\n/)) {
    lineNr++;

    const match = line.match(/\s*#\s*@\s*(.*)/);

    if (match && match[1]) {
      if (startLine == null)
        startLine = lineNr;

      const fields = match[1].trim().split(/\s+/);
      attributes[fields[0]] = fields.slice(1).join(' ');
    }
    else {
      buffer.push(line.replace(/[#>].*/, '').trim());

      if (line.match(/</) && startLine == null)
        startLine = lineNr

      if (line.match(/>/)) {
        const symbol = parse(buffer.join(' ') + '>');
        const endLine = lineNr;

        yield Object.assign(attributes, { type, symbol, startLine, endLine });

        attributes = {};
        buffer = [];
        startLine = null;
      }
    }
  }
};


if (require.main == module) {
  const text = `
#@ name test
<1.1:
1:
1,1,1:
4,4
>

    <1:1,1,1:6,3>
`;

  for (const s of symbols(text)) {
    for (const k of Object.keys(s))
      console.log(`${k}: ${s[k]}`);
    console.log();
  }
}
