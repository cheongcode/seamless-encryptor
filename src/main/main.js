const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Import utility modules
const moduleCache = {};

/**
 * Safely require a module with fallback implementation
 * @param {string} modulePath - Path to the module
 * @param {Object} fallback - Fallback implementation if module cannot be loaded
 * @returns {Object} The loaded module or fallback
 */
function safeRequire(modulePath, fallback) {
  try {
    if (moduleCache[modulePath]) {
      return moduleCache[modulePath];
    }
    
    const module = require(modulePath);
    console.log(`Loaded module: ${modulePath}`);
    moduleCache[modulePath] = module;
    return module;
  } catch (err) {
    console.error(`Failed to load module: ${modulePath}`, err.message);
    return fallback;
  }
}

// Load required modules with fallbacks
const keyManager = safeRequire('../config/keyManager', {
  getKey: async () => {
    try {
      return encryptionKey || null;
    } catch (error) {
      console.error('Error in keyManager.getKey:', error);
      return null;
    }
  },
  setKey: async (key) => {
    try {
      global.encryptionKey = key;
      return true;
    } catch (error) {
      console.error('Error in keyManager.setKey:', error);
      return false;
    }
  },
  getMasterKey: async () => global.encryptionKey || null
});

const encryptionMethods = safeRequire('../crypto/encryptionMethods', {
  encrypt: async (data, key, algorithm = 'aes-256-gcm') => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      algorithm: 'aes-256-gcm',
      encryptedData: Buffer.concat([iv, authTag, encrypted])
    };
  },
  decrypt: async ({ encryptedData, algorithm }, key) => {
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  },
  getAllEncryptionMethods: () => ['aes-256-gcm'],
  getEncryptionMethod: () => 'aes-256-gcm',
  setEncryptionMethod: () => true
});

const entropyAnalyzer = safeRequire('../crypto/entropyAnalyzer', {
  calculateEntropy: (data) => {
    // Simple entropy calculation fallback
    if (!data || data.length === 0) return 0;
    const freqs = new Array(256).fill(0);
    for (let i = 0; i < data.length; i++) freqs[data[i]]++;
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (freqs[i] > 0) {
        const p = freqs[i] / data.length;
        entropy -= p * (Math.log(p) / Math.log(2));
      }
    }
    return entropy;
  },
  analyzeEntropyInChunks: (data) => ({
    overallEntropy: entropyAnalyzer.calculateEntropy(data),
    rating: 'Analysis Limited',
    isGoodEncryption: null
  })
});

const cryptoUtil = safeRequire('../crypto/cryptoUtil', {});

const { analyzeFileEntropy } = safeRequire('../crypto/entropyAnalyzer', {});

// Global variables
let mainWindow;
let encryptionKey = null;

// App initialization
console.log('📂 App path:', app.getAppPath());
console.log('📁 User data path:', app.getPath('userData'));

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
  console.log('[main.js] Starting createWindow function...');
  
  // Safely load optional dependencies
  const safeRequire = (module) => {
    try {
      return require(module);
    } catch (e) {
      console.warn(`[main.js] Could not load module: ${module}`, e.message);
      return null;
    }
  };

  // Define paths
  const APP_PATH = app.getAppPath();
  console.log('[main.js] App path:', APP_PATH);

  // Determine preload script path
  let preloadPath;
  try {
    if (typeof MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY !== 'undefined') {
      preloadPath = MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY;
      console.log('[main.js] Using webpack preload path:', preloadPath);
    } else {
      // Fallback to directly finding the preload script
      preloadPath = path.join(APP_PATH, 'preload.js');
      console.log('[main.js] Using fallback preload path:', preloadPath);
    }
  } catch (error) {
    // Ultimate fallback
    preloadPath = path.join(APP_PATH, 'preload.js');
    console.log('[main.js] Using ultimate fallback preload path:', preloadPath);
  }

  // Create the browser window
  try {
    mainWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath,
        sandbox: true,
        webSecurity: true
      },
    });
    console.log('[main.js] Browser window created successfully.');
  } catch (error) {
    console.error('[main.js] Failed to create browser window:', error.message);
    return;
  }

  // Determine HTML path
  let htmlPath;
  try {
    if (typeof MAIN_WINDOW_WEBPACK_ENTRY !== 'undefined') {
      htmlPath = MAIN_WINDOW_WEBPACK_ENTRY;
      console.log('[main.js] Using webpack HTML entry point:', htmlPath);
    } else {
      // Fallback to direct HTML file
      htmlPath = 'file://' + path.join(APP_PATH, 'src/renderer/index.html');
      console.log('[main.js] Using fallback HTML path:', htmlPath);
    }
  } catch (error) {
    // Ultimate fallback
    htmlPath = 'file://' + path.join(APP_PATH, 'src/renderer/index.html');
    console.log('[main.js] Using ultimate fallback HTML path:', htmlPath);
  }

  // Load the HTML
  try {
    console.log('[main.js] Loading HTML from:', htmlPath);
    mainWindow.loadURL(htmlPath);
  } catch (error) {
    console.error('[main.js] Failed to load HTML:', error.message);
    // Try a simpler approach if the first attempt fails
    try {
      const simplePath = 'file://' + path.join(APP_PATH, 'src/renderer/index.html');
      console.log('[main.js] Trying simpler HTML path:', simplePath);
      mainWindow.loadFile(path.join(APP_PATH, 'src/renderer/index.html'));
    } catch (innerError) {
      console.error('[main.js] Also failed with simpler path:', innerError.message);
    }
  }

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Log when content loads or fails
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main.js] Content finished loading successfully.');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[main.js] Content failed to load:', errorCode, errorDescription);
  });

  // Handle window being closed
  mainWindow.on('closed', function () {
    console.log('[main.js] Window closed event triggered.');
    mainWindow = null;
  });

  console.log('[main.js] Window creation complete.');
}

// Storage service for saving encrypted files
const storageService = {
  uploadFile: async (key, data) => {
    // For now, just save to the app's user data folder
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    
    // Create base directory if needed
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    
    // Create subdirectory for this file
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
async function decryptData(encryptedData, encryptionKey, algorithm) {
  try {
    const key = Buffer.from(encryptionKey, 'hex');
    
    // If an algorithm is specified, use it for decryption
    if (algorithm) {
      return await encryptionMethods.decrypt({ encryptedData, algorithm }, key);
    }
    
    // Legacy format (AES-256-GCM without algorithm tag)
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
ipcMain.handle('encrypt-file', async (event, filePath, method = 'aes-256-gcm') => {
  try {
    console.log(`encrypt-file handler called with:`, filePath, `method: ${method}`);
    
    // Input validation
    if (!filePath) {
      return { success: false, error: 'No file path provided' };
    }
    
    // If filePath is an array, take the first item (backward compatibility)
    if (Array.isArray(filePath)) {
      console.log('filePath is an array, taking the first item:', filePath[0]);
      filePath = filePath[0];
    }
    
    // If filePath is an object with a filePath property, extract it (backward compatibility)
    if (typeof filePath === 'object' && filePath !== null && filePath.filePath) {
      console.log('filePath is an object, extracting filePath property:', filePath.filePath);
      if (Array.isArray(filePath.filePath) && filePath.filePath.length > 0) {
        filePath = filePath.filePath[0];
      } else {
        filePath = filePath.filePath;
      }
    }
    
    // Last check to ensure filePath is a string
    if (typeof filePath !== 'string') {
      console.error('Invalid filePath format:', filePath);
      return { success: false, error: 'Invalid file path format' };
    }
    
    console.log(`Processing file: ${filePath}`);
    
    // Validate the encryption method
    const supportedMethods = ['aes-256-gcm', 'chacha20-poly1305', 'xchacha20-poly1305'];
    if (!method || !supportedMethods.includes(method)) {
      console.warn(`Unsupported encryption method: ${method}, defaulting to aes-256-gcm`);
      method = 'aes-256-gcm';
    }
    
    // Get encryption key - First check the global variable which should be set by generate-key
    let key = encryptionKey;
    console.log('Using encryption key exists:', !!key);
    
    // If no key in global variable, try to get from key manager
    if (!key && keyManager) {
      try {
        if (typeof keyManager.getKey === 'function') {
          key = await keyManager.getKey();
          console.log('Retrieved key from keyManager.getKey()');
        } else if (typeof keyManager.getMasterKey === 'function') {
          key = await keyManager.getMasterKey();
          console.log('Retrieved key from keyManager.getMasterKey()');
        }
      } catch (keyErr) {
        console.error('Error getting key from keyManager:', keyErr);
      }
    }
    
    // As a last resort, check if key exists in the file system
    if (!key) {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      if (fs.existsSync(keyPath)) {
        try {
          const keyData = fs.readFileSync(keyPath, 'utf8');
          key = Buffer.from(keyData, 'hex');
          console.log('Retrieved key from filesystem');
          // Store it for future use
          encryptionKey = key;
        } catch (fsErr) {
          console.error('Error reading key from filesystem:', fsErr);
        }
      }
    }
    
    if (!key) {
      console.error('No encryption key available');
      return { success: false, error: 'No encryption key available. Please generate or import a key first.' };
    }
    
    // If key is a hex string, convert to Buffer
    if (typeof key === 'string') {
      key = Buffer.from(key, 'hex');
    }
    
    // Ensure key is the right length (32 bytes for AES-256)
    if (key.length !== 32) {
      console.error(`Invalid key length: ${key.length} bytes, expected 32 bytes`);
      return { success: false, error: 'Invalid encryption key length.' };
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }
    
    // Read file content
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath);
    } catch (readError) {
      console.error('Error reading file:', readError);
      return { success: false, error: `Error reading file: ${readError.message}` };
    }
    
    // Generate a random IV (Initialization Vector)
    const iv = crypto.randomBytes(16);
    
    // Encrypt the file based on the selected method
    let encryptedData, authTag;
    
    if (method === 'aes-256-gcm') {
      // Use AES-256-GCM encryption
      try {
        const cipher = crypto.createCipheriv(method, key, iv);
        encryptedData = Buffer.concat([cipher.update(fileContent), cipher.final()]);
        authTag = cipher.getAuthTag(); // For AES-GCM, we need to get the authentication tag
      } catch (encryptError) {
        console.error('Error encrypting with AES-256-GCM:', encryptError);
        return { success: false, error: `Encryption error: ${encryptError.message}` };
      }
    } else if (method === 'chacha20-poly1305' || method === 'xchacha20-poly1305') {
      // Use ChaCha20-Poly1305 encryption
      try {
        const result = cryptoUtil.encryptChaCha20Poly1305(fileContent, key, iv);
        encryptedData = result.ciphertext;
        authTag = result.tag;
      } catch (encryptError) {
        console.error(`Error encrypting with ${method}:`, encryptError);
        return { success: false, error: `Encryption error: ${encryptError.message}` };
      }
    } else {
      return { success: false, error: `Unsupported encryption method: ${method}` };
    }
    
    // Convert encryption method to algorithm ID for storage
    const algorithmId = method === 'aes-256-gcm' ? 1 : 
                         method === 'chacha20-poly1305' ? 2 : 
                         method === 'xchacha20-poly1305' ? 3 : 1;
    
    // Prepare the encrypted file format with header
    // Format: [Magic Bytes (2)][Version (1)][Algorithm ID (1)][IV Length (1)][Auth Tag Length (1)][IV][Auth Tag][Ciphertext]
    const magicBytes = Buffer.from([0xF1, 0xE2]); // Magic bytes to identify our file format
    const formatVersion = Buffer.from([0x01]); // Version 1 of our format
    const algorithmIdBuffer = Buffer.from([algorithmId]);
    const ivLength = Buffer.from([iv.length]);
    const tagLength = Buffer.from([authTag.length]);
    
    const fullEncryptedData = Buffer.concat([
      magicBytes,
      formatVersion,
      algorithmIdBuffer,
      ivLength,
      tagLength,
      iv,
      authTag,
      encryptedData
    ]);
    
    // Generate a unique ID for the file
    const fileId = crypto.randomBytes(16).toString('hex');
    
    // Get original filename without path
    const fileName = path.basename(filePath);
    
    // Store the encrypted file
    const encryptedFilesDir = path.join(app.getPath('userData'), 'encrypted');
    if (!fs.existsSync(encryptedFilesDir)) {
      fs.mkdirSync(encryptedFilesDir, { recursive: true });
    }
    
    const encryptedFilePath = path.join(encryptedFilesDir, `${fileId}_${fileName}.enc`);
    
    try {
      fs.writeFileSync(encryptedFilePath, fullEncryptedData);
    } catch (writeError) {
      console.error('Error writing encrypted file:', writeError);
      return { success: false, error: `Error saving encrypted file: ${writeError.message}` };
    }
    
    // Store metadata about the encrypted file
    const metadata = {
      id: fileId,
      originalName: fileName,
      encryptedPath: encryptedFilePath,
      originalSize: fileContent.length,
      encryptedSize: fullEncryptedData.length,
      algorithm: method,
      timestamp: new Date().toISOString(),
    };
    
    // Save metadata to a database or file
    try {
      const metadataPath = path.join(encryptedFilesDir, 'metadata.json');
      let existingMetadata = [];
      
      if (fs.existsSync(metadataPath)) {
        try {
          const metadataContent = fs.readFileSync(metadataPath, 'utf8');
          existingMetadata = JSON.parse(metadataContent);
        } catch (parseError) {
          console.warn('Error parsing metadata, creating new file:', parseError);
        }
      }
      
      existingMetadata.push(metadata);
      fs.writeFileSync(metadataPath, JSON.stringify(existingMetadata, null, 2));
    } catch (metadataError) {
      console.warn('Error saving metadata, but encryption succeeded:', metadataError);
    }
    
    console.log(`File encrypted successfully: ${encryptedFilePath}`);
    
    return {
      success: true,
      fileId,
      fileName,
      algorithm: method,
      size: fileContent.length,
      encryptedPath: encryptedFilePath
    };
  } catch (error) {
    console.error('Error in encrypt-file handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('decrypt-file', async (event, fileId, fileName) => {
  try {
    console.log('decrypt-file handler called with:', { fileId, fileName });
    
    // Input validation
    if (!fileId) {
      return { success: false, error: 'No file ID provided' };
    }
    
    if (!fileName) {
      return { success: false, error: 'No file name provided' };
    }
    
    // Get encryption key
    const key = await keyManager.getKey();
    if (!key) {
      console.error('No encryption key available');
      return { success: false, error: 'No encryption key available' };
    }
    
    // Resolve file data - try different approaches
    let encryptedData, filePath;
    
    try {
      // First approach: Use storage service
      try {
        const fileData = await storageService.downloadFile(fileId);
        if (fileData && fileData.data) {
          encryptedData = Buffer.from(fileData.data);
          console.log(`Retrieved file data from storage service: ${encryptedData.length} bytes`);
        }
      } catch (storageError) {
        console.log('Storage service lookup failed, trying file path approach:', storageError.message);
      }
      
      // Second approach: Treat fileId as a path
      if (!encryptedData && typeof fileId === 'string' && (fileId.includes('/') || fileId.includes('\\'))) {
        filePath = fileId;
        if (fs.existsSync(filePath)) {
          encryptedData = fs.readFileSync(filePath);
          console.log(`Read file from path ${filePath}: ${encryptedData.length} bytes`);
        }
      }
      
      // Final fallback: Try to find file by name in the encrypted files directory
      if (!encryptedData) {
        const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
        if (fs.existsSync(encryptedDir)) {
          const possiblePaths = fs.readdirSync(encryptedDir)
            .filter(item => item.includes(fileId) || item.includes(fileName));
          
          if (possiblePaths.length > 0) {
            filePath = path.join(encryptedDir, possiblePaths[0]);
            encryptedData = fs.readFileSync(filePath);
            console.log(`Found file via directory search: ${filePath}`);
          }
        }
      }
    } catch (fsError) {
      console.error('Error reading encrypted file:', fsError);
      return { success: false, error: `Error reading file: ${fsError.message}` };
    }
    
    // If we still don't have data, return an error
    if (!encryptedData || encryptedData.length === 0) {
      console.error('Could not locate or read encrypted file data');
      return { success: false, error: 'Could not find or read encrypted file' };
    }
    
    // Extract metadata - first try the modern format with headers
    let algorithm = 'aes-256-gcm'; // Default algorithm
    let iv, tag, ciphertext;
    
    try {
      // Try to parse the file header
      const header = encryptedData.slice(0, 2).toString('hex');
      
      if (header === 'f1e2') { // Magic bytes for our encrypted file format
        const formatVersion = encryptedData[2];
        const algorithmId = encryptedData[3];
        
        // Map algorithm ID to name
        if (algorithmId === 1) {
          algorithm = 'aes-256-gcm';
        } else if (algorithmId === 2) {
          algorithm = 'chacha20-poly1305';
        }
        
        const ivLength = encryptedData[4];
        const tagLength = encryptedData[5];
        const headerLength = 6; // 2 magic bytes + 1 version + 1 algorithm + 1 ivLength + 1 tagLength
        
        iv = encryptedData.slice(headerLength, headerLength + ivLength);
        tag = encryptedData.slice(headerLength + ivLength, headerLength + ivLength + tagLength);
        ciphertext = encryptedData.slice(headerLength + ivLength + tagLength);
        
        console.log(`Parsed modern format: algorithm=${algorithm}, ivLength=${ivLength}, tagLength=${tagLength}`);
      } else {
        // Legacy format - fixed offsets
        iv = encryptedData.slice(0, 16);
        tag = encryptedData.slice(16, 32);
        ciphertext = encryptedData.slice(32);
        
        console.log('Using legacy format with fixed offsets');
      }
    } catch (parseError) {
      console.error('Error parsing encrypted data:', parseError);
      return { success: false, error: `Error parsing encrypted data: ${parseError.message}` };
    }
    
    // Now decrypt with the appropriate algorithm
    let decryptedData;
    try {
      if (algorithm === 'aes-256-gcm') {
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(tag);
        decryptedData = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
        ]);
      } else if (algorithm === 'chacha20-poly1305') {
        // Use ChaCha20-Poly1305 decryption
        decryptedData = cryptoUtil.decryptChaCha20Poly1305(ciphertext, key, iv, tag);
      } else {
        return { success: false, error: `Unsupported algorithm: ${algorithm}` };
      }
    } catch (decryptError) {
      console.error('Error decrypting data:', decryptError);
      return { success: false, error: `Decryption failed: ${decryptError.message}` };
    }
    
    if (!decryptedData) {
      return { success: false, error: 'Decryption produced no data' };
    }
    
    // Save the decrypted file
    const downloadsPath = app.getPath('downloads');
    const decryptedFilePath = path.join(downloadsPath, fileName);
    
    try {
      fs.writeFileSync(decryptedFilePath, decryptedData);
      console.log(`Decrypted file saved to: ${decryptedFilePath}`);
      
      return {
        success: true,
        filePath: decryptedFilePath
      };
    } catch (writeError) {
      console.error('Error writing decrypted file:', writeError);
      return { success: false, error: `Error saving decrypted file: ${writeError.message}` };
    }
  } catch (error) {
    console.error('Error in decrypt-file handler:', error);
    return { success: false, error: error.message };
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
        const metadataKey = `${fileId}/metadata.json`;

        // Try to get metadata
        let algorithm = null;
        try {
            const metadataRaw = await storageService.downloadFile(metadataKey);
            const metadata = JSON.parse(metadataRaw.toString());
            algorithm = metadata.algorithm;
        } catch (err) {
            console.warn('No metadata found, assuming AES-256-GCM:', err);
        }

        // Download encrypted data
        event.sender.send('download-progress', { progress: 25, status: 'Downloading encrypted file...' });
        const encryptedData = await storageService.downloadFile(storageKey);

        // Decrypt the data
        event.sender.send('download-progress', { progress: 50, status: `Decrypting file with ${algorithm || 'AES-256-GCM'}...` });
        const decryptedData = await decryptData(encryptedData, encryptionKey.toString('hex'), algorithm);

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
        const metadataKey = `${fileId}/metadata.json`;
        
        // Try to get metadata
        let algorithm = 'unknown';
        try {
            const metadataRaw = await storageService.downloadFile(metadataKey);
            const metadata = JSON.parse(metadataRaw.toString());
            algorithm = metadata.algorithm || 'unknown';
        } catch (err) {
            console.warn('No metadata found:', err);
        }

        // Download encrypted data
        event.sender.send('download-progress', { progress: 50, status: 'Downloading encrypted file...' });
        const encryptedData = await storageService.downloadFile(storageKey);

        // Save the encrypted file
        event.sender.send('download-progress', { progress: 75, status: 'Saving file...' });
        const savePath = await dialog.showSaveDialog({
            defaultPath: `${fileName}.${algorithm}.encrypted`,
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

// Handle delete-encrypted-file IPC call
ipcMain.handle('delete-encrypted-file', async (event, fileId) => {
  try {
    console.log('delete-encrypted-file handler called for file ID:', fileId);
    
    // Input validation
    if (!fileId) {
      return { success: false, error: 'No file ID provided' };
    }
    
    // Find the file in the encrypted files directory
    const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
    let filePath = '';
    
    // Check if the file ID directly matches a filename
    if (fs.existsSync(path.join(encryptedDir, fileId))) {
      filePath = path.join(encryptedDir, fileId);
    } else {
      // Look for files with this ID at the beginning of their name
      const files = fs.readdirSync(encryptedDir);
      const matchingFile = files.find(f => f.startsWith(fileId));
      
      if (matchingFile) {
        filePath = path.join(encryptedDir, matchingFile);
      } else {
        return { success: false, error: 'File not found' };
      }
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting encrypted file:', error);
    return { success: false, error: error.message };
  }
});

// Add list-files handler after the delete-file handler (around line 352)
ipcMain.handle('list-files', async (event) => {
  try {
    const storageDir = path.join(app.getPath('userData'), 'encrypted');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
      return []; // Return empty array if directory was just created
    }
    
    // Get all file IDs (directories)
    const fileIds = fs.readdirSync(storageDir).filter(item => {
      return fs.statSync(path.join(storageDir, item)).isDirectory();
    });
    
    // Get file info for each file
    const files = [];
    for (const fileId of fileIds) {
      const fileDir = path.join(storageDir, fileId);
      const fileItems = fs.readdirSync(fileDir);
      
      // Find the encrypted file and metadata
      const encFile = fileItems.find(file => file.endsWith('.enc'));
      const metadataFile = fileItems.find(file => file === 'metadata.json');
      
      if (encFile) {
        let metadata = {};
        if (metadataFile) {
          try {
            const metadataContent = fs.readFileSync(path.join(fileDir, metadataFile), 'utf8');
            metadata = JSON.parse(metadataContent);
          } catch (err) {
            console.warn(`Error reading metadata for ${fileId}: ${err.message}`);
          }
        }
        
        // Get file stats
        const stats = fs.statSync(path.join(fileDir, encFile));
        
        files.push({
          id: fileId,
          name: metadata.originalName || encFile.replace('.enc', ''),
          size: stats.size,
          date: metadata.timestamp || stats.mtime.toISOString(),
          algorithm: metadata.algorithm || 'unknown'
        });
      }
    }
    
    // Sort by date, newest first
    files.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return files;
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
});

// Add entropy analysis handler
ipcMain.handle('analyze-file-entropy', async (event, fileId) => {
  try {
    console.log('analyze-file-entropy handler called with:', fileId);
    
    if (!fileId) {
      return { success: false, error: 'No file ID provided' };
    }
    
    // Get the file path instead of trying to read a directory
    let filePath;
    let fileBuffer;
    
    try {
      // Check if the fileId is already a path
      if (typeof fileId === 'string' && (fileId.includes('/') || fileId.includes('\\'))) {
        filePath = fileId;
        // Check if the path exists and is a file, not a directory
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          return { success: false, error: 'Cannot analyze a directory' };
        }
        fileBuffer = fs.readFileSync(filePath);
      } else {
        // Otherwise, try to get the file data from storage service
        try {
          const encryptedData = await storageService.downloadFile(fileId);
          if (!encryptedData || !encryptedData.data) {
            return { success: false, error: 'File not found or empty' };
          }
          fileBuffer = Buffer.from(encryptedData.data);
        } catch (storageError) {
          console.error('Storage service error:', storageError);
          return { success: false, error: `Storage error: ${storageError.message}` };
        }
      }
    } catch (fsError) {
      console.error('File system error:', fsError);
      return { success: false, error: fsError.message };
    }
    
    if (!fileBuffer || fileBuffer.length === 0) {
      return { success: false, error: 'File is empty' };
    }
    
    // Analyze entropy in chunks
    const analysis = entropyAnalyzer.analyzeEntropyInChunks(fileBuffer);
    
    console.log('Entropy analysis complete:', {
      fileId: fileId,
      filePath: filePath,
      size: fileBuffer.length,
      overallEntropy: analysis.overallEntropy,
      rating: analysis.rating
    });
    
    return {
      success: true,
      analysis
    };
  } catch (error) {
    console.error('Error in entropy analysis:', error);
    return { success: false, error: error.message };
  }
});

// Add test-ipc handler
ipcMain.handle('test-ipc', async () => {
  console.log('[main.js] test-ipc handler called');
  return 'Test IPC successful!';
});

// Get all available encryption methods
ipcMain.handle('get-encryption-methods', () => {
  return encryptionMethods.getAllEncryptionMethods();
});

// Get current encryption method
ipcMain.handle('get-current-encryption-method', () => {
  return encryptionMethods.getEncryptionMethod();
});

// Set encryption method
ipcMain.handle('set-encryption-method', (event, method) => {
  const result = encryptionMethods.setEncryptionMethod(method);
  return {
    success: result,
    currentMethod: encryptionMethods.getEncryptionMethod()
  };
});

// Function to get the encryption key, generating one if needed
function getEncryptionKey() {
  console.log('getEncryptionKey called, encryptionKey exists:', !!encryptionKey);
  if (!encryptionKey) {
    try {
      // Try to get from key manager if available
      if (keyManager && typeof keyManager.getMasterKey === 'function') {
        console.log('Using keyManager.getMasterKey()');
        try {
          // The getMasterKey function returns a promise, but we need synchronous
          // behavior for this function. Using a temporary fallback key for now.
          encryptionKey = crypto.randomBytes(32);
          console.log('Generated temporary key while waiting for keyManager');
          
          // Try to get the actual key asynchronously for next time
          keyManager.getMasterKey().then(key => {
            encryptionKey = key;
            console.log('Successfully retrieved key from keyManager');
          }).catch(err => {
            console.error('Failed to get key from keyManager:', err);
          });
        } catch (keyErr) {
          console.error('Error accessing keyManager.getMasterKey:', keyErr);
          encryptionKey = crypto.randomBytes(32);
        }
        return encryptionKey;
      } else {
        // Generate a temporary key for the session
        console.log('No keyManager available, generating temporary encryption key');
        encryptionKey = crypto.randomBytes(32);
        console.warn('Using temporary encryption key. Keys will not persist between sessions.');
      }
    } catch (err) {
      console.error('Error getting encryption key:', err);
      // Generate a temporary key if key manager fails
      encryptionKey = crypto.randomBytes(32);
      console.warn('Using temporary encryption key due to error. Keys will not persist between sessions.');
    }
  }
  return encryptionKey;
}

// Handle check-key-status IPC call
ipcMain.handle('check-key-status', async (event) => {
  try {
    console.log('check-key-status handler called');
    
    // Try to get key from multiple sources
    let key = global.encryptionKey;
    let source = 'memory';
    
    // If no key in memory, try to get from key manager
    if (!key && keyManager && typeof keyManager.getKey === 'function') {
      try {
        key = await keyManager.getKey();
        if (key) source = 'keyManager';
      } catch (keyErr) {
        console.error('Error getting key from keyManager:', keyErr);
      }
    }
    
    // Check if key exists in file system as last resort
    if (!key) {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      if (fs.existsSync(keyPath)) {
        try {
          const keyData = fs.readFileSync(keyPath, 'utf8');
          key = Buffer.from(keyData, 'hex');
          source = 'file';
        } catch (fileErr) {
          console.error('Error reading key file:', fileErr);
        }
      }
    }
    
    if (key) {
      // Generate a short ID from the key for display purposes
      let keyId = '';
      if (Buffer.isBuffer(key)) {
        keyId = key.toString('hex').substring(0, 8);
      } else if (typeof key === 'string') {
        keyId = key.substring(0, 8);
      }
      
      return {
        exists: true,
        keyId: keyId,
        source: source
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error checking key status:', error);
    return { exists: false, error: error.message };
  }
});

// Handle generate-key IPC call
ipcMain.handle('generate-key', async (event) => {
  try {
    console.log('generate-key handler called');
    
    // Generate a secure random key
    const key = crypto.randomBytes(32); // 256 bits
    
    // Save the key in memory
    global.encryptionKey = key;
    
    // Try to save to key manager if available
    if (keyManager && typeof keyManager.setKey === 'function') {
      try {
        await keyManager.setKey(key);
      } catch (keyErr) {
        console.error('Error saving key to keyManager:', keyErr);
      }
    }
    
    // Always save to file system as backup
    try {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      fs.writeFileSync(keyPath, key.toString('hex'), 'utf8');
      console.log('Key saved to file system at:', keyPath);
    } catch (fileErr) {
      console.error('Error saving key to file system:', fileErr);
    }
    
    return {
      success: true,
      keyId: key.toString('hex').substring(0, 8)
    };
  } catch (error) {
    console.error('Error generating key:', error);
    return { success: false, error: error.message };
  }
});

// Handle get-encrypted-files IPC call
ipcMain.handle('get-encrypted-files', async (event) => {
  try {
    console.log('get-encrypted-files handler called');
    
    // Define the encrypted files directory
    const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(encryptedDir)) {
      fs.mkdirSync(encryptedDir, { recursive: true });
      console.log('Created encrypted files directory:', encryptedDir);
      return []; // Return empty array since no files exist yet
    }
    
    // Get all files in the directory
    const files = fs.readdirSync(encryptedDir);
    const fileList = [];
    
    // Process each file to get metadata
    for (const fileName of files) {
      try {
        const filePath = path.join(encryptedDir, fileName);
        const stats = fs.statSync(filePath);
        
        // Skip directories and non-regular files
        if (!stats.isFile()) continue;
        
        // Read metadata from file (first 1KB should contain metadata)
        const fileBuffer = Buffer.alloc(1024);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, fileBuffer, 0, 1024, 0);
        fs.closeSync(fd);
        
        // Try to extract metadata from the file header
        let metadata = {};
        try {
          // Look for JSON metadata at the beginning of the file
          const headerStr = fileBuffer.toString('utf8', 0, 1024);
          const metaMatch = headerStr.match(/^METADATA:(.*?)\n/);
          if (metaMatch && metaMatch[1]) {
            metadata = JSON.parse(metaMatch[1]);
          }
        } catch (metaErr) {
          console.log('Could not parse metadata for file:', fileName);
        }
        
        // Extract file extension from original name or current name
        const originalName = metadata.originalName || fileName;
        const extension = path.extname(originalName).toLowerCase();
        
        // Generate file ID from name (or use existing if present)
        const fileId = metadata.id || fileName.replace(/\.[^/.]+$/, '');
        
        // Calculate entropy sample (first 4KB max)
        const entropyBuffer = Buffer.alloc(Math.min(stats.size, 4096));
        const entropyFd = fs.openSync(filePath, 'r');
        fs.readSync(entropyFd, entropyBuffer, 0, entropyBuffer.length, 0);
        fs.closeSync(entropyFd);
        
        // Calculate entropy either with analyzer or fallback
        let entropy = 0.5; // Default midpoint
        if (entropyAnalyzer && typeof entropyAnalyzer.calculateEntropy === 'function') {
          entropy = entropyAnalyzer.calculateEntropy(entropyBuffer);
        }
        
        fileList.push({
          id: fileId,
          name: metadata.originalName || fileName,
          size: stats.size,
          created: metadata.created || stats.birthtime.getTime(),
          algorithm: metadata.algorithm || 'aes-256-gcm',
          entropy: entropy,
          extension: extension,
          path: filePath
        });
      } catch (fileErr) {
        console.error(`Error processing file ${fileName}:`, fileErr);
      }
    }
    
    console.log('Returning file list with', fileList.length, 'files');
    return fileList;
  } catch (error) {
    console.error('Error getting encrypted files:', error);
    throw error;
  }
});

// Handle import-key IPC call
ipcMain.handle('import-key', async (event, keyData) => {
  try {
    console.log('import-key handler called');
    
    // Validate key data
    if (!keyData) {
      return { success: false, error: 'No key data provided' };
    }
    
    // Convert to buffer if it's a hex string
    let key;
    if (typeof keyData === 'string') {
      // Check if it's a valid hex string
      if (!/^[0-9a-f]+$/i.test(keyData)) {
        return { success: false, error: 'Invalid key format, must be hex string' };
      }
      
      // Ensure key is 32 bytes (256 bits)
      if (keyData.length !== 64) { // 32 bytes = 64 hex chars
        return { success: false, error: 'Key must be 256 bits (32 bytes)' };
      }
      
      key = Buffer.from(keyData, 'hex');
    } else if (Buffer.isBuffer(keyData)) {
      // Ensure key is 32 bytes (256 bits)
      if (keyData.length !== 32) {
        return { success: false, error: 'Key must be 256 bits (32 bytes)' };
      }
      
      key = keyData;
    } else {
      return { success: false, error: 'Invalid key type, must be string or buffer' };
    }
    
    // Save the key to memory
    global.encryptionKey = key;
    
    // Try to save to key manager if available
    if (keyManager && typeof keyManager.setKey === 'function') {
      try {
        await keyManager.setKey(key);
      } catch (keyErr) {
        console.error('Error saving key to keyManager:', keyErr);
      }
    }
    
    // Always save to file system as backup
    try {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      fs.writeFileSync(keyPath, key.toString('hex'), 'utf8');
    } catch (fileErr) {
      console.error('Error saving key to file system:', fileErr);
    }
    
    return {
      success: true,
      keyId: key.toString('hex').substring(0, 8)
    };
  } catch (error) {
    console.error('Error importing key:', error);
    return { success: false, error: error.message };
  }
});

// Handle create-custom-key IPC call
ipcMain.handle('create-custom-key', async (event, passphrase, entropyPhrase) => {
  try {
    console.log('create-custom-key handler called');
    
    // Validate passphrases
    if (!passphrase) {
      return { success: false, error: 'No passphrase provided' };
    }
    
    // Create a key from the passphrase using PBKDF2
    // Use entropyPhrase as salt if provided, otherwise use a random salt
    const salt = entropyPhrase ? 
      crypto.createHash('sha256').update(entropyPhrase).digest().slice(0, 16) : 
      crypto.randomBytes(16);
    
    // Derive key with 100,000 iterations (strong security)
    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    
    // Save the key to memory
    global.encryptionKey = key;
    
    // Try to save to key manager if available
    if (keyManager && typeof keyManager.setKey === 'function') {
      try {
        await keyManager.setKey(key);
      } catch (keyErr) {
        console.error('Error saving key to keyManager:', keyErr);
      }
    }
    
    // Always save to file system as backup
    try {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      fs.writeFileSync(keyPath, key.toString('hex'), 'utf8');
    } catch (fileErr) {
      console.error('Error saving key to file system:', fileErr);
    }
    
    return {
      success: true,
      keyId: key.toString('hex').substring(0, 8)
    };
  } catch (error) {
    console.error('Error creating custom key:', error);
    return { success: false, error: error.message };
  }
});

// Handle get-key IPC call
ipcMain.handle('get-key', async (event) => {
  try {
    console.log('get-key handler called');
    
    // Try different methods to get the key
    let key;
    
    // Try the getKey method if it exists
    if (keyManager.getKey) {
      key = await keyManager.getKey();
    }
    // Try the getCurrentKey method if getKey failed or doesn't exist
    else if (keyManager.getCurrentKey) {
      key = await keyManager.getCurrentKey();
    }
    // Fallback implementation if neither method exists
    else {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      if (fs.existsSync(keyPath)) {
        key = fs.readFileSync(keyPath);
      }
    }
    
    if (!key) {
      console.log('No encryption key available');
      return null;
    }
    
    // Convert the key to hex string for easier handling in the renderer
    if (Buffer.isBuffer(key)) {
      return key.toString('hex');
    } else if (typeof key === 'string') {
      // If already a string, ensure it's a valid hex string
      return key.match(/^[0-9a-f]+$/i) ? key : Buffer.from(key).toString('hex');
    }
    
    return null;
  } catch (error) {
    console.error('Error in get-key handler:', error);
    return null;
  }
});

// Handle set-key IPC call
ipcMain.handle('set-key', async (event, keyHex) => {
  try {
    console.log('set-key handler called');
    
    encryptionKey = Buffer.from(keyHex, 'hex');
    console.log('Key set successfully');
    return true;
  } catch (error) {
    console.error('Error setting key:', error);
    throw error;
  }
});

// Fix the saveFileDialog handler to work with a filename parameter
ipcMain.handle('save-file-dialog', async (event, filename = 'file.txt') => {
  const result = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled) {
    return result.filePath;
  }
  return null;
});

ipcMain.handle('open-file-dialog', async () => {
  console.log('open-file-dialog handler called');
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  console.log('Dialog result:', result.canceled ? 'Canceled' : `Selected ${result.filePaths.length} files`);
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths;
  }
  return [];
});

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

console.log('[main.js] Reached end of main.js script execution.');

// Create window when app is ready
app.on('ready', () => {
  console.log('[main.js] App ready event received.');
  createWindow();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  console.log('[main.js] window-all-closed event received.');
  if (process.platform !== 'darwin') {
    console.log('[main.js] Quitting app (platform is not macOS).');
    app.quit();
  } else {
    console.log('[main.js] Not quitting app (platform is macOS).');
  }
});

// On macOS, re-create window when dock icon is clicked and no other windows are open
app.on('activate', () => {
  console.log('[main.js] activate event received.');
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log('[main.js] No windows open, calling createWindow() on activate.');
    createWindow();
  } else {
    console.log('[main.js] Windows already open, not creating new window on activate.');
  }
});
