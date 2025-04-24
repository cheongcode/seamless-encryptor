const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
// Use our utility modules
const cryptoUtil = require('../crypto/encryption');
const keyManager = require('../config/keyManager');

let mainWindow;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
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

  // Load the index.html from webpack
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Set proper CSP headers
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"]
      }
    });
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Clean up temp files
  try {
    const tempDir = path.join(app.getPath('temp'), 'seamless-encryptor');
    if (fs.existsSync(tempDir)) {
      // Read directory and delete all files
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

// Mock storage service for now
const storageService = {
  uploadFile: async (key, data) => {
    // In a real app, this would upload to a cloud service
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    
    // Create the base directory if it doesn't exist
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    
    // Extract directory part from the key (e.g., "fileId" from "fileId/filename.enc")
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

// Helper function to decrypt data
async function decryptData(encryptedData, encryptionKey) {
  try {
    const key = Buffer.from(encryptionKey, 'hex');
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

// IPC Handlers
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile']
  });
  return result.filePaths[0];
});

ipcMain.handle('encrypt-and-upload', async (event, filePath) => {
  try {
    // Read file
    const fileData = await fs.promises.readFile(filePath);
    const fileName = path.basename(filePath);
    
    // Generate file key and encrypt
    const fileKey = crypto.randomBytes(32);
    const encryptedData = crypto.encrypt(fileData, fileKey);
    
    // Encrypt file key with master key
    const masterKey = await keyManager.getMasterKey();
    const encryptedKey = crypto.encryptKey(fileKey, masterKey);
    
    // Store encrypted key
    const fileId = crypto.randomBytes(16).toString('hex');
    keyManager.storeFileKey(fileId, encryptedKey);
    
    // Save encrypted data locally
    const storageKey = `${fileId}/${fileName}.enc`;
    await storageService.uploadFile(storageKey, encryptedData.encryptedData);
    
    return {
      success: true,
      fileId,
      fileName
    };
  } catch (error) {
    console.error('Encrypt and upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('download-file', async (event, { fileId, fileName }) => {
    try {
        // Send progress updates
        event.sender.send('download-progress', { progress: 0, status: 'Starting download...' });
        
        // Get encryption key
        const encryptionKey = getEncryptionKey();
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
        const decryptedData = await decryptData(encryptedData, encryptionKey.toString('hex'));

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

// Add new IPC handler for downloading encrypted files
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

ipcMain.handle('encrypt-file', async (event, filePath) => {
  try {
    // Notify start
    event.sender.send('progress', 0);
    
    // Implementation for file encryption
    const key = getEncryptionKey();
    const inputBuffer = await fs.promises.readFile(filePath);
    
    // Update progress
    event.sender.send('progress', 20);
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(inputBuffer),
      cipher.final()
    ]);
    
    // Update progress
    event.sender.send('progress', 50);
    
    const authTag = cipher.getAuthTag();
    const encryptedData = Buffer.concat([iv, authTag, encrypted]);
    
    // Upload to storage
    const fileId = crypto.randomBytes(16).toString('hex');
    const fileName = path.basename(filePath);
    const storageKey = `${fileId}/${fileName}.enc`;
    
    // Update progress
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

ipcMain.handle('decrypt-file', async (event, encryptedData) => {
  try {
    const key = getEncryptionKey();
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted;
  } catch (error) {
    event.sender.send('error', `Decryption failed: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('generate-key', () => {
  const key = crypto.randomBytes(32);
  return key.toString('hex');
});

let encryptionKey = null;

ipcMain.handle('set-key', (event, key) => {
  encryptionKey = Buffer.from(key, 'hex');
});

ipcMain.handle('get-key', () => {
  return encryptionKey ? encryptionKey.toString('hex') : null;
});

function getEncryptionKey() {
  if (!encryptionKey) {
    throw new Error('Encryption key not set');
  }
  return encryptionKey;
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
    // We need to save the file because renderer process can't directly access file paths
    const tempDir = path.join(app.getPath('temp'), 'seamless-encryptor');
    
    // Create temp dir if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate a unique file path with timestamp to avoid conflicts
    const timestamp = Date.now();
    const fileName = fileInfo.name || 'file';
    const tempFilePath = path.join(tempDir, `${timestamp}-${path.basename(fileName)}`);
    
    // Convert the array back to a buffer and write to file
    const buffer = Buffer.from(new Uint8Array(fileInfo.data));
    await fs.promises.writeFile(tempFilePath, buffer);
    
    // Schedule cleanup of the temp file (after 1 minute)
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
