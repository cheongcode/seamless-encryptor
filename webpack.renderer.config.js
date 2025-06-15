const rules = require('./webpack.rules');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

console.log('Loading webpack.renderer.config.js...');

module.exports = {
  mode: 'development',
  entry: './src/renderer/renderer.js',
  output: {
    path: path.resolve(__dirname, '.webpack/renderer/main_window'),
    filename: 'index.js',
    publicPath: './',
    clean: true
  },
  module: {
    rules
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/index.html'),
      filename: 'index.html',
      inject: false,
      scriptLoading: 'defer'
    })
  ],
  resolve: {
    extensions: ['.js', '.json', '.css']
  },
  target: 'electron-renderer',
  devtool: 'source-map'
};