const path = require('path');

console.log('Loading webpack.main.config.js...');

module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/main.js',
  output: {
    path: path.resolve(__dirname, '.webpack/main'),
    filename: 'main.js',
    library: {
      type: 'commonjs2'
    }
  },
  // Put your normal webpack config below here
  module: {
    rules: require('./webpack.rules'),
  },
  resolve: {
    extensions: ['.js', '.json']
  },
  // Exclude certain modules from bundling that cause problems
  externals: {
    'sodium-native': 'commonjs2 sodium-native',
    'keytar': 'commonjs2 keytar',
    'sqlite3': 'commonjs2 sqlite3',
    'better-sqlite3': 'commonjs2 better-sqlite3',
    'serialport': 'commonjs2 serialport',
    'electron': 'commonjs2 electron'
  },
  target: 'electron-main',
  node: {
    __dirname: false,
    __filename: false
  }
};
