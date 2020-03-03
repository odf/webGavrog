var fs = require('fs');
var path = require('path');

const webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

var execSync = require('child_process').execSync;
var execOpts = { encoding: 'utf8' };
var gitRev = execSync('git rev-parse HEAD', execOpts);
var gitDate = execSync('git show -s --format=%ci ${GIT_REV}', execOpts);


fs.writeFileSync(path.resolve(__dirname, 'src', 'version.js'),
                 'export const gitRev = "' + gitRev.trim() + '";\n' +
                 'export const gitDate = "' + gitDate.trim() + '";\n');


module.exports = {
  entry: ['@babel/polyfill', './src/ui/main.js'],
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      title: 'Gavrog for the Web',
      favicon: path.resolve(__dirname, '3dt.ico'),
      meta: {
        viewport: "initial-scale=1.0,width=device-width",
        ["apple-mobile-web-app-capable"]: "yes"
      }
    }),
    new webpack.HashedModuleIdsPlugin()
  ],
  output: {
    filename: '[name].[contenthash].js',
    path: path.resolve(__dirname, 'dist')
  },
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  },
  module: {
    rules: [
      { test: /\.js$/,
        exclude: /node_modules/,
        use: "babel-loader"
      },
      { test: /\.elm$/,
        exclude: [/node_modules/, /elm-stuff/],
        use: "elm-webpack-loader"
      },
      {
        test: /sceneWorker\.js$/,
        use: {
          loader: 'worker-loader',
          options: {
            inline: true
          }
        }
      }
    ]
  },
  resolve: {
    extensions: [ ".js", ".elm" ]
  }
}
