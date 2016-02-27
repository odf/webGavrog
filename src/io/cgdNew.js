const parser = require('./cgdParser');

if (require.main == module) {
  const fs = require('fs');

  process.argv.slice(2).forEach(file => {
    const txt = fs.readFileSync(file, { encoding: 'utf8' });
    let data;

    try {
      console.log(JSON.stringify(parser.parse(txt), null, 2));
    } catch(ex) {
      if (ex.location) {
        var n = ex.location.start.line - 1;
        var m = ex.location.start.column || 0;
        var lines = txt.split('\n');
        var pre  = lines.slice(Math.max(n-5, 0), n);
        var line = lines[n];
        var post = lines.slice(n+1, n+6);
        console.error(ex.message);
        console.error('(line '+(n+1)+', column '+m+')\n');
        if (pre.length > 0)
          console.error('  ' + pre.join('\n  '));
        console.error('* ' + line);
        console.error('  ' + Array(m).join(' ') + '^');
        console.error('  ' + post.join('\n  '));
      }
      else
        console.error(ex);
    }
  });
}
