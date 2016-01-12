var webpack = require('webpack');
var path    = require('path');
var basedir = __dirname;


module.exports = [ "main", "sceneWorker" ].map(function(name) {
  return {
    context: path.join(basedir, "src"),
    entry: (name == "main" ? ["babel-polyfill"] : []).concat("./ui/"+name),
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
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false
            },
        }),
    ],
    resolve: {
      extensions: [ "", ".js", ".jsx", ".json" ]
    }
  };
});
