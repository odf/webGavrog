var path    = require('path');
var basedir = __dirname;


module.exports = [ "main", "sceneWorker" ].map(function(name) {
  return {
    context: path.join(basedir, "src"),
    entry: [ "babel-core/polyfill", "./ui/"+name ],
    devtool: "#inline-source-map",
    output: {
      path: path.join(basedir, "public", "js"),
      filename: name+".js"
    },
    module: {
      loaders: [
        { test: /\.jsx?$/, exclude: /node_modules/, loader: "babel-loader" },
        { test: /\.json$/, loader: "json" },
        { test: /\.pegjs$/, loader: "pegjs-loader" }
      ]
    },
    resolve: {
      extensions: [ "", ".js", ".jsx", ".json" ]
    }
  };
});
