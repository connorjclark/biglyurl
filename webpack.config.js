const fs = require('fs')
const path = require('path')
const webpack = require('webpack')

module.exports = (env, argv) => ({
  mode: 'production',
  entry: {
    lib: './src/bigly'
  },
  output: {
    path: path.resolve(__dirname, 'docs/js'),
    filename: '[name].js',
    library: ['bigly', '[name]'],
    libraryTarget: 'window'
  },
  devtool: 'source-map',
  externals: {
    './node_modules/markovchain/older/index.js': ''
  },
  node: {
    fs: 'empty',
    './markovchain/older/index.js': 'empty'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        include: path.resolve(__dirname, 'src'),
        loader: 'ts-loader',
        options: {
          onlyCompileBundledFiles: true
        }
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    modules: [path.resolve(__dirname, 'src'), 'node_modules']
  },
  plugins: [
    new webpack.NamedModulesPlugin(),
    new webpack.DefinePlugin({
      TRUMP_SPEECH: JSON.stringify(fs.readFileSync('./trump.txt', 'utf8'))
    })
  ]
})