// Main entry point for Electron
const { app } = require('electron');
const path = require('path');

// Import the main process code
require('./main/main');

// Remove the duplicated handler import
// require('../get-encrypted-files-handler');