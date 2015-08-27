var path    = require('path');
var basedir = path.dirname(__dirname);


module.exports = {
  context: path.join(basedir, "src"),
  entry: [ "babel-core/polyfill", "./ui/test.js" ],
  output: {
    path: path.join(basedir, "public", "js"),
    filename: "test.js"
  },
  module: {
    loaders: [
      { test: /\.jsx?$/, exclude: /node_modules/, loader: "babel-loader" },
      { test: /\.json$/, loader: "json" }
    ]
  },
  resolve: {
    extensions: [ "", ".js", ".jsx", ".json" ]
  }
};
