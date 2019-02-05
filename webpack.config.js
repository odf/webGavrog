var fs = require('fs');
var path = require('path');
var execSync = require('child_process').execSync;

var execOpts = { encoding: 'utf8' };
var gitRev = execSync('git rev-parse HEAD', execOpts);
var gitDate = execSync('git show -s --format=%ci ${GIT_REV}', execOpts);


fs.writeFileSync(path.resolve(__dirname, 'src', 'version.js'),
                 'export const gitRev = "' + gitRev.trim() + '";\n' +
                 'export const gitDate = "' + gitDate.trim() + '";\n');


module.exports = [ "main", "sceneWorker" ].map(function(name) {
  return {
    entry: ['babel-polyfill', path.resolve(__dirname, 'src', 'ui', name)],
    output: {
      path: path.resolve(__dirname, 'public', 'js'),
      filename: name+'.js'
    },
    module: {
      rules: [
        { test: /\.js$/,
          exclude: /node_modules/,
          use: "babel-loader" },
        { test: /\.elm$/,
          exclude: [/node_modules/, /elm-stuff/],
          use: "elm-webpack-loader" },
      ]
    },
    resolve: {
      extensions: [ ".js", ".elm" ]
    }
  };
});
