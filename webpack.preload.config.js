const path = require('path');
const rules = require('./webpack.rules');

module.exports = {
  entry: './preload.js',
  output: {
    path: path.resolve(__dirname, '.webpack/preload'),
    filename: 'preload.js',
    library: {
      type: 'commonjs2'
    }
  },
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.json']
  },
  target: 'electron-preload',
  node: {
    __dirname: false,
    __filename: false
  }
}; 