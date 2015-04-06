var path = require('path');

var basedir = path.dirname(__dirname);


module.exports = {
  context: path.join(basedir, "src"),
  entry: [ "./ui/test.js" ],
  output: {
    path: path.join(basedir, "public", "js"),
    filename: "test.js"
  }
};
