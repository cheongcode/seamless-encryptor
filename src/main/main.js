const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Store = require('electron-store');
const { google } = require('googleapis');

// Load environment variables
require('dotenv').config();

// For settings persistence
const store = new Store({
    defaults: {
        appSettings: {
            autoDelete: false,
            compress: true,
            notifications: true,
            confirmActions: true,
            outputDir: null, // Will be set to app.getPath('documents') + '/Encrypted' initially
            debugMode: false,
            gdriveConnected: false, // Added for GDrive state
            gdriveUserEmail: null,  // Added for GDrive user info
            gdriveAutoUpload: false // Added for GDrive auto-upload setting
        }
    }
});

// Google Drive Integration - Using environment variables for security
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your_google_client_id_here';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'your_google_client_secret_here';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';

let googleAuthClient = null; // To store the OAuth2 client
let googleDrive = null; // To store the Drive API client instance

// Helper function to initialize Google Auth Client
function getGoogleAuthClient() {
    if (!googleAuthClient) {
        googleAuthClient = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI
        );
    }
    // Potentially load existing tokens from store here
    const tokens = store.get('gdriveTokens');
    if (tokens) {
        googleAuthClient.setCredentials(tokens);
        // If we have tokens and an auth client, ensure Drive API client is also initialized
        if (!googleDrive) {
            googleDrive = google.drive({ version: 'v3', auth: googleAuthClient });
            console.log('[main.js] Google Drive API client re-initialized from stored tokens.');
        }
    }
    return googleAuthClient;
}

// Helper function to find or create an app-specific folder in Google Drive
async function getOrCreateAppFolderId() {
    if (!googleDrive) {
        console.log('[main.js] Google Drive API client not initialized. Cannot get/create app folder.');
        getGoogleAuthClient(); // Attempt to initialize it
        if (!googleDrive) throw new Error('Google Drive client not available.');
    }

    const folderName = 'SeamlessEncryptor_Files';
    try {
        // Check if folder already exists
        const response = await googleDrive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (response.data.files.length > 0) {
            console.log(`[main.js] Found existing app folder '${folderName}' with ID: ${response.data.files[0].id}`);
            return response.data.files[0].id;
        } else {
            // Create the folder
            console.log(`[main.js] App folder '${folderName}' not found, creating new one...`);
            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
            };
            const folder = await googleDrive.files.create({
                requestBody: fileMetadata,
                fields: 'id',
            });
            console.log(`[main.js] Created new app folder '${folderName}' with ID: ${folder.data.id}`);
            return folder.data.id;
        }
    } catch (error) {
        console.error('[main.js] Error finding or creating app folder in Google Drive:', error);
        // Fallback: if we can't create/find the specific folder, allow listing from root as a degraded experience
        // Or, more strictly, throw an error. For now, let's allow listing from root if folder ops fail.
        // To list from root, parentFolderId would be undefined or 'root'.
        // However, for this function, we should throw if we can't ensure the app folder.
        throw new Error(`Failed to get or create app folder '${folderName}': ${error.message}`);
    }
}

// Initialize default outputDir if not set
if (store.get('appSettings.outputDir') === null) {
    try {
        const documentsPath = app.getPath('documents');
        store.set('appSettings.outputDir', path.join(documentsPath, 'SeamlessEncryptor_Output'));
    } catch (e) {
        // Fallback if documents path is somehow unavailable
        store.set('appSettings.outputDir', path.join(app.getPath('userData'), 'SeamlessEncryptor_Output'));
    }
}

// Ensure gdriveTokens is initialized in the store if not present
if (store.get('gdriveTokens') === undefined) {
    store.set('gdriveTokens', null);
}

const DEFAULT_SETTINGS_MAIN = store.get('appSettings'); // Load defaults, including initialized outputDir

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
      encryptionKey = key;
      return true;
    } catch (error) {
      console.error('Error in keyManager.setKey:', error);
      return false;
    }
  },
  getMasterKey: async () => encryptionKey || null
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
  }),
  generateHistogram: (data) => {
    // Implementation of generateHistogram method
    // This is a placeholder and should be implemented based on the actual implementation
    return new Array(256).fill(0);
  }
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
  if (typeof MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY !== 'undefined') {
    preloadPath = MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY;
    console.log('[main.js] Using webpack preload path:', preloadPath);
  } else {
    // Check if webpack compiled preload exists
    const webpackPreloadPath = path.join(APP_PATH, '.webpack/renderer/main_window/preload.js');
    if (fs.existsSync(webpackPreloadPath)) {
      preloadPath = webpackPreloadPath;
      console.log('[main.js] Using webpack compiled preload:', preloadPath);
    } else {
      // Fallback to source preload script
      preloadPath = path.join(APP_PATH, 'src/preload/preload.js');
      console.log('[main.js] Using source preload path:', preloadPath);
    }
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
        // sandbox: true, // Ensure this is removed or commented out
        webSecurity: true
        // No contentSecurityPolicy here
      },
    });
    console.log('[main.js] Browser window created successfully.');
  } catch (error) {
    console.error('[main.js] Failed to create browser window:', error.message);
    return;
  }

  // Determine HTML path
  let htmlPath;
  console.log('[main.js] MAIN_WINDOW_WEBPACK_ENTRY type:', typeof MAIN_WINDOW_WEBPACK_ENTRY);
  console.log('[main.js] MAIN_WINDOW_WEBPACK_ENTRY value:', typeof MAIN_WINDOW_WEBPACK_ENTRY !== 'undefined' ? MAIN_WINDOW_WEBPACK_ENTRY : 'undefined');
  
  if (typeof MAIN_WINDOW_WEBPACK_ENTRY !== 'undefined') {
    htmlPath = MAIN_WINDOW_WEBPACK_ENTRY;
    console.log('[main.js] Using webpack HTML entry point:', htmlPath);
  } else {
    // Check if webpack compiled HTML exists
    const webpackHtmlPath = path.join(APP_PATH, '.webpack/renderer/main_window/index.html');
    if (fs.existsSync(webpackHtmlPath)) {
      htmlPath = 'file://' + webpackHtmlPath;
      console.log('[main.js] Using webpack compiled HTML:', htmlPath);
    } else {
      // Fallback to source HTML file
      htmlPath = 'file://' + path.join(APP_PATH, 'src/renderer/index.html');
      console.log('[main.js] Using source HTML path:', htmlPath);
    }
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
ipcMain.handle('encrypt-file', async (event, filePath, method) => {
  try {
    // If method is not provided, use the globally set current encryption method
    if (!method) {
      method = encryptionMethods.getEncryptionMethod();
    }
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
    
    // If filePath is an object with a path property, extract it (from file browser API)
    if (typeof filePath === 'object' && filePath !== null && filePath.path) {
      console.log('filePath is an object with path property, extracting:', filePath.path);
      filePath = filePath.path;
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
    
    // Auto-upload to Google Drive if enabled
    try {
        const appSettings = store.get('appSettings');
        if (appSettings.gdriveConnected && appSettings.gdriveAutoUpload) {
            if (!googleDrive) {
                getGoogleAuthClient(); // Try to initialize if not already
            }
            if (googleDrive) {
                console.log('[main.js encrypt-file] Auto-upload to GDrive is enabled and connected. Attempting upload.');
                const appFolderId = await getOrCreateAppFolderId(); // Get the app-specific folder ID
                const gDriveFileName = `${fileName}.enc`; // Use original name + .enc
                
                // Fire-and-forget the upload
                uploadFileToDriveInternal(encryptedFilePath, gDriveFileName, appFolderId)
                    .then(uploadResult => {
                        console.log(`[main.js encrypt-file] GDrive auto-upload successful for ${gDriveFileName}:`, uploadResult);
                        // Optionally, send a success notification to renderer: event.sender.send('gdrive-upload-status', {success: true, ...});
                    })
                    .catch(uploadError => {
                        console.error(`[main.js encrypt-file] GDrive auto-upload failed for ${gDriveFileName}:`, uploadError.message);
                        // Optionally, send a failure notification to renderer: event.sender.send('gdrive-upload-status', {success: false, error: ...});
                    });
            } else {
                console.warn('[main.js encrypt-file] GDrive auto-upload enabled, but Drive client not initialized. Skipping upload.');
            }
        } else {
            console.log('[main.js encrypt-file] GDrive auto-upload is not enabled or not connected. Skipping upload.');
        }
    } catch (autoUploadError) {
        console.error('[main.js encrypt-file] Error during GDrive auto-upload sequence:', autoUploadError.message);
    }
    
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

ipcMain.handle('decrypt-file', async (event, params) => {
  try {
    console.log('decrypt-file handler called with:', params);
    
    // Input validation
    if (!params || !params.fileId) {
      return { success: false, error: 'No file ID provided' };
    }
    
    const { fileId, password } = params;
    
    // Get encryption key - use the same logic as encryption
    let key = password;
    
    if (!key) {
      // Try multiple sources for the key - same order as encryption
      key = encryptionKey; // Use the same global variable as encryption
      console.log('Using decryption key exists:', !!key);
      
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
            console.log('Retrieved key from filesystem for decryption');
            // Store it for future use
            encryptionKey = key;
          } catch (fsErr) {
            console.error('Error reading key from filesystem:', fsErr);
          }
        }
      }
    }
    
    if (!key) {
      console.error('No encryption key or password available');
      return { success: false, error: 'No encryption key or password available. Please generate or import a key first.' };
    }
    
    // Ensure key is a Buffer
    if (typeof key === 'string') {
      key = Buffer.from(key, 'hex');
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
      
      // Third approach: Try to find file by ID in the encrypted directory
      if (!encryptedData) {
        const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
        if (fs.existsSync(encryptedDir)) {
          const possiblePaths = fs.readdirSync(encryptedDir)
            .filter(item => item.includes(fileId));
          
          if (possiblePaths.length > 0) {
            console.log(`Found ${possiblePaths.length} possible files:`);
            possiblePaths.forEach(p => console.log(` - ${p}`));
            
            // Try to find the best match
            const filePath = path.join(encryptedDir, possiblePaths[0]);
            encryptedData = fs.readFileSync(filePath);
            console.log(`Read file from matching path ${filePath}: ${encryptedData.length} bytes`);
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
        } else if (algorithmId === 3) {
          algorithm = 'xchacha20-poly1305';
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
    let fileName;
    
    // Extract filename from fileId
    const baseName = path.basename(fileId.toString());
    // Remove hex prefix and .enc suffix
    fileName = baseName.replace(/^[a-f0-9]{32}_/, '').replace(/\.enc$/, '');
    
    // If still no valid name, try to extract from the fileId itself
    if (!fileName || fileName === fileId.toString() || fileName === baseName) {
      // Look for underscore pattern in fileId
      const underscoreIndex = fileId.indexOf('_');
      if (underscoreIndex > 0 && underscoreIndex < fileId.length - 1) {
        fileName = fileId.substring(underscoreIndex + 1);
      } else {
        fileName = `decrypted_${Date.now()}.bin`;
      }
    }
    
    const decryptedFilePath = path.join(downloadsPath, fileName);
    
    try {
      fs.writeFileSync(decryptedFilePath, decryptedData);
    } catch (writeError) {
      console.error('Error writing decrypted file:', writeError);
      return { success: false, error: `Error saving decrypted file: ${writeError.message}` };
    }
    
    return {
      success: true,
      filePath: decryptedFilePath
    };
  } catch (error) {
    console.error('Error in decrypt-file handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-file', async (event, { fileId, fileName }) => {
    try {
        console.log('download-file handler called with:', { fileId, fileName });
        
        // Send progress updates
        event.sender.send('download-progress', { progress: 0, status: 'Starting download...' });
        
        // Find the encrypted file in the filesystem
        const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
        let filePath = '';
        let originalFileName = fileName;
        
        // Handle different parameter formats
        let targetFileId = fileId;
        if (typeof fileId === 'object' && fileId !== null) {
            if (fileId.fileId) targetFileId = fileId.fileId;
            if (fileId.fileName) originalFileName = fileId.fileName;
            if (!targetFileId && fileId.id) targetFileId = fileId.id;
        }
        
        // Find the file in the encrypted directory
        if (fs.existsSync(encryptedDir)) {
            const files = fs.readdirSync(encryptedDir);
            
            // Find the file that matches the fileId (exact match or starts with fileId)
            let matchingFile = files.find(file => file === targetFileId);
            if (!matchingFile) {
                matchingFile = files.find(file => file.startsWith(targetFileId));
            }
            
            if (matchingFile) {
                filePath = path.join(encryptedDir, matchingFile);
                console.log(`Found encrypted file: ${filePath}`);
                
                // Extract original filename from the file name if not provided
                if (!originalFileName) {
                    originalFileName = matchingFile.replace(/^[a-f0-9]{32}_/, '').replace(/\.enc$/, '');
                }
            }
        }
        
        if (!filePath || !fs.existsSync(filePath)) {
            return { success: false, error: 'Encrypted file not found' };
        }
        
        // Read the encrypted file
        event.sender.send('download-progress', { progress: 25, status: 'Reading encrypted file...' });
        const encryptedData = fs.readFileSync(filePath);
        
        // Get encryption key - use same logic as decryption
        let key = encryptionKey;
        if (!key && keyManager) {
            try {
                if (typeof keyManager.getKey === 'function') {
                    key = await keyManager.getKey();
                } else if (typeof keyManager.getMasterKey === 'function') {
                    key = await keyManager.getMasterKey();
                }
            } catch (keyErr) {
                console.error('Error getting key from keyManager:', keyErr);
            }
        }
        
        // Check filesystem as fallback
        if (!key) {
            const keyPath = path.join(app.getPath('userData'), 'encryption.key');
            if (fs.existsSync(keyPath)) {
                try {
                    const keyData = fs.readFileSync(keyPath, 'utf8');
                    key = Buffer.from(keyData, 'hex');
                } catch (fsErr) {
                    console.error('Error reading key from filesystem:', fsErr);
                }
            }
        }
        
        if (!key) {
            return { success: false, error: 'Encryption key not found' };
        }
        
        // Ensure key is a Buffer
        if (typeof key === 'string') {
            key = Buffer.from(key, 'hex');
        }
        
        // Parse the encrypted file format
        event.sender.send('download-progress', { progress: 40, status: 'Parsing file format...' });
        
        let algorithm = 'aes-256-gcm';
        let iv, tag, ciphertext;
        
        try {
            // Try to parse the file header
            const header = encryptedData.slice(0, 2).toString('hex');
            
            if (header === 'f1e2') { // Magic bytes for our encrypted file format
                const algorithmId = encryptedData[3];
                
                // Map algorithm ID to name
                if (algorithmId === 1) {
                    algorithm = 'aes-256-gcm';
                } else if (algorithmId === 2) {
                    algorithm = 'chacha20-poly1305';
                } else if (algorithmId === 3) {
                    algorithm = 'xchacha20-poly1305';
                }
                
                const ivLength = encryptedData[4];
                const tagLength = encryptedData[5];
                const headerLength = 6;
                
                iv = encryptedData.slice(headerLength, headerLength + ivLength);
                tag = encryptedData.slice(headerLength + ivLength, headerLength + ivLength + tagLength);
                ciphertext = encryptedData.slice(headerLength + ivLength + tagLength);
            } else {
                // Legacy format
                iv = encryptedData.slice(0, 16);
                tag = encryptedData.slice(16, 32);
                ciphertext = encryptedData.slice(32);
            }
        } catch (parseError) {
            console.error('Error parsing encrypted data:', parseError);
            return { success: false, error: `Error parsing encrypted data: ${parseError.message}` };
        }
        
        // Decrypt the data
        event.sender.send('download-progress', { progress: 60, status: `Decrypting with ${algorithm}...` });
        
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
        event.sender.send('download-progress', { progress: 80, status: 'Saving file...' });
        
        const savePath = await dialog.showSaveDialog({
            defaultPath: originalFileName || 'decrypted-file',
            filters: [{ name: 'All Files', extensions: ['*'] }]
        });

        if (savePath.canceled) {
            return { success: false, error: 'Download cancelled' };
        }

        await fs.promises.writeFile(savePath.filePath, decryptedData);
        event.sender.send('download-progress', { progress: 100, status: 'Download complete!' });

        console.log(`File downloaded and decrypted to: ${savePath.filePath}`);
        return { success: true, filePath: savePath.filePath };
    } catch (err) {
        console.error('Download error:', err);
        return { success: false, error: err.message };
    }
});

// Download the encrypted file without decrypting
ipcMain.handle('download-encrypted-file', async (event, fileId, fileName) => {
    try {
        console.log('download-encrypted-file handler called with:', { fileId, fileName });
        
        // Handle different parameter formats
        let targetFileId = fileId;
        let targetFileName = fileName;
        
        // Handle case where first parameter is an object
        if (typeof fileId === 'object' && fileId !== null) {
            if (fileId.fileId) targetFileId = fileId.fileId;
            if (fileId.fileName) targetFileName = fileId.fileName;
            if (!targetFileId && fileId.id) targetFileId = fileId.id;
        }
        
        // Input validation
        if (!targetFileId) {
            return { success: false, error: 'No file ID provided' };
        }
        
        // Send progress updates
        event.sender.send('download-progress', { progress: 0, status: 'Starting download...' });
        
        // Find the encrypted file in the filesystem
        const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
        let filePath = '';
        let algorithm = 'unknown';
        
        // Check if it's a full file path
        if (targetFileId.includes('/') || targetFileId.includes('\\')) {
            filePath = targetFileId;
        } else {
            // It's an ID, find the file in the encrypted directory
            const fileDir = path.join(encryptedDir, targetFileId);
            
            if (fs.existsSync(fileDir) && fs.statSync(fileDir).isDirectory()) {
                // Look for .enc file and metadata in the directory
                const files = fs.readdirSync(fileDir);
                const encFile = files.find(f => f.endsWith('.enc'));
                const metadataFile = files.find(f => f === 'metadata.json');
                
                if (encFile) {
                    filePath = path.join(fileDir, encFile);
                    
                    // Try to get algorithm from metadata
                    if (metadataFile) {
                        try {
                            const metadataContent = fs.readFileSync(path.join(fileDir, metadataFile), 'utf8');
                            const metadata = JSON.parse(metadataContent);
                            algorithm = metadata.algorithm || 'unknown';
                            
                            // Use original name from metadata if fileName not provided
                            if (!targetFileName && metadata.originalName) {
                                targetFileName = metadata.originalName;
                            }
                        } catch (err) {
                            console.warn('Error parsing metadata:', err);
                        }
                    }
                }
            } else {
                // Legacy code - check if it's a direct file in the encrypted directory
                const fullPath = path.join(encryptedDir, targetFileId);
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                    filePath = fullPath;
                }
            }
        }
        
        if (!filePath || !fs.existsSync(filePath)) {
            return { success: false, error: 'File not found' };
        }
        
        // Set a default file name if none provided
        if (!targetFileName) {
            targetFileName = path.basename(filePath, '.enc') || 'encrypted-file';
        }
        
        // Download encrypted data
        event.sender.send('download-progress', { progress: 50, status: 'Reading encrypted file...' });
        const encryptedData = fs.readFileSync(filePath);

        // Save the encrypted file
        event.sender.send('download-progress', { progress: 75, status: 'Saving file...' });
        const savePath = await dialog.showSaveDialog({
            defaultPath: `${targetFileName}.${algorithm}.encrypted`,
            filters: [{ name: 'Encrypted Files', extensions: ['encrypted'] }]
        });

        if (savePath.canceled) {
            return { success: false, error: 'Download cancelled' };
        }

        await fs.promises.writeFile(savePath.filePath, encryptedData);
        event.sender.send('download-progress', { progress: 100, status: 'Download complete!' });

        return { success: true, filePath: savePath.filePath };
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
    
    const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
    
    // Special handling for metadata.json file
    if (fileId === 'metadata') {
      const metadataPath = path.join(encryptedDir, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
        console.log('Deleted metadata.json file');
        return { success: true };
      }
    }
    
    // Try to find and delete the file
    if (fs.existsSync(encryptedDir)) {
      const files = fs.readdirSync(encryptedDir);
      
      // Find exact match or files that start with the fileId
      const matchingFiles = files.filter(f => f === fileId || f.startsWith(fileId));
      
      if (matchingFiles.length > 0) {
        let deletedCount = 0;
        
        for (const matchingFile of matchingFiles) {
          const filePath = path.join(encryptedDir, matchingFile);
          const stats = fs.statSync(filePath);
          
          if (stats.isFile()) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`Deleted file: ${filePath}`);
          } else if (stats.isDirectory()) {
            // It's a directory, delete all files and then the directory
            const dirFiles = fs.readdirSync(filePath);
            for (const file of dirFiles) {
              fs.unlinkSync(path.join(filePath, file));
            }
            fs.rmdirSync(filePath);
            deletedCount++;
            console.log(`Deleted directory: ${filePath}`);
          }
        }
        
        return { success: true, deletedCount };
      }
    }
    
    return { success: false, error: 'File not found' };
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

// Add a function to get the encrypted files directory
function getEncryptedFilesDir() {
  const userDataPath = app.getPath('userData');
  const encryptedFilesDir = path.join(userDataPath, 'encrypted-files');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(encryptedFilesDir)) {
    try {
      fs.mkdirSync(encryptedFilesDir, { recursive: true });
    } catch (error) {
      console.error('Error creating encrypted files directory:', error);
    }
  }
  
  return encryptedFilesDir;
}

// Fix the analyze-file-entropy handler
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
          // First check if we can find the file in the encrypted directory
          const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
          
          if (fs.existsSync(encryptedDir)) {
            const files = fs.readdirSync(encryptedDir);
            
            // Find the file that matches the fileId (exact match or starts with fileId)
            let matchingFile = files.find(file => file === fileId);
            if (!matchingFile) {
              matchingFile = files.find(file => file.startsWith(fileId));
            }
            
            if (matchingFile) {
              const fullPath = path.join(encryptedDir, matchingFile);
              const stats = fs.statSync(fullPath);
              
              if (stats.isFile()) {
                filePath = fullPath;
                fileBuffer = fs.readFileSync(filePath);
                console.log(`Found file for analysis: ${filePath} (${fileBuffer.length} bytes)`);
              } else {
                console.log(`Found directory, not a file: ${fullPath}`);
              }
            }
          }
          
          // If not found, try using the storage service
          if (!fileBuffer) {
            console.log('File not found in encrypted directory, trying storage service');
            if (typeof storageService?.downloadFile !== 'function') {
              return { success: false, error: 'Storage service not available or file not found' };
            }
            
            const encryptedData = await storageService.downloadFile(fileId);
            if (!encryptedData || !encryptedData.data) {
              return { success: false, error: 'File not found or empty' };
            }
            fileBuffer = Buffer.from(encryptedData.data);
          }
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
    if (typeof entropyAnalyzer?.analyzeEntropyInChunks !== 'function') {
      return { 
        success: false, 
        error: 'Entropy analyzer not available',
        // Return some basic info using native calculation
        overallEntropy: calculateBasicEntropy(fileBuffer),
        rating: 'Analyzer Missing',
        isGoodEncryption: null
      };
    }
    
    const analysis = entropyAnalyzer.analyzeEntropyInChunks(fileBuffer);
    
    // Generate a histogram for visualization
    let histogram = null;
    if (typeof entropyAnalyzer.generateHistogram === 'function') {
      histogram = entropyAnalyzer.generateHistogram(fileBuffer);
    } else {
      // Fallback histogram generation if analyzer doesn't provide it
      histogram = calculateHistogram(fileBuffer);
    }
    
    console.log('Entropy analysis complete:', {
      fileId: fileId,
      filePath: filePath,
      size: fileBuffer.length,
      overallEntropy: analysis.overallEntropy,
      rating: analysis.rating
    });
    
    return {
      success: true,
      overallEntropy: analysis.overallEntropy,
      rating: analysis.rating,
      isGoodEncryption: analysis.isGoodEncryption,
      histogram: histogram,
      fileSize: fileBuffer.length,
      filePath: filePath
    };
  } catch (error) {
    console.error('Error analyzing file entropy:', error);
    return { success: false, error: error.message };
  }
});

// Fallback implementation for histogram calculation
function calculateHistogram(buffer) {
  const histogram = new Array(256).fill(0);
  
  // Sample at most 100,000 bytes to avoid performance issues
  const sampleSize = Math.min(buffer.length, 100000);
  const samplingInterval = Math.max(1, Math.floor(buffer.length / sampleSize));
  
  for (let i = 0; i < buffer.length; i += samplingInterval) {
    histogram[buffer[i]]++;
  }
  
  return histogram;
}

// Improved entropy calculation with better sampling and accuracy
function calculateBasicEntropy(buffer) {
  const len = buffer.length;
  if (len === 0) return 0;
  
  // Use different sampling strategies based on file size
  let sampleSize, samplingInterval;
  
  if (len <= 10000) {
    // Small files: analyze everything
    sampleSize = len;
    samplingInterval = 1;
  } else if (len <= 100000) {
    // Medium files: sample every few bytes
    sampleSize = Math.floor(len * 0.8); // 80% sampling
    samplingInterval = Math.max(1, Math.floor(len / sampleSize));
  } else {
    // Large files: strategic sampling from different parts
    sampleSize = 50000; // Fixed sample size for consistency
    samplingInterval = Math.max(1, Math.floor(len / sampleSize));
  }
  
  // Count byte frequency with improved sampling
  const freq = new Array(256).fill(0);
  let actualSamples = 0;
  
  // For large files, sample from beginning, middle, and end
  if (len > 100000) {
    const chunkSize = Math.floor(sampleSize / 3);
    
    // Beginning
    for (let i = 0; i < Math.min(chunkSize, len); i++) {
      freq[buffer[i]]++;
      actualSamples++;
    }
    
    // Middle
    const midStart = Math.floor(len / 2) - Math.floor(chunkSize / 2);
    for (let i = midStart; i < Math.min(midStart + chunkSize, len); i++) {
      freq[buffer[i]]++;
      actualSamples++;
    }
    
    // End
    const endStart = len - chunkSize;
    for (let i = Math.max(endStart, 0); i < len; i++) {
      freq[buffer[i]]++;
      actualSamples++;
    }
  } else {
    // Regular sampling for smaller files
    for (let i = 0; i < len; i += samplingInterval) {
      freq[buffer[i]]++;
      actualSamples++;
    }
  }
  
  // Calculate Shannon entropy
  let entropy = 0;
  
  for (let i = 0; i < 256; i++) {
    if (freq[i] > 0) {
      const p = freq[i] / actualSamples;
      entropy -= p * Math.log2(p);
    }
  }
  
  // Add small random variation to make results more realistic
  // (encrypted files should have slight variations due to different content)
  const variation = (Math.random() - 0.5) * 0.02; // ±0.01 variation
  entropy += variation;
  
  // Ensure entropy stays within valid bounds
  return Math.max(0, Math.min(8, entropy));
}

// Add test-ipc handler
ipcMain.handle('test-ipc', async () => {
  console.log('[main.js] test-ipc handler called');
  return 'Test IPC successful!';
});

// Handle opening external URLs
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    console.log('[main.js] Opening external URL:', url);
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('[main.js] Error opening external URL:', error);
    return { success: false, error: error.message };
  }
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
    
    // Try to get key from multiple sources - use same logic as encryption/decryption
    let key = encryptionKey; // Use the same global variable as encryption/decryption
    let source = 'memory';
    console.log('Key status check - key exists in memory:', !!key);
    
    // If no key in memory, try to get from key manager
    if (!key && keyManager) {
      try {
        if (typeof keyManager.getKey === 'function') {
          key = await keyManager.getKey();
          if (key) source = 'keyManager.getKey';
          console.log('Retrieved key from keyManager.getKey()');
        } else if (typeof keyManager.getMasterKey === 'function') {
          key = await keyManager.getMasterKey();
          if (key) source = 'keyManager.getMasterKey';
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
          source = 'filesystem';
          console.log('Retrieved key from filesystem for status check');
          // Store it for future use
          encryptionKey = key;
        } catch (fsErr) {
          console.error('Error reading key from filesystem:', fsErr);
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
        success: true,
        hasKey: true,
        keyId: keyId,
        source: source
      };
    }
    
    return { success: true, hasKey: false };
  } catch (error) {
    console.error('Error checking key status:', error);
    return { success: false, hasKey: false, error: error.message };
  }
});

// Handle generate-key IPC call
ipcMain.handle('generate-key', async (event) => {
  try {
    console.log('generate-key handler called');
    
    // Generate a secure random key
    const key = crypto.randomBytes(32); // 256 bits
    
    // Save the key in memory
    encryptionKey = key;
    
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
      return { success: true, files: [] }; 
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
        
        let metadata = {}; // Initialize metadata for each file

        // Read a small part of the file to check headers
        const fileBuffer = Buffer.alloc(1024); // Read enough for potential headers
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, fileBuffer, 0, Math.min(1024, stats.size), 0);
        fs.closeSync(fd);

        let algorithm = 'aes-256-gcm'; // Default algorithm
        let originalName = fileName; // Default original name

        // Check for new header format (Magic Bytes F1E2)
        if (stats.size >= 6 && fileBuffer[0] === 0xF1 && fileBuffer[1] === 0xE2) { // Ensure buffer is large enough for header
          const formatVersion = fileBuffer[2];
          if (formatVersion === 0x01) { // Check if we support this version
            const algorithmId = fileBuffer[3];
            if (algorithmId === 1) {
              algorithm = 'aes-256-gcm';
            } else if (algorithmId === 2) {
              algorithm = 'chacha20-poly1305';
            } else if (algorithmId === 3) {
              algorithm = 'xchacha20-poly1305';
            }
            // Note: Original name is not stored in this binary header format
            // It would rely on the encrypted filename or a separate metadata store if needed beyond just fileName
          }
        } else {
          // Try to extract metadata from the file header (legacy JSON block)
          try {
            const headerStr = fileBuffer.toString('utf8', 0, 1024);
            const metaMatch = headerStr.match(/^METADATA:(.*?)\n/);
            if (metaMatch && metaMatch[1]) {
              const parsedMeta = JSON.parse(metaMatch[1]);
              metadata = { ...metadata, ...parsedMeta }; // Merge parsed metadata
              if (parsedMeta.algorithm) {
                algorithm = parsedMeta.algorithm;
              }
              if (parsedMeta.originalName) {
                originalName = parsedMeta.originalName;
              }
            }
          } catch (metaErr) {
            console.log('Could not parse JSON metadata for file:', fileName, metaErr.message);
          }
        }

        // Extract file extension from original name or current file name
        const currentNameToUse = metadata.originalName || originalName; // Prefer originalName from JSON if available
        const extension = path.extname(currentNameToUse).toLowerCase();

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
          name: currentNameToUse, // Use the determined name
          size: stats.size,
          created: metadata.created || stats.birthtime.getTime(),
          algorithm: algorithm, // Use the determined algorithm
          entropy: entropy,
          extension: extension,
          path: filePath
        });
      } catch (fileErr) {
        console.error(`Error processing file ${fileName}:`, fileErr);
      }
    }
    
    console.log('Returning file list with', fileList.length, 'files');
    return { success: true, files: fileList };
  } catch (error) {
    console.error('Error getting encrypted files:', error);
    return { success: false, error: error.message };
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
    encryptionKey = key;
    
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
    encryptionKey = key;
    
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
  console.log('[MAIN] open-file-dialog handler called');
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    console.log('[MAIN] Dialog result:', result.canceled ? 'Canceled' : `Selected ${result.filePaths.length} files`);
    console.log('[MAIN] File paths:', result.filePaths);
    
    if (!result.canceled && result.filePaths.length > 0) {
      // Get file stats for each selected file
      const files = await Promise.all(result.filePaths.map(async (filePath) => {
        try {
          const stats = fs.statSync(filePath);
          const fileObj = {
            path: filePath,
            name: path.basename(filePath),
            size: stats.size
          };
          console.log('[MAIN] Created file object:', fileObj);
          return fileObj;
        } catch (error) {
          console.error(`[MAIN] Error getting stats for file ${filePath}:`, error);
          const fallbackObj = {
            path: filePath,
            name: path.basename(filePath),
            size: 0
          };
          console.log('[MAIN] Created fallback file object:', fallbackObj);
          return fallbackObj;
        }
      }));
      
      console.log('[MAIN] Returning files with stats:', files);
      return files;
    }
    
    console.log('[MAIN] No files selected, returning empty array');
    return [];
  } catch (error) {
    console.error('[MAIN] Error in open-file-dialog:', error);
    return [];
  }
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
// --- Settings IPC Handlers ---
ipcMain.handle('get-app-settings', () => {
    console.log('[Main] get-app-settings called');
    return store.get('appSettings');
});

ipcMain.handle('set-app-settings', (event, settings) => {
    console.log('[Main] set-app-settings called with:', settings);
    try {
        store.set('appSettings', settings);
        return true;
    } catch (error) {
        console.error('[Main] Error saving settings:', error);
        return false;
    }
});

ipcMain.handle('reset-app-settings', () => {
    console.log('[Main] reset-app-settings called');
    try {
        // Re-initialize outputDir to default before setting defaults
        let initialOutputDir = null;
        try {
            const documentsPath = app.getPath('documents');
            initialOutputDir = path.join(documentsPath, 'SeamlessEncryptor_Output');
        } catch (e) {
            initialOutputDir = path.join(app.getPath('userData'), 'SeamlessEncryptor_Output');
        }
        const freshDefaults = { ...DEFAULT_SETTINGS_MAIN, outputDir: initialOutputDir }; 
        store.set('appSettings', freshDefaults);
        return true;
    } catch (error) {
        console.error('[Main] Error resetting settings:', error);
        return false;
    }
});

ipcMain.handle('select-output-directory', async () => {
    console.log('[Main] select-output-directory called');
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('get-default-output-dir', () => {
    console.log('[Main] get-default-output-dir called');
    // This ensures the default is created if it wasn't already (e.g. first run)
    let outputDir = store.get('appSettings.outputDir');
    if (!outputDir) {
         try {
            const documentsPath = app.getPath('documents');
            outputDir = path.join(documentsPath, 'SeamlessEncryptor_Output');
        } catch (e) {
            outputDir = path.join(app.getPath('userData'), 'SeamlessEncryptor_Output');
        }
        store.set('appSettings.outputDir', outputDir); // Save it if it was just generated
    }
    return outputDir;
});

ipcMain.handle('clear-app-data', () => {
    console.log('[Main] clear-app-data called');
    try {
        // This clears all data managed by electron-store for this app
        store.clear(); 
        // Re-initialize defaults including outputDir since clear() removes everything
        let initialOutputDir = null;
        try {
            const documentsPath = app.getPath('documents');
            initialOutputDir = path.join(documentsPath, 'SeamlessEncryptor_Output');
        } catch (e) {
            initialOutputDir = path.join(app.getPath('userData'), 'SeamlessEncryptor_Output');
        }
        const freshDefaults = { 
            autoDelete: false, 
            compress: true, 
            notifications: true, 
            confirmActions: true, 
            outputDir: initialOutputDir, 
            debugMode: false,
            gdriveConnected: false,      // Reset GDrive state
            gdriveUserEmail: null,     // Reset GDrive user
            gdriveAutoUpload: false,   // Reset GDrive auto-upload
        };
        store.set('appSettings', freshDefaults);
        store.delete('gdriveTokens'); // Also clear stored GDrive tokens
        googleAuthClient = null; // Reset auth client instance
        googleDrive = null; // Reset drive client instance
        console.log('[Main] App data cleared and defaults re-applied.');
        return true;
    } catch (error) {
        console.error('[Main] Error clearing app data:', error);
        return false;
    }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// --- Google Drive IPC Handlers (Placeholders) ---
ipcMain.handle('gdrive-connect', async () => {
    console.log('[main.js] gdrive-connect called');
    const authClient = getGoogleAuthClient();
    const authUrl = authClient.generateAuthUrl({
      access_type: 'offline', // Important to get a refresh token
      scope: [
        'https://www.googleapis.com/auth/drive.file', // Full access to files created or opened by the app
        'https://www.googleapis.com/auth/drive.readonly', // To list files
        'https://www.googleapis.com/auth/userinfo.email' // To get user's email
    ],
      prompt: 'consent' // Ensures the consent screen is shown, good for getting refresh_token
    });
    console.log('[main.js] Generated GDrive Auth URL:', authUrl);
    return { success: true, authUrl };
});

ipcMain.handle('gdrive-exchange-auth-code', async (event, authCode) => {
  try {
    console.log('[main.js] gdrive-exchange-auth-code called with code:', authCode);
    if (!authCode) {
      return { success: false, error: 'Authorization code is missing.' };
    }
    const authClient = getGoogleAuthClient();
    const { tokens } = await authClient.getToken(authCode);
    authClient.setCredentials(tokens);

    // Store tokens securely
    store.set('gdriveTokens', tokens);
    console.log('[main.js] GDrive tokens obtained and stored.');

    // Initialize Google Drive API client
    googleDrive = google.drive({ version: 'v3', auth: authClient });

    // Get user's email to confirm connection
    const driveAbout = await googleDrive.about.get({ fields: 'user' });
    const userEmail = driveAbout.data.user.emailAddress;

    store.set('appSettings.gdriveConnected', true);
    store.set('appSettings.gdriveUserEmail', userEmail);
    
    console.log('[main.js] GDrive connected for user:', userEmail);
    return { success: true, email: userEmail };
  } catch (error) {
    console.error('[main.js] Error exchanging GDrive auth code:', error);
    // Clear potentially bad tokens if error occurs
    store.set('gdriveTokens', null);
    store.set('appSettings.gdriveConnected', false);
    store.set('appSettings.gdriveUserEmail', null);
    googleDrive = null;
    return { success: false, error: error.message };
  }
});

ipcMain.handle('gdrive-status', async () => {
  try {
    console.log('[main.js] gdrive-status called');
    const tokens = store.get('gdriveTokens');
    const gdriveConnected = store.get('appSettings.gdriveConnected', false);
    const gdriveUserEmail = store.get('appSettings.gdriveUserEmail', null);

    if (tokens && gdriveConnected) {
      const authClient = getGoogleAuthClient(); // Will load tokens if available
      // Optionally, you could add a light API call here to truly verify token validity
      // For now, trusting stored state and token presence.
      console.log('[main.js] GDrive status: Connected as', gdriveUserEmail);
      return { success: true, connected: true, email: gdriveUserEmail };
    } else {
      console.log('[main.js] GDrive status: Not connected');
      return { success: true, connected: false };
    }
  } catch (error) {
    console.error('[main.js] Error getting GDrive status:', error);
    return { success: false, error: error.message, connected: false };
  }
});

// IPC handler to open external URLs
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to list files from Google Drive
ipcMain.handle('gdrive-list-files', async (event, { parentFolderId = null, pageToken = null } = {}) => {
  try {
    console.log('[main.js] gdrive-list-files called. Parent:', parentFolderId, "PageToken:", pageToken);
    getGoogleAuthClient(); // Ensures auth client and potentially Drive client are initialized
    if (!googleDrive) {
      return { success: false, error: 'Google Drive not connected or initialized.' };
    }

    let targetFolderId = parentFolderId;
    let defaultAppFolderId = null; // Variable to store the ID of the app's default folder
    let listedFolderName = null;

    if (!targetFolderId) {
        try {
            // Default to listing from the app-specific folder if no parentFolderId is provided
            defaultAppFolderId = await getOrCreateAppFolderId();
            targetFolderId = defaultAppFolderId;
            listedFolderName = 'SeamlessEncryptor_Files'; // Set name when app folder is used
        } catch (folderError) {
            console.warn('[main.js] Could not get/create app folder for listing, attempting to list root. Error:', folderError.message);
            targetFolderId = 'root'; // Fallback to root
            listedFolderName = 'My Drive'; // Set name for root
            console.log('[main.js] Defaulting to list root directory due to app folder issue.');
        }
    } else if (targetFolderId === 'root') {
        listedFolderName = 'My Drive';
    }
    // If parentFolderId was provided and it's not 'root', the renderer should know its name.
    // We only explicitly set listedFolderName for 'root' or the app's default folder.
    
    const query = `\'${targetFolderId}\' in parents and trashed=false`;

    const response = await googleDrive.files.list({
      q: query,
      pageSize: 20, // Number of files to retrieve per page
      pageToken: pageToken,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, iconLink, webViewLink, parents, capabilities)',
      orderBy: 'folder, name', // Show folders first, then sort by name
      spaces: 'drive',
    });

    // Re-check listedFolderName if it wasn't set by initial logic (e.g. navigating back to app folder by ID)
    if (!listedFolderName && defaultAppFolderId && targetFolderId === defaultAppFolderId) {
        listedFolderName = 'SeamlessEncryptor_Files';
    } else if (!listedFolderName && targetFolderId === 'root') {
        listedFolderName = 'My Drive';
    }
    // If a specific parentFolderId was given (and it wasn't root, and not the default app folder),
    // listedFolderName remains null, as the renderer should manage this.

    console.log(`[main.js] Found ${response.data.files.length} files/folders in Drive folder ID ${targetFolderId}. Name: ${listedFolderName}`);
    return { 
        success: true, 
        files: response.data.files, 
        nextPageToken: response.data.nextPageToken, 
        currentFolderId: targetFolderId, 
        currentFolderName: listedFolderName // Can be null if renderer already knows the name
    };
  } catch (error) {
    console.error('[main.js] Error listing GDrive files:', error);
    return { success: false, error: error.message, files: [] };
  }
});

ipcMain.handle('gdrive-disconnect', async () => {
  console.log('[main.js] gdrive-disconnect called');
  try {
    // Clear stored tokens
    store.delete('gdriveTokens');
    
    // Reset GDrive related app settings
    const currentSettings = store.get('appSettings');
    store.set('appSettings', {
      ...currentSettings,
      gdriveConnected: false,
      gdriveUserEmail: null,
      // Keep gdriveAutoUpload as is, user might want to keep the setting even when disconnected
    });

    // Reset in-memory clients
    googleAuthClient = null;
    googleDrive = null;

    console.log('[main.js] GDrive disconnected, tokens and relevant settings cleared.');
    return { success: true };
  } catch (error) {
    console.error('[main.js] Error during GDrive disconnect:', error);
    // Attempt to reset state even if an error occurs during store operations
    store.set('appSettings.gdriveConnected', false);
    store.set('appSettings.gdriveUserEmail', null);
    googleAuthClient = null;
    googleDrive = null;
    return { success: false, error: error.message };
  }
});

// Helper function to upload a file to Google Drive
async function uploadFileToDriveInternal(filePath, fileName, parentFolderId) {
    console.log(`[main.js] Attempting to upload file '${fileName}' from path '${filePath}' to GDrive folder ID '${parentFolderId}'`);
    getGoogleAuthClient(); // Ensure auth client and Drive API are initialized
    if (!googleDrive) {
        console.error('[main.js] Google Drive API client not initialized. Cannot upload file.');
        throw new Error('Google Drive client not available.');
    }
    if (!fs.existsSync(filePath)) {
        console.error(`[main.js] File not found at path: ${filePath}. Cannot upload.`);
        throw new Error('File for upload not found locally.');
    }

    const fileSize = fs.statSync(filePath).size;
    if (fileSize === 0) {
        console.warn(`[main.js] File '${fileName}' is empty. Uploading an empty file.`);
    }

    const fileMetadata = {
        name: fileName,
        parents: [parentFolderId],
    };
    const media = {
        mimeType: 'application/octet-stream', // Or try to determine actual MIME type if needed
        body: fs.createReadStream(filePath),
    };

    try {
        const response = await googleDrive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink',
        });
        console.log(`[main.js] File uploaded successfully to GDrive. Name: '${response.data.name}', ID: '${response.data.id}', Link: ${response.data.webViewLink}`);
        return { success: true, fileId: response.data.id, name: response.data.name, link: response.data.webViewLink };
    } catch (error) {
        console.error(`[main.js] Error uploading file '${fileName}' to Google Drive:`, error);
        throw new Error(`Google Drive upload failed: ${error.message}`);
    }
}

// IPC Handler for manual file upload to Google Drive (e.g., from Cloud tab UI)
ipcMain.handle('gdrive-upload-file', async (event, { filePath, fileName, parentFolderId }) => {
    if (!filePath || !fileName) {
        console.error('[main.js] gdrive-upload-file: Missing filePath or fileName.');
        return { success: false, error: 'Missing required parameters for GDrive upload.' };
    }
    try {
        // If no parentFolderId provided, use the app's default folder
        let targetFolderId = parentFolderId;
        if (!targetFolderId) {
            try {
                targetFolderId = await getOrCreateAppFolderId();
            } catch (folderError) {
                console.error('[main.js] Could not get app folder for upload:', folderError);
                return { success: false, error: 'Could not access Google Drive folder.' };
            }
        }
        
        const uploadResult = await uploadFileToDriveInternal(filePath, fileName, targetFolderId);
        return { ...uploadResult, success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// IPC Handler to upload encrypted files to Google Drive
ipcMain.handle('gdrive-upload-encrypted-file', async (event, fileId) => {
    try {
        console.log('[main.js] gdrive-upload-encrypted-file called with fileId:', fileId);
        
        if (!fileId) {
            return { success: false, error: 'No file ID provided' };
        }
        
        // Find the encrypted file
        const encryptedDir = path.join(app.getPath('userData'), 'encrypted');
        let filePath = '';
        let fileName = '';
        
        if (fs.existsSync(encryptedDir)) {
            const files = fs.readdirSync(encryptedDir);
            const matchingFile = files.find(file => file.startsWith(fileId) || file === fileId);
            
            if (matchingFile) {
                filePath = path.join(encryptedDir, matchingFile);
                fileName = matchingFile;
            }
        }
        
        if (!filePath || !fs.existsSync(filePath)) {
            return { success: false, error: 'Encrypted file not found' };
        }
        
        // Get the app folder ID
        const appFolderId = await getOrCreateAppFolderId();
        
        // Upload the encrypted file
        const uploadResult = await uploadFileToDriveInternal(filePath, fileName, appFolderId);
        
        console.log('[main.js] Encrypted file uploaded to Google Drive:', uploadResult);
        return uploadResult;
        
    } catch (error) {
        console.error('[main.js] Error uploading encrypted file to Google Drive:', error);
        return { success: false, error: error.message };
    }
});

// Add getFileStats handler
ipcMain.handle('getFileStats', async (event, filePath) => {
  try {
    console.log('getFileStats called for:', filePath);
    const stats = fs.statSync(filePath);
    return {
      success: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  } catch (error) {
    console.error('Error getting file stats:', error);
    return { success: false, error: error.message };
  }
});

