const path = require('path');

console.log('Loading webpack.main.config.js...');

module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/main.js',
  output: {
    path: path.resolve(__dirname, '.webpack'),
    filename: 'main/index.js',
    library: {
      type: 'commonjs2'
    }
  },
  // Put your normal webpack config below here
  module: {
    rules: require('./webpack.rules'),
  },
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@config': path.resolve(__dirname, 'src/config'),
      '@crypto': path.resolve(__dirname, 'src/crypto')
    }
  },
  // Exclude certain modules from bundling that cause problems
  externals: {
    'keytar': 'commonjs2 keytar',
    'electron': 'commonjs2 electron'
  },
  target: 'electron-main',
  node: {
    __dirname: false,
    __filename: false
  }
};
