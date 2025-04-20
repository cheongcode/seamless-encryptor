const path = require('path');

module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/main.js',
  output: {
    path: path.resolve(__dirname, '.webpack/main'),
    filename: 'main.js'
  },
  // Put your normal webpack config below here
  module: {
    rules: require('./webpack.rules'),
  },
  resolve: {
    extensions: ['.js', '.json']
  },
  target: 'electron-main',
  node: {
    __dirname: false,
    __filename: false
  }
};
