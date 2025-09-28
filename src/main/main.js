const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const keyManager = require('../config/keyManager');
const logger = require('../utils/logger');
const googleDriveService = require('../services/googleDriveService');
const http = require('http');
const url = require('url');

// Load environment variables
require('dotenv').config();

let mainWindow;

logger.initialize();
logger.info('App', 'Seamless Encryptor starting up', { 
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version
});

if (require('electron-squirrel-startup')) {
  logger.info('App', 'Squirrel startup detected, quitting');
  app.quit();
}

function createWindow() {
  try {
    logger.info('Window', 'Creating main window');
    
    mainWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
        sandbox: true,
        webSecurity: true
      },
    });

    mainWindow.webContents.on('did-finish-load', () => {
      logger.info('Window', 'Main window finished loading');
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      logger.error('Window', 'Main window failed to load', { 
        errorCode, 
        errorDescription 
      });
    });

    mainWindow.on('closed', () => {
      logger.info('Window', 'Main window closed');
      mainWindow = null;
    });

    logger.debug('Window', 'Loading webpack entry', { url: MAIN_WINDOW_WEBPACK_ENTRY });
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

    if (process.env.NODE_ENV === 'development') {
      logger.debug('Window', 'Opening DevTools (development mode)');
      mainWindow.webContents.openDevTools();
    }

    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      logger.trace('Security', 'Setting CSP headers', { url: details.url });
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://accounts.google.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com; frame-src 'self' https://accounts.google.com;"]
        }
      });
    });

    logger.info('Window', 'Main window created successfully');
  } catch (error) {
    logger.error('Window', 'Failed to create main window', { 
      error: error.message, 
      stack: error.stack 
    });
    throw error;
  }
}

app.whenReady().then(async () => {
  logger.info('App', 'App is ready, creating window');
  createWindow();
  
  logger.cleanupOldLogs();
  
  if (process.env.NODE_ENV === 'development') {
    try {
      logger.info('App', 'Running startup tests in development mode');
      const { createTestSuite } = require('../utils/testRunner');
      const testRunner = createTestSuite();
      
      setTimeout(async () => {
        const results = await testRunner.runTests();
        logger.info('App', 'Startup tests completed', results);
      }, 2000);
    } catch (testError) {
      logger.warn('App', 'Could not run startup tests', { error: testError.message });
    }
  }

  app.on('activate', () => {
    logger.debug('App', 'App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
      logger.info('App', 'No windows open, creating new window');
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logger.info('App', 'All windows closed, cleaning up');
  
  cleanupTempFiles();

  if (process.platform !== 'darwin') {
    logger.info('App', 'Quitting application (non-macOS)');
    app.quit();
  }
});

app.on('before-quit', () => {
  logger.info('App', 'Application is about to quit');
});
function cleanupTempFiles() {
  try {
    const tempDir = path.join(app.getPath('temp'), 'seamless-encryptor');
    
    if (!fs.existsSync(tempDir)) {
      logger.debug('Cleanup', 'Temp directory does not exist, nothing to clean');
      return;
    }

    logger.info('Cleanup', 'Starting temp directory cleanup', { tempDir });
    
    const files = fs.readdirSync(tempDir);
    let cleanedFiles = 0;
    
    for (const file of files) {
      try {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          fs.unlinkSync(filePath);
          cleanedFiles++;
          logger.trace('Cleanup', `Deleted temp file: ${file}`);
        } else if (stats.isDirectory()) {
          // Recursively clean subdirectories
          cleanupDirectory(filePath);
          logger.trace('Cleanup', `Cleaned temp directory: ${file}`);
        }
      } catch (fileError) {
        logger.warn('Cleanup', `Failed to delete temp file: ${file}`, { 
          error: fileError.message 
        });
      }
    }
    
    // Try to delete the main temp directory if it's empty
    try {
      const remainingFiles = fs.readdirSync(tempDir);
      if (remainingFiles.length === 0) {
        fs.rmdirSync(tempDir);
        logger.info('Cleanup', 'Removed empty temp directory');
      } else {
        logger.debug('Cleanup', `Temp directory not empty, ${remainingFiles.length} items remaining`);
      }
    } catch (dirError) {
      logger.warn('Cleanup', 'Failed to remove temp directory', { 
        error: dirError.message 
      });
    }
    
    logger.info('Cleanup', `Temp cleanup completed, ${cleanedFiles} files cleaned`);
    
  } catch (error) {
    logger.error('Cleanup', 'Error during temp directory cleanup', { 
      error: error.message, 
      stack: error.stack 
    });
  }
}

// Helper function for recursive directory cleanup
function cleanupDirectory(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        fs.unlinkSync(filePath);
      } else if (stats.isDirectory()) {
        cleanupDirectory(filePath);
      }
    }
    
    fs.rmdirSync(dirPath);
  } catch (error) {
    logger.warn('Cleanup', `Failed to cleanup directory: ${dirPath}`, { 
      error: error.message 
    });
  }
}

const storageService = {
  uploadFile: logger.wrapFunction('Storage', async (key, data) => {
    if (!key || !data) {
      throw new Error('Key and data are required for upload');
    }
    
    if (typeof key !== 'string' || key.includes('..') || key.includes('\\')) {
      throw new Error('Invalid key format');
    }
    
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    logger.debug('Storage', 'Uploading file', { key, dataSize: data.length, storageDir });
    
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
      logger.info('Storage', 'Created storage directory', { storageDir });
    }
    
    const keyParts = key.split('/');
    if (keyParts.length > 1) {
      const dirPart = path.join(storageDir, keyParts[0]);
      if (!fs.existsSync(dirPart)) {
        fs.mkdirSync(dirPart, { recursive: true });
        logger.debug('Storage', 'Created subdirectory', { dirPart });
      }
    }
    
    const filePath = path.join(storageDir, key);
    
    if (fs.existsSync(filePath)) {
      logger.warn('Storage', 'Overwriting existing file', { filePath });
    }
    
    await fs.promises.writeFile(filePath, data);
    logger.info('Storage', 'File uploaded successfully', { key, size: data.length });
    
    return { key, size: data.length, path: filePath };
  }, 'uploadFile'),
  
  downloadFile: logger.wrapFunction('Storage', async (key) => {
    if (!key || typeof key !== 'string') {
      throw new Error('Valid key is required for download');
    }
    
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    const filePath = path.join(storageDir, key);
    
    logger.debug('Storage', 'Downloading file', { key, filePath });
    
    if (!fs.existsSync(filePath)) {
      logger.error('Storage', 'File not found for download', { key, filePath });
      throw new Error(`File not found: ${key}`);
    }
    
    const stats = fs.statSync(filePath);
    const data = await fs.promises.readFile(filePath);
    
    logger.info('Storage', 'File downloaded successfully', { 
      key, 
      size: data.length,
      lastModified: stats.mtime
    });
    
    return data;
  }, 'downloadFile'),
  
  deleteFile: logger.wrapFunction('Storage', async (key) => {
    if (!key || typeof key !== 'string') {
      throw new Error('Valid key is required for deletion');
    }
    
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    const filePath = path.join(storageDir, key);
    
    logger.debug('Storage', 'Deleting file', { key, filePath });
    
    if (!fs.existsSync(filePath)) {
      logger.warn('Storage', 'Attempted to delete non-existent file', { key });
      return false;
    }
    
    await fs.promises.unlink(filePath);
    logger.info('Storage', 'File deleted successfully', { key });
    
    try {
      const dirPath = path.dirname(filePath);
      if (dirPath !== storageDir) {
        const remainingFiles = fs.readdirSync(dirPath);
        if (remainingFiles.length === 0) {
          fs.rmdirSync(dirPath);
          logger.debug('Storage', 'Cleaned up empty directory', { dirPath });
        }
      }
    } catch (cleanupError) {
      logger.debug('Storage', 'Could not cleanup directory', { 
        error: cleanupError.message 
      });
    }
    
    return true;
  }, 'deleteFile')
};

const decryptData = logger.wrapFunction('Crypto', async (encryptedData, encryptionKeyBuffer) => {
  logger.debug('Crypto', 'Starting decryption', { 
    dataLength: encryptedData?.length || 0,
    keyLength: encryptionKeyBuffer?.length || 0
  });
  
  if (!encryptedData) {
    throw new Error('Encrypted data is required');
  }
  
  if (!Buffer.isBuffer(encryptedData)) {
    encryptedData = Buffer.from(encryptedData);
    logger.trace('Crypto', 'Converted encrypted data to Buffer');
  }
  
  const minSize = 33;
  if (encryptedData.length < minSize) {
    logger.error('Crypto', 'Encrypted data too small', { 
      actualSize: encryptedData.length, 
      minSize 
    });
    throw new Error(`Invalid encrypted payload: file too small (${encryptedData.length} < ${minSize} bytes)`);
  }
  
  if (!Buffer.isBuffer(encryptionKeyBuffer) || encryptionKeyBuffer.length !== 32) {
    logger.error('Crypto', 'Invalid encryption key', { 
      keyType: typeof encryptionKeyBuffer,
      keyLength: encryptionKeyBuffer?.length || 0
    });
    throw new Error('Invalid encryption key: must be 32 bytes');
  }
  
  const tryLayouts = [
    () => ({ 
      iv: encryptedData.slice(0, 16), 
      tag: encryptedData.slice(16, 32), 
      ct: encryptedData.slice(32),
      layout: 'standard'
    }),
    () => ({ 
      iv: encryptedData.slice(0, 16), 
      tag: encryptedData.slice(encryptedData.length - 16), 
      ct: encryptedData.slice(16, encryptedData.length - 16),
      layout: 'alternative'
    })
  ];
  
  let lastError = null;
  for (const pick of tryLayouts) {
    try {
      const { iv, tag, ct, layout } = pick();
      
      logger.trace('Crypto', `Trying ${layout} layout`, {
        ivLength: iv.length,
        tagLength: tag.length,
        ctLength: ct.length
      });
      
      if (iv.length !== 16) throw new Error(`Invalid IV length: ${iv.length}`);
      if (tag.length !== 16) throw new Error(`Invalid auth tag length: ${tag.length}`);
      if (ct.length === 0) throw new Error('No ciphertext data');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKeyBuffer, iv);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
      
      logger.info('Crypto', `Decryption successful using ${layout} layout`, {
        originalSize: encryptedData.length,
        decryptedSize: decrypted.length
      });
      
      return decrypted;
    } catch (e) {
      logger.debug('Crypto', `${pick().layout} layout failed`, { error: e.message });
      lastError = e;
    }
  }
  
  logger.error('Crypto', 'All decryption layouts failed', { 
    lastError: lastError?.message 
  });
  throw new Error(`Decryption failed: ${lastError ? lastError.message : 'Authentication failed or corrupted data'}`);
}, 'decryptData');

ipcMain.handle('encrypt-file', logger.wrapFunction('IPC', async (event, filePath) => {
  logger.info('IPC', 'Starting file encryption', { filePath });
  
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Valid file path is required');
  }
  
  event.sender.send('progress', 0);
  
  if (!fs.existsSync(filePath)) {
    logger.error('IPC', 'File does not exist', { filePath });
    throw new Error('File does not exist');
  }
  
  const stats = await fs.promises.stat(filePath);
  if (!stats.isFile()) {
    logger.error('IPC', 'Path is not a file', { filePath, isDirectory: stats.isDirectory() });
    throw new Error('Path is not a file');
  }
  
  logger.debug('IPC', 'File validation passed', { 
    filePath, 
    fileSize: stats.size,
    lastModified: stats.mtime
  });
  
  const MAX_FILE_SIZE = 500 * 1024 * 1024;
  if (stats.size > MAX_FILE_SIZE) {
    logger.error('IPC', 'File too large for encryption', { 
      fileSize: stats.size,
      maxSize: MAX_FILE_SIZE,
      filePath
    });
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }
  
  const key = await getEncryptionKey();
  logger.debug('IPC', 'Encryption key obtained');
  
  const inputBuffer = await fs.promises.readFile(filePath);
  logger.debug('IPC', 'File read into buffer', { bufferSize: inputBuffer.length });
  
  event.sender.send('progress', 20);
  
  if (inputBuffer.length === 0) {
    logger.error('IPC', 'Cannot encrypt empty file', { filePath });
    throw new Error('Cannot encrypt empty file');
  }
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  logger.trace('IPC', 'Cipher initialized', { ivLength: iv.length });
  
  const encrypted = Buffer.concat([
    cipher.update(inputBuffer),
    cipher.final()
  ]);
  
  logger.debug('IPC', 'Data encrypted', { 
    originalSize: inputBuffer.length,
    encryptedSize: encrypted.length
  });
  
  event.sender.send('progress', 50);
  
  const authTag = cipher.getAuthTag();
  logger.trace('IPC', 'Authentication tag generated', { tagLength: authTag.length });
  
  const encryptedData = Buffer.concat([iv, authTag, encrypted]);
  
  const fileId = crypto.randomBytes(16).toString('hex');
  const fileName = path.basename(filePath);
  const storageKey = `${fileId}/${fileName}.enc`;
  
  logger.info('IPC', 'Preparing to store encrypted file', {
    fileId,
    fileName,
    storageKey,
    totalSize: encryptedData.length
  });
  
  event.sender.send('progress', 70);
  
  await storageService.uploadFile(storageKey, encryptedData);
  
  event.sender.send('progress', 100);
  event.sender.send('success', 'File encrypted and saved successfully!');
  
  const result = {
    success: true,
    fileId,
    fileName,
    originalSize: inputBuffer.length,
    encryptedSize: encryptedData.length
  };
  
  logger.info('IPC', 'File encryption completed successfully', result);
  return result;
  
}, 'encrypt-file'));

ipcMain.handle('decrypt-file', async (_event, encryptedData) => {
  try {
    const key = await getEncryptionKey();
    return await decryptData(Buffer.from(encryptedData), key);
  } catch (error) {
    console.error('Decryption failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Decrypt an encrypted file by path and prompt user for save location
ipcMain.handle('decrypt-file-from-path', async (event, encryptedFilePath) => {
  try {
    const key = await getEncryptionKey();
    const encryptedData = await fs.promises.readFile(encryptedFilePath);
    
    // Send progress update
    event.sender.send('progress', 30);
    
    const decrypted = await decryptData(encryptedData, key);
    
    // Send progress update
    event.sender.send('progress', 70);
    
    // Get original filename without .enc extension
    let defaultName = path.basename(encryptedFilePath).replace(/\.enc$/i, '').replace(/\.encrypted$/i, '');
    
    // If no extension remains, try to detect file type from magic bytes
    if (!path.extname(defaultName)) {
      const fileType = detectFileType(decrypted);
      if (fileType) {
        defaultName += fileType;
      }
    }
    
    // Prompt user for save location
    const savePath = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'] },
        { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] },
        { name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a'] }
      ]
    });

    if (savePath.canceled) {
      return { success: false, error: 'Decryption cancelled by user' };
    }

    // Save the decrypted file
    await fs.promises.writeFile(savePath.filePath, decrypted);
    
    // Send progress update
    event.sender.send('progress', 100);
    
    return { success: true, path: savePath.filePath, originalSize: encryptedData.length, decryptedSize: decrypted.length };
  } catch (error) {
    console.error('Decryption error:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to detect file type from magic bytes
function detectFileType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  
  const header = buffer.slice(0, 16);
  
  // Image formats
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return '.jpg';
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return '.png';
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) return '.gif';
  if (header[0] === 0x42 && header[1] === 0x4D) return '.bmp';
  if (header.slice(0, 4).toString() === 'RIFF' && header.slice(8, 12).toString() === 'WEBP') return '.webp';
  
  // Document formats
  if (header.slice(0, 4).toString() === '%PDF') return '.pdf';
  if (header[0] === 0xD0 && header[1] === 0xCF && header[2] === 0x11 && header[3] === 0xE0) return '.doc';
  if (header.slice(0, 4).toString() === 'PK\x03\x04') return '.docx'; // Could be docx, xlsx, etc.
  
  // Video formats
  if (header.slice(4, 8).toString() === 'ftyp') return '.mp4';
  if (header.slice(0, 4).toString() === 'RIFF' && header.slice(8, 12).toString() === 'AVI ') return '.avi';
  
  // Audio formats
  if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) return '.mp3';
  if (header.slice(0, 4).toString() === 'RIFF' && header.slice(8, 12).toString() === 'WAVE') return '.wav';
  if (header.slice(0, 4).toString() === 'fLaC') return '.flac';
  
  // Text formats (UTF-8 BOM)
  if (header[0] === 0xEF && header[1] === 0xBB && header[2] === 0xBF) return '.txt';
  
  return null;
}

ipcMain.handle('download-file', async (event, { fileId, fileName }) => {
    try {
        // Send progress updates
        event.sender.send('download-progress', { progress: 0, status: 'Starting download...' });
        
        // Get encryption key
        const encryptionKey = await getEncryptionKey();
        if (!encryptionKey) {
            throw new Error('Encryption key not found');
        }

        // Construct storage key
        const storageKey = `${fileId}/${fileName}.enc`;

        // Download encrypted data
        event.sender.send('download-progress', { progress: 25, status: 'Downloading encrypted file...' });
        const encryptedData = await storageService.downloadFile(storageKey);

        // Decrypt the data
        event.sender.send('download-progress', { progress: 50, status: 'Decrypting file...' });
        const decryptedData = await decryptData(encryptedData, encryptionKey);

        // Save the decrypted file
        event.sender.send('download-progress', { progress: 75, status: 'Saving file...' });
        const savePath = await dialog.showSaveDialog({
            defaultPath: fileName,
            filters: [{ name: 'All Files', extensions: ['*'] }]
        });

        if (savePath.canceled) {
            return { success: false, error: 'Download cancelled' };
        }

        await fs.promises.writeFile(savePath.filePath, decryptedData);
        event.sender.send('download-progress', { progress: 100, status: 'Download complete!' });

        return { success: true };
    } catch (err) {
        console.error('Download error:', err);
        return { success: false, error: err.message };
    }
});

// Download the encrypted file without decrypting
ipcMain.handle('download-encrypted-file', async (event, { fileId, fileName }) => {
    try {
        // Send progress updates
        event.sender.send('download-progress', { progress: 0, status: 'Starting download...' });
        
        // Construct storage key
        const storageKey = `${fileId}/${fileName}.enc`;

        // Download encrypted data
        event.sender.send('download-progress', { progress: 50, status: 'Downloading encrypted file...' });
        const encryptedData = await storageService.downloadFile(storageKey);

        // Save the encrypted file
        event.sender.send('download-progress', { progress: 75, status: 'Saving file...' });
        const savePath = await dialog.showSaveDialog({
            defaultPath: `${fileName}.encrypted`,
            filters: [{ name: 'Encrypted Files', extensions: ['encrypted'] }]
        });

        if (savePath.canceled) {
            return { success: false, error: 'Download cancelled' };
        }

        await fs.promises.writeFile(savePath.filePath, encryptedData);
        event.sender.send('download-progress', { progress: 100, status: 'Download complete!' });

        return { success: true };
    } catch (err) {
        console.error('Download error:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('delete-file', async (event, fileId) => {
  try {
    // Get the file info from the renderer
    const storageKey = `${fileId}/*`;
    
    // Find all files matching the pattern
    const storageDir = path.join(app.getPath('userData'), 'encrypted', fileId);
    if (fs.existsSync(storageDir)) {
      const files = fs.readdirSync(storageDir);
      for (const file of files) {
        await storageService.deleteFile(`${fileId}/${file}`);
      }
      
      // Remove the directory
      fs.rmdirSync(storageDir);
    }
    
    return {
      success: true
    };
  } catch (error) {
    event.sender.send('error', `Delete failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('generate-key', async () => {
  const key = keyManager.generateMasterKey();
  await keyManager.setMasterKey(key);
  return key.toString('hex');
});

ipcMain.handle('set-key', async (event, key) => {
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('Invalid key length: expected 32 bytes');
  }
  await keyManager.setMasterKey(keyBuffer);
  return true;
});

ipcMain.handle('get-key', async () => {
  const key = await keyManager.getMasterKey();
  return key ? key.toString('hex') : null;
});

const getEncryptionKey = logger.wrapFunction('KeyManager', async () => {
  logger.debug('KeyManager', 'Retrieving encryption key');
  
  const key = await keyManager.getMasterKey();
  
  if (!key) {
    logger.error('KeyManager', 'No encryption key found');
    throw new Error('Encryption key not set - please generate or import a key');
  }
  
  if (!Buffer.isBuffer(key)) {
    logger.error('KeyManager', 'Encryption key is not a Buffer', { keyType: typeof key });
    throw new Error('Invalid encryption key format');
  }
  
  if (key.length !== 32) {
    logger.error('KeyManager', 'Encryption key has invalid length', { 
      actualLength: key.length,
      expectedLength: 32
    });
    throw new Error('Encryption key must be 32 bytes');
  }
  
  logger.trace('KeyManager', 'Encryption key retrieved successfully', {
    keyLength: key.length
  });
  
  return key;
}, 'getEncryptionKey');

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('open-multiple-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Encrypted Files', extensions: ['enc', 'encrypted'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths;
  }
  return null;
});

ipcMain.handle('open-file-location', async (event, filePath) => {
  try {
    await shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error opening file location:', error);
    return { success: false, error: error.message };
  }
});

// Open URL in external browser
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external URL:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file-dialog', async () => {
  const result = await dialog.showSaveDialog({
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled) {
    return result.filePath;
  }
  return null;
});

// Key file management
ipcMain.handle('save-key-file', async (event, { filePath, keyData }) => {
  try {
    await fs.promises.writeFile(filePath, keyData, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error saving key file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-key-file', async (event, filePath) => {
  try {
    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    const keyData = JSON.parse(fileContent);
    
    // Validate key file format
    if (!keyData.key || typeof keyData.key !== 'string') {
      throw new Error('Invalid key file format: missing or invalid key');
    }
    
    // Validate key length (should be 64 hex characters for 32 bytes)
    if (keyData.key.length !== 64 || !/^[0-9a-fA-F]+$/.test(keyData.key)) {
      throw new Error('Invalid key format: key must be 64 hexadecimal characters');
    }
    
    return keyData;
  } catch (error) {
    console.error('Error loading key file:', error);
    throw new Error(`Failed to load key file: ${error.message}`);
  }
});

// Handle drag and drop files
ipcMain.handle('save-dropped-file', async (event, fileInfo) => {
  try {
    // Save to temp directory since renderer can't access file paths
    const tempDir = path.join(app.getPath('temp'), 'seamless-encryptor');
    
    // Create temp dir if needed
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create unique filename with timestamp
    const timestamp = Date.now();
    const fileName = fileInfo.name || 'file';
    const tempFilePath = path.join(tempDir, `${timestamp}-${path.basename(fileName)}`);
    
    // Convert array to buffer and save
    const buffer = Buffer.from(new Uint8Array(fileInfo.data));
    await fs.promises.writeFile(tempFilePath, buffer);
    
    // Clean up temp file after 1 minute
    setTimeout(() => {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError);
      }
    }, 60000);
    
    return tempFilePath;
  } catch (error) {
    event.sender.send('error', `Failed to process dropped file: ${error.message}`);
    throw error;
  }
});

// Google Drive Integration IPC Handlers

// Check if Google Drive credentials are available in environment
ipcMain.handle('google-drive-check-env-credentials', async () => {
  try {
    const hasCredentials = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    const credentials = hasCredentials ? {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uris: [process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/oauth2callback']
    } : null;
    
    return { 
      success: true, 
      hasCredentials,
      credentials: hasCredentials ? credentials : null
    };
  } catch (error) {
    logger.error('IPC', 'Failed to check environment credentials', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Initialize Google Drive with credentials (either from env or provided)
ipcMain.handle('google-drive-init', async (event, providedCredentials) => {
  try {
    logger.info('IPC', 'Initializing Google Drive service');
    
    // Use environment credentials if available, otherwise use provided credentials
    let credentials = providedCredentials;
    if (!credentials && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      credentials = {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uris: [process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/oauth2callback']
      };
      logger.info('IPC', 'Using Google Drive credentials from environment variables');
    }
    
    if (!credentials) {
      throw new Error('No Google Drive credentials available');
    }
    
    const result = await googleDriveService.initialize(credentials);
    return { success: true, authenticated: result };
  } catch (error) {
    logger.error('IPC', 'Google Drive initialization failed', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Get Google Drive auth URL
ipcMain.handle('google-drive-get-auth-url', async () => {
  try {
    const authUrl = googleDriveService.getAuthUrl();
    return { success: true, authUrl };
  } catch (error) {
    logger.error('IPC', 'Failed to get Google Drive auth URL', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Start OAuth flow with temporary server
ipcMain.handle('google-drive-start-oauth', async (event) => {
  try {
    logger.info('IPC', 'Starting Google Drive OAuth flow');
    
    return new Promise((resolve) => {
      // Create temporary HTTP server to handle OAuth callback
      const server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);
        
        if (parsedUrl.pathname === '/oauth2callback') {
          const code = parsedUrl.query.code;
          const error = parsedUrl.query.error;
          
          // Send response to browser
          res.writeHead(200, { 'Content-Type': 'text/html' });
          
          if (code) {
            res.end(`
              <html>
                <head>
                  <title>Authorization Successful</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                           text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { max-width: 400px; margin: 0 auto; background: white; 
                                padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .success { color: #4CAF50; font-size: 24px; margin-bottom: 20px; }
                    .message { color: #666; line-height: 1.6; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="success">✅ Authorization Successful!</div>
                    <div class="message">
                      You have successfully authorized Seamless Encryptor to access your Google Drive.
                      <br><br>
                      <strong>You can now close this tab and return to the application.</strong>
                    </div>
                  </div>
                  <script>
                    // Auto-close after 3 seconds
                    setTimeout(() => {
                      window.close();
                    }, 3000);
                  </script>
                </body>
              </html>
            `);
            
            // Close server and resolve with code
            server.close();
            resolve({ success: true, code });
          } else {
            res.end(`
              <html>
                <head>
                  <title>Authorization Failed</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                           text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { max-width: 400px; margin: 0 auto; background: white; 
                                padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .error { color: #f44336; font-size: 24px; margin-bottom: 20px; }
                    .message { color: #666; line-height: 1.6; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="error">❌ Authorization Failed</div>
                    <div class="message">
                      Authorization was cancelled or failed: ${error || 'Unknown error'}
                      <br><br>
                      <strong>You can close this tab and try again in the application.</strong>
                    </div>
                  </div>
                  <script>
                    setTimeout(() => {
                      window.close();
                    }, 5000);
                  </script>
                </body>
              </html>
            `);
            
            server.close();
            resolve({ success: false, error: error || 'Authorization cancelled' });
          }
        }
      });
      
      // Use port 3001 to avoid conflict with webpack dev server on 3000
      server.listen(3001, () => {
        logger.debug('IPC', 'OAuth callback server started on port 3001');
        
        // Get auth URL and open it
        const authUrl = googleDriveService.getAuthUrl();
        shell.openExternal(authUrl);
        
        // Set timeout to close server if no response
        setTimeout(() => {
          if (server.listening) {
            server.close();
            resolve({ success: false, error: 'Authorization timeout' });
          }
        }, 300000); // 5 minutes timeout
      });
      
      server.on('error', (err) => {
        logger.error('IPC', 'OAuth server error', { error: err.message });
        resolve({ success: false, error: `Server error: ${err.message}` });
      });
    });
  } catch (error) {
    logger.error('IPC', 'Failed to start OAuth flow', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Authenticate with authorization code
ipcMain.handle('google-drive-authenticate', async (event, code) => {
  try {
    logger.info('IPC', 'Authenticating with Google Drive');
    await googleDriveService.authenticate(code);
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Google Drive authentication failed', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Check if Google Drive is connected
ipcMain.handle('google-drive-is-connected', async () => {
  return { success: true, connected: googleDriveService.isConnected() };
});

// Upload file to Google Drive
ipcMain.handle('google-drive-upload', async (event, { fileId, fileName }) => {
  try {
    event.sender.send('google-drive-progress', { 
      progress: 0, 
      status: 'Preparing to upload to Google Drive...' 
    });

    // Get the encrypted file from local storage
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    const encryptedFilePath = path.join(storageDir, fileId, `${fileName}.enc`);

    if (!fs.existsSync(encryptedFilePath)) {
      throw new Error(`Encrypted file not found: ${fileName}`);
    }

    event.sender.send('google-drive-progress', { 
      progress: 25, 
      status: 'Uploading to Google Drive...' 
    });

    const result = await googleDriveService.uploadFile(encryptedFilePath, fileName, fileId);

    event.sender.send('google-drive-progress', { 
      progress: 100, 
      status: 'Upload completed!' 
    });

    logger.info('IPC', 'File uploaded to Google Drive', { fileId, fileName });
    return { success: true, ...result };
  } catch (error) {
    logger.error('IPC', 'Google Drive upload failed', { 
      fileId, 
      fileName, 
      error: error.message 
    });
    return { success: false, error: error.message };
  }
});

// Download file from Google Drive
ipcMain.handle('google-drive-download', async (event, { driveFileId, fileName, fileId }) => {
  try {
    event.sender.send('google-drive-progress', { 
      progress: 0, 
      status: 'Preparing to download from Google Drive...' 
    });

    // Create temp path for download
    const tempDir = path.join(app.getPath('temp'), 'seamless-encryptor');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `${Date.now()}_${fileName}.enc`);

    event.sender.send('google-drive-progress', { 
      progress: 25, 
      status: 'Downloading from Google Drive...' 
    });

    await googleDriveService.downloadFile(driveFileId, tempFilePath);

    event.sender.send('google-drive-progress', { 
      progress: 50, 
      status: 'Storing file locally...' 
    });

    // Store in local encrypted storage
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    const targetDir = path.join(storageDir, fileId);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, `${fileName}.enc`);
    fs.copyFileSync(tempFilePath, targetPath);
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    event.sender.send('google-drive-progress', { 
      progress: 100, 
      status: 'Download completed!' 
    });

    logger.info('IPC', 'File downloaded from Google Drive', { driveFileId, fileName });
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Google Drive download failed', { 
      driveFileId, 
      fileName, 
      error: error.message 
    });
    return { success: false, error: error.message };
  }
});

// List files in Google Drive
ipcMain.handle('google-drive-list-files', async () => {
  try {
    logger.debug('IPC', 'Listing Google Drive files');
    const files = await googleDriveService.listFiles();
    return { success: true, files };
  } catch (error) {
    logger.error('IPC', 'Failed to list Google Drive files', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Delete file from Google Drive
ipcMain.handle('google-drive-delete', async (event, driveFileId) => {
  try {
    logger.info('IPC', 'Deleting file from Google Drive', { driveFileId });
    await googleDriveService.deleteFile(driveFileId);
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Google Drive delete failed', { 
      driveFileId, 
      error: error.message 
    });
    return { success: false, error: error.message };
  }
});

// Get Google Drive user info
ipcMain.handle('google-drive-get-user-info', async () => {
  try {
    const userInfo = await googleDriveService.getUserInfo();
    return { success: true, ...userInfo };
  } catch (error) {
    logger.error('IPC', 'Failed to get Google Drive user info', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Sign out from Google Drive
ipcMain.handle('google-drive-sign-out', async () => {
  try {
    logger.info('IPC', 'Signing out from Google Drive');
    await googleDriveService.signOut();
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Google Drive sign out failed', { error: error.message });
    return { success: false, error: error.message };
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
