const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/renderer/renderer.js',
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'renderer.js',
    publicPath: './'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/index.html'),
      filename: 'index.html'
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.css'
    })
  ],
  resolve: {
    extensions: ['.js']
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist/renderer'),
    },
    compress: true,
    port: 9000,
    hot: true
  }
}; 