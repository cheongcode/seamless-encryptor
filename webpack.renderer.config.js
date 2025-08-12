const rules = require('./webpack.rules');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

console.log('Loading webpack.renderer.config.js...');

module.exports = {
  mode: 'development',
  entry: {
    main_window: './src/renderer/renderer.js',
    cloud_window: './src/renderer/js/cloud.js',
  },
  target: 'electron-renderer',
  externalsPresets: {
    electronRenderer: false
  },
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
      chunks: ['main_window'],
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/cloud.html'),
      filename: 'cloud.html',
      chunks: ['cloud_window'],
    }),
    // Ensure static assets (CSS, fonts) are available at the dev server paths
    new CopyWebpackPlugin({
      patterns: [
        { from: path.resolve(__dirname, 'src/renderer/styles.css'), to: 'styles.css' },
        { from: path.resolve(__dirname, 'node_modules/@fortawesome/fontawesome-free/css/all.min.css'), to: 'fontawesome/css/all.min.css' },
        { from: path.resolve(__dirname, 'node_modules/@fortawesome/fontawesome-free/webfonts'), to: 'fontawesome/webfonts' },
      ]
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ],
  resolve: {
    extensions: ['.js', '.json', '.css'],
    fallback: {
      "util": require.resolve("util/"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "path": require.resolve("path-browserify"),
      "crypto": require.resolve("crypto-browserify"),
      "http": require.resolve("stream-http"),
      "events": require.resolve("events/"),
      "process": require.resolve("process/browser"),
      "fs": false
    }
  },
  devtool: 'source-map'
};