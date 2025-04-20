const path = require('path');

module.exports = {
  entry: './src/preload/preload.js',
  output: {
    path: path.resolve(__dirname, '.webpack/preload'),
    filename: 'preload.js'
  },
  target: 'electron-preload',
  node: {
    __dirname: false,
    __filename: false
  }
}; 