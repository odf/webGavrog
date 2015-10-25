import * as delaney  from '../dsymbols/delaney';


export default function* symbols(lines) {
  let i = 0;
  let buffer = [];
  let attributes = {};

  for (const line of lines) {
    const lineNr = ++i;
    const m = line.match(/\s*#\s*@\s*(.*)/);

    if (m && m[1]) {
      const fields = m[1].trim().split(/\s+/);
      attributes[fields[0]] = fields.slice(1).join(' ');
    }
    else {
      const content = line.replace(/[#>].*/, '').trim()
      buffer.push(content);
      if (line.match(/>/)) {
        yield {
          attributes,
          symbol: delaney.parse(buffer.join(' ') + '>')
        }
        attributes = {};
        buffer = [];
      }
    }
  }
};


if (require.main == module) {
  const txt = `
#@ name test
<1.1:
1:
1,1,1:
4,4
>
`;

  const lines = txt.split(/\r?\n/);
  for (const s of symbols(lines))
    console.log(`${s.symbol} ${JSON.stringify(s.attributes)}`);
}
