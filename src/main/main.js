const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
// Key management
const keyManager = require('../config/keyManager');

let mainWindow;

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
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

  // Load UI from webpack
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Set CSP headers
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"]
      }
    });
  });
}

// Create window when app is ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Clean up temp files
  try {
    const tempDir = path.join(app.getPath('temp'), 'seamless-encryptor');
    if (fs.existsSync(tempDir)) {
      // Delete all files in the temp folder
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        fs.unlinkSync(filePath);
      }
      // Try to delete the directory
      fs.rmdirSync(tempDir);
    }
  } catch (error) {
    console.error('Error cleaning up temp directory:', error);
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Save/read/delete encrypted blobs under userData/encrypted
const storageService = {
  uploadFile: async (key, data) => {
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    
    const keyParts = key.split('/');
    if (keyParts.length > 1) {
      const dirPart = path.join(storageDir, keyParts[0]);
      if (!fs.existsSync(dirPart)) {
        fs.mkdirSync(dirPart, { recursive: true });
      }
    }
    
    const filePath = path.join(storageDir, key);
    await fs.promises.writeFile(filePath, data);
    return { key };
  },
  
  downloadFile: async (key) => {
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    const filePath = path.join(storageDir, key);
    
    if (fs.existsSync(filePath)) {
      return await fs.promises.readFile(filePath);
    }
    throw new Error('File not found');
  },
  
  deleteFile: async (key) => {
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    const filePath = path.join(storageDir, key);
    
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }
};

// Decrypts Buffer. Tries [iv|tag|ciphertext] then [iv|ciphertext|tag]
async function decryptData(encryptedData, encryptionKeyBuffer) {
  if (!Buffer.isBuffer(encryptedData)) {
    encryptedData = Buffer.from(encryptedData);
  }
  if (encryptedData.length < 33) {
    throw new Error('Invalid encrypted payload');
  }
  const tryLayouts = [
    () => ({ iv: encryptedData.slice(0, 16), tag: encryptedData.slice(16, 32), ct: encryptedData.slice(32) }),
    () => ({ iv: encryptedData.slice(0, 16), tag: encryptedData.slice(encryptedData.length - 16), ct: encryptedData.slice(16, encryptedData.length - 16) })
  ];
  let lastError = null;
  for (const pick of tryLayouts) {
    try {
      const { iv, tag, ct } = pick();
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKeyBuffer, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]);
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`Decryption failed: ${lastError ? lastError.message : 'Unknown error'}`);
}

// IPC
ipcMain.handle('encrypt-file', async (event, filePath) => {
  try {
    // Progress
    event.sender.send('progress', 0);
    
    // Key + file
    const key = await getEncryptionKey();
    const inputBuffer = await fs.promises.readFile(filePath);
    
    event.sender.send('progress', 20);
    
    // Encrypt
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(inputBuffer),
      cipher.final()
    ]);
    
    event.sender.send('progress', 50);
    
    // Assemble [iv|tag|ciphertext]
    const authTag = cipher.getAuthTag();
    const encryptedData = Buffer.concat([iv, authTag, encrypted]);
    
    // Save
    const fileId = crypto.randomBytes(16).toString('hex');
    const fileName = path.basename(filePath);
    const storageKey = `${fileId}/${fileName}.enc`;
    
    event.sender.send('progress', 70);
    
    await storageService.uploadFile(storageKey, encryptedData);
    
    // Complete
    event.sender.send('progress', 100);
    event.sender.send('success', 'File encrypted and uploaded successfully!');
    
    return {
      success: true,
      fileId,
      fileName
    };
  } catch (error) {
    event.sender.send('error', `Encryption failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
});

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

// Decrypt an encrypted .enc file by path and return a temp file path
ipcMain.handle('decrypt-file-from-path', async (_event, encryptedFilePath) => {
  try {
    const key = await getEncryptionKey();
    const encryptedData = await fs.promises.readFile(encryptedFilePath);
    const decrypted = await decryptData(encryptedData, key);
    const defaultName = path.basename(encryptedFilePath).replace(/\.enc$/i, '');
    const tempDir = path.join(app.getPath('temp'), 'seamless-encryptor');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempOut = path.join(tempDir, `${Date.now()}-${defaultName || 'decrypted'}`);
    await fs.promises.writeFile(tempOut, decrypted);
    return { success: true, path: tempOut };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

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

async function getEncryptionKey() {
  const key = await keyManager.getMasterKey();
  if (!key || key.length !== 32) {
    throw new Error('Encryption key not set');
  }
  return key;
}

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
