const rules = require('./webpack.rules');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

console.log('Loading webpack.renderer.config.js...');

// Add CSS rule
rules.push({
  test: /\.css$/,
  use: [
    MiniCssExtractPlugin.loader,
    { loader: 'css-loader' }
  ],
});

module.exports = {
  module: {
    rules,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/index.html'),
      filename: 'index.html',
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.css'
    }),
  ],
  resolve: {
    extensions: ['.js', '.json', '.css'],
  },
  entry: {
    renderer: './src/renderer/renderer.js',
  },
  output: {
    path: path.resolve(__dirname, '.webpack/renderer'),
    filename: '[name].js',
    publicPath: './',
  },
  target: 'web',
};