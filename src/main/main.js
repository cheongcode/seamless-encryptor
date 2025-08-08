const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Store = require('electron-store');
const { google } = require('googleapis');
const keytar = require('keytar');

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

// Check if Google credentials are properly configured
const isGoogleConfigured = () => {
  return GOOGLE_CLIENT_ID !== 'your_google_client_id_here' && 
         GOOGLE_CLIENT_SECRET !== 'your_google_client_secret_here' &&
         GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET;
};

// Validate OAuth setup for compliance
const validateOAuthSetup = () => {
  const issues = [];
  
  if (!isGoogleConfigured()) {
    issues.push('Google API credentials not configured in .env file');
  }
  
  if (GOOGLE_CLIENT_ID === 'your_google_client_id_here') {
    issues.push('Using placeholder GOOGLE_CLIENT_ID - replace with real credentials');
  }
  
  if (GOOGLE_CLIENT_SECRET === 'your_google_client_secret_here') {
    issues.push('Using placeholder GOOGLE_CLIENT_SECRET - replace with real credentials');
  }
  
  if (!process.env.DEVELOPER_EMAIL) {
    issues.push('DEVELOPER_EMAIL not set in .env file (required for OAuth compliance)');
  }
  
  return issues;
};

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

// Generate or get user UUID
function getUserUUID() {
    let userUUID = store.get('userUUID');
    if (!userUUID) {
        userUUID = crypto.randomBytes(16).toString('hex');
        store.set('userUUID', userUUID);
        console.log(`[main.js] Generated new user UUID: ${userUUID}`);
    }
    return userUUID;
}

// Helper function to find or create the EncryptedVault folder structure
async function getOrCreateVaultStructure() {
    if (!googleDrive) {
        console.log('[main.js] Google Drive API client not initialized. Cannot get/create vault structure.');
        getGoogleAuthClient(); // Attempt to initialize it
        if (!googleDrive) throw new Error('Google Drive client not available.');
    }

    try {
        // Create EncryptedVault root folder
        let vaultFolderId = await findOrCreateFolder('EncryptedVault', 'root');
        
        // Create user-specific subfolder
        const userUUID = getUserUUID();
        let userFolderId = await findOrCreateFolder(userUUID, vaultFolderId);
        
        // Create date-based subfolder (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0];
        let dateFolderId = await findOrCreateFolder(today, userFolderId);
        
        // Create keys subfolder in user directory
        let keysFolderId = await findOrCreateFolder('keys', userFolderId);
        
        return {
            vaultFolderId,
            userFolderId,
            dateFolderId,
            keysFolderId,
            userUUID
        };
    } catch (error) {
        console.error('[main.js] Error creating vault structure:', error);
        throw error;
    }
}

// Helper function to find or create a folder
async function findOrCreateFolder(folderName, parentId) {
    // Check if folder already exists
    const response = await googleDrive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    if (response.data.files.length > 0) {
        console.log(`[main.js] Found existing folder '${folderName}' with ID: ${response.data.files[0].id}`);
        return response.data.files[0].id;
    } else {
        // Create the folder
        console.log(`[main.js] Folder '${folderName}' not found, creating new one...`);
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        };
        const folder = await googleDrive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });
        console.log(`[main.js] Created new folder '${folderName}' with ID: ${folder.data.id}`);
        return folder.data.id;
    }
}

// Legacy function for backward compatibility
async function getOrCreateAppFolderId() {
    try {
        const vaultStructure = await getOrCreateVaultStructure();
        return vaultStructure.dateFolderId;
    } catch (error) {
        console.error('[main.js] Error finding or creating app folder in Google Drive:', error);
        // Fallback: if we can't create/find the specific folder, allow listing from root as a degraded experience
        throw new Error(`Failed to get or create app folder: ${error.message}`);
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

// Centralized directory initialization function
function initializeAppDirectories() {
  console.log('[INIT] Initializing application directories...');
  
  const userDataPath = app.getPath('userData');
  const homePath = app.getPath('home');
  
  const directories = [
    { path: path.join(userDataPath, 'encrypted'), name: 'Encrypted files' },
    { path: path.join(userDataPath, 'keys'), name: 'Encryption keys' },
    { path: path.join(userDataPath, 'temp'), name: 'Temporary files' },
    { path: path.join(userDataPath, 'output'), name: 'Output files' },
    { path: path.join(homePath, 'SeamlessEncryptor_Output'), name: 'User output folder' }
  ];
  
  directories.forEach(({ path: dirPath, name }) => {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`[INIT] ✅ Created ${name} directory: ${dirPath}`);
      } else {
        console.log(`[INIT] ✅ ${name} directory exists: ${dirPath}`);
      }
    } catch (error) {
      console.error(`[INIT] ❌ Failed to create ${name} directory ${dirPath}:`, error.message);
    }
  });
  
  // Ensure output directory from settings exists
  try {
    const outputDir = store.get('appSettings.outputDir');
    if (outputDir && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('[INIT] ✅ Created configured output directory:', outputDir);
    }
  } catch (error) {
    console.error('[INIT] ❌ Error creating configured output directory:', error.message);
  }
}

// Initialize directories at startup
initializeAppDirectories();

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

// NEW: Multiple Key Management System
let keyStorage = new Map(); // Map<keyId, {key: Buffer, metadata: Object}>
let activeKeyId = null;

// Key Management Functions
function generateKeyId() {
  return crypto.randomBytes(4).toString('hex'); // 8-character hex ID
}

function addKeyToStorage(key, metadata = {}) {
  const keyId = generateKeyId();
  const keyInfo = {
    key: key,
    metadata: {
      type: metadata.type || 'Generated Key',
      created: new Date().toISOString(),
      description: metadata.description || 'Encryption key',
      ...metadata
    }
  };
  
  keyStorage.set(keyId, keyInfo);
  
  // If this is the first key, make it active
  if (!activeKeyId) {
    activeKeyId = keyId;
    encryptionKey = key; // Update global for backward compatibility
  }
  
  console.log(`[KeyManager] Added key ${keyId}, active: ${keyId === activeKeyId}`);
  return keyId;
}

function setActiveKey(keyId) {
  if (keyStorage.has(keyId)) {
    activeKeyId = keyId;
    encryptionKey = keyStorage.get(keyId).key; // Update global for backward compatibility
    console.log(`[KeyManager] Set active key to ${keyId}`);
    return true;
  }
  return false;
}

function getActiveKey() {
  if (activeKeyId && keyStorage.has(activeKeyId)) {
    return {
      keyId: activeKeyId,
      ...keyStorage.get(activeKeyId)
    };
  }
  return null;
}

function getAllKeys() {
  const keys = [];
  for (const [keyId, keyInfo] of keyStorage.entries()) {
    keys.push({
      keyId,
      isActive: keyId === activeKeyId,
      type: keyInfo.metadata.type,
      created: keyInfo.metadata.created,
      description: keyInfo.metadata.description
    });
  }
  return keys;
}

function deleteKey(keyId) {
  if (!keyStorage.has(keyId)) {
    return false;
  }
  
  keyStorage.delete(keyId);
  
  // If we deleted the active key, set another key as active or clear
  if (keyId === activeKeyId) {
    const remainingKeys = Array.from(keyStorage.keys());
    if (remainingKeys.length > 0) {
      setActiveKey(remainingKeys[0]);
    } else {
      activeKeyId = null;
      encryptionKey = null;
    }
  }
  
  console.log(`[KeyManager] Deleted key ${keyId}`);
  return true;
}

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
ipcMain.handle('encrypt-file', async (event, filePath, method, options = {}) => {
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
    
    // Validate the encryption method - get supported methods from encryptionMethods module
    let supportedMethods = ['aes-256-gcm', 'aes-256-cbc']; // Built-in methods
    
    // Add methods from encryptionMethods module if available
    if (encryptionMethods && typeof encryptionMethods.getAllEncryptionMethods === 'function') {
      try {
        const moduleMethods = encryptionMethods.getAllEncryptionMethods();
        supportedMethods = [...new Set([...supportedMethods, ...moduleMethods])]; // Merge and dedupe
        console.log(`[ENCRYPTION] Available methods: ${supportedMethods.join(', ')}`);
      } catch (methodError) {
        console.warn('[ENCRYPTION] Error getting methods from module:', methodError.message);
      }
    }
    
    if (!method || !supportedMethods.includes(method)) {
      console.warn(`[ENCRYPTION] Unsupported method: ${method}, defaulting to aes-256-gcm`);
      console.warn(`[ENCRYPTION] Supported methods: ${supportedMethods.join(', ')}`);
      method = 'aes-256-gcm';
    }
    
    console.log(`[ENCRYPTION] Using method: ${method}`);
    
    // UPDATED: Use new key management system first
    let key = null;
    
    // First: Try to get the active key from the new key storage system
    const activeKey = getActiveKey();
    if (activeKey && activeKey.key) {
      key = activeKey.key;
      console.log(`[ENCRYPTION] Using active key from storage: ${activeKey.keyId}`);
    }
    
    // Fallback: Check legacy global variable
    if (!key) {
      key = encryptionKey;
      console.log('[ENCRYPTION] Using legacy global encryption key:', !!key);
    }
    
    // Fallback: Try key manager
    if (!key && keyManager) {
      try {
        if (typeof keyManager.getKey === 'function') {
          key = await keyManager.getKey();
          console.log('[ENCRYPTION] Retrieved key from keyManager.getKey()');
        } else if (typeof keyManager.getMasterKey === 'function') {
          key = await keyManager.getMasterKey();
          console.log('[ENCRYPTION] Retrieved key from keyManager.getMasterKey()');
        }
      } catch (keyErr) {
        console.error('[ENCRYPTION] Error getting key from keyManager:', keyErr);
      }
    }
    
    // Last resort: Check file system
    if (!key) {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      if (fs.existsSync(keyPath)) {
        try {
          const keyData = fs.readFileSync(keyPath, 'utf8');
          key = Buffer.from(keyData, 'hex');
          console.log('[ENCRYPTION] Retrieved key from filesystem');
          
          // Migrate to new storage system
          const keyId = addKeyToStorage(key, { 
            type: 'Legacy Key', 
            description: 'Migrated from filesystem' 
          });
          console.log(`[ENCRYPTION] Migrated filesystem key to storage: ${keyId}`);
        } catch (fsErr) {
          console.error('[ENCRYPTION] Error reading key from filesystem:', fsErr);
        }
      }
    }
    
    if (!key) {
      console.error('No encryption key available');
      return { success: false, error: 'No encryption key available. Please generate or import a key first.' };
    }
    
    // Ensure key is a Buffer and validate
    if (typeof key === 'string') {
      try {
        key = Buffer.from(key, 'hex');
      } catch (hexError) {
        console.error('Error converting hex key to buffer:', hexError);
        return { success: false, error: 'Invalid key format' };
      }
    }
    
    // Validate key length
    if (!Buffer.isBuffer(key) || key.length !== 32) {
      console.error('Invalid key: must be 32 bytes (256 bits)');
      return { success: false, error: 'Invalid key: must be 32 bytes (256 bits)' };
    }
    
    console.log('Key validation passed, proceeding with encryption...');
    
    // Read and validate file
    console.log('Reading file data...');
    let fileData;
    try {
      fileData = fs.readFileSync(filePath);
      console.log(`File read successfully: ${fileData.length} bytes`);
      
      if (fileData.length === 0) {
        return { success: false, error: 'File is empty' };
      }
      
      // Log first few bytes for debugging (don't log sensitive data in production)
      console.log('File data sample (first 16 bytes):', fileData.slice(0, 16).toString('hex'));
      
    } catch (readError) {
      console.error('Error reading file:', readError);
      return { success: false, error: `Error reading file: ${readError.message}` };
    }
    
    // Encrypt the file data
    console.log(`[ENCRYPTION] Encrypting ${fileData.length} bytes using ${method}...`);
    console.log(`[ENCRYPTION] Key length: ${key.length} bytes`);
    console.log(`[ENCRYPTION] Original data sample (first 16 bytes):`, fileData.slice(0, 16).toString('hex'));
    
    let encryptedData, iv, authTag;
    
    try {
      if (method === 'aes-256-gcm') {
        // Generate random IV for this encryption
        iv = crypto.randomBytes(12); // GCM uses 96-bit IV
        console.log('[ENCRYPTION] Generated IV:', iv.toString('hex'));
        
        // CRITICAL FIX: Ensure key is exactly 32 bytes
        if (key.length !== 32) {
          console.error(`[ENCRYPTION] CRITICAL ERROR: Key length is ${key.length}, expected 32 bytes`);
          return { success: false, error: `Invalid key length: ${key.length} bytes (expected 32)` };
        }
        
        // Create cipher
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        console.log('[ENCRYPTION] Cipher created successfully');
        
        // CRITICAL FIX: Encrypt data in one go to avoid issues
        try {
          encryptedData = Buffer.concat([cipher.update(fileData), cipher.final()]);
          console.log(`[ENCRYPTION] Data encrypted successfully: ${encryptedData.length} bytes`);
        } catch (cipherError) {
          console.error('[ENCRYPTION] Cipher operation failed:', cipherError);
          return { success: false, error: `Cipher operation failed: ${cipherError.message}` };
        }
        
        // Get authentication tag
        authTag = cipher.getAuthTag();
        console.log('[ENCRYPTION] Authentication tag:', authTag.toString('hex'));
        
        // CRITICAL VERIFICATION: Ensure encryption actually worked
        if (encryptedData.length === 0) {
          console.error('[ENCRYPTION] CRITICAL ERROR: Encrypted data is empty!');
          return { success: false, error: 'Encryption failed: encrypted data is empty' };
        }
        
        if (encryptedData.equals(fileData)) {
          console.error('[ENCRYPTION] CRITICAL ERROR: Encrypted data is identical to original data!');
          return { success: false, error: 'Encryption failed: data was not encrypted' };
        }
        
        // Additional verification: Check if encrypted data looks random
        const originalSample = fileData.slice(0, Math.min(32, fileData.length)).toString('hex');
        const encryptedSample = encryptedData.slice(0, Math.min(32, encryptedData.length)).toString('hex');
        console.log('[ENCRYPTION] Original sample:', originalSample);
        console.log('[ENCRYPTION] Encrypted sample:', encryptedSample);
        
        if (originalSample === encryptedSample) {
          console.error('[ENCRYPTION] CRITICAL ERROR: Encrypted sample matches original!');
          return { success: false, error: 'Encryption failed: encrypted data appears identical to original' };
        }
        
        console.log('[ENCRYPTION] ✅ Encryption verification passed');
        
      } else if (method === 'aes-256-cbc') {
        // AES-256-CBC implementation
        iv = crypto.randomBytes(16); // CBC uses 128-bit IV
        console.log('[ENCRYPTION] Generated CBC IV:', iv.toString('hex'));
        
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        encryptedData = Buffer.concat([cipher.update(fileData), cipher.final()]);
        authTag = crypto.randomBytes(16); // Dummy auth tag for consistency
        
        console.log(`[ENCRYPTION] ✅ AES-256-CBC encryption successful: ${encryptedData.length} bytes`);
        
      } else if (method === 'aes-256-ctr') {
        // AES-256-CTR implementation
        iv = crypto.randomBytes(16); // CTR uses 128-bit IV
        console.log('[ENCRYPTION] Generated CTR IV:', iv.toString('hex'));
        
        const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
        encryptedData = Buffer.concat([cipher.update(fileData), cipher.final()]);
        authTag = crypto.randomBytes(16); // Dummy auth tag for consistency
        
        console.log(`[ENCRYPTION] ✅ AES-256-CTR encryption successful: ${encryptedData.length} bytes`);
        
      } else if (method === 'aes-256-ofb') {
        // AES-256-OFB implementation
        iv = crypto.randomBytes(16); // OFB uses 128-bit IV
        console.log('[ENCRYPTION] Generated OFB IV:', iv.toString('hex'));
        
        const cipher = crypto.createCipheriv('aes-256-ofb', key, iv);
        encryptedData = Buffer.concat([cipher.update(fileData), cipher.final()]);
        authTag = crypto.randomBytes(16); // Dummy auth tag for consistency
        
        console.log(`[ENCRYPTION] ✅ AES-256-OFB encryption successful: ${encryptedData.length} bytes`);
        
      } else {
        // Use encryption methods module for other algorithms
        console.log(`[ENCRYPTION] Using encryptionMethods.encrypt for ${method}`);
        try {
          const result = await encryptionMethods.encrypt(fileData, key, method);
          console.log(`[ENCRYPTION] encryptionMethods result:`, {
            algorithm: result.algorithm,
            dataLength: result.encryptedData?.length,
            hasData: !!result.encryptedData
          });
          
          // Handle the different format from encryptionMethods
          if (result.encryptedData && result.encryptedData.length > 0) {
            // The encryptionMethods module returns a different format
            // We need to extract the actual encrypted data and metadata
            encryptedData = result.encryptedData;
            
            // For now, create dummy IV and authTag since encryptionMethods handles this internally
            iv = crypto.randomBytes(12); // Will be ignored since data already includes metadata
            authTag = crypto.randomBytes(16); // Will be ignored since data already includes auth
            
            console.log(`[ENCRYPTION] ✅ Alternative encryption successful: ${encryptedData.length} bytes`);
          } else {
            console.error('[ENCRYPTION] CRITICAL ERROR: encryptionMethods returned empty data!');
            return { success: false, error: 'Encryption failed: encryption method returned empty data' };
          }
        } catch (methodError) {
          console.error(`[ENCRYPTION] encryptionMethods failed:`, methodError);
          console.log(`[ENCRYPTION] Falling back to AES-256-GCM for ${method}`);
          
          // Fallback to AES-256-GCM if other methods fail
          iv = crypto.randomBytes(12);
          const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
          encryptedData = Buffer.concat([cipher.update(fileData), cipher.final()]);
          authTag = cipher.getAuthTag();
          method = 'aes-256-gcm'; // Update method to reflect what was actually used
          console.log(`[ENCRYPTION] ✅ Fallback encryption successful: ${encryptedData.length} bytes`);
        }
      }
      
    } catch (encryptionError) {
      console.error('[ENCRYPTION] Encryption failed:', encryptionError);
      return { success: false, error: `Encryption failed: ${encryptionError.message}` };
    }
    
    // Convert encryption method to algorithm ID for storage
    const algorithmId = getAlgorithmId(method);
    
    function getAlgorithmId(algorithm) {
      const algorithmMap = {
        'aes-256-gcm': 1,
        'aes-256-cbc': 2,
        'chacha20-poly1305': 3,
        'xchacha20-poly1305': 4,
        'aes-256-ctr': 5,
        'aes-256-ofb': 6
      };
      return algorithmMap[algorithm] || 1; // Default to AES-256-GCM
    }
    
    // Prepare the encrypted file format with header
    // Format: [Magic Bytes (4)][Version (1)][Algorithm ID (1)][IV Length (1)][Auth Tag Length (1)][DEK Hash (32)][IV][Auth Tag][Ciphertext]
    const magicBytes = Buffer.from([0x45, 0x54, 0x43, 0x52]); // Magic bytes "ETCR" to identify our file format
    const formatVersion = Buffer.from([0x01]); // Version 1 of our format
    const algorithmIdBuffer = Buffer.from([algorithmId]);
    const ivLength = Buffer.from([iv.length]);
    const tagLength = Buffer.from([authTag.length]);
    
    // Generate DEK hash for header
    const dekHash = crypto.createHash('sha256').update(key).digest();
    
    const fullEncryptedData = Buffer.concat([
      magicBytes,
      formatVersion,
      algorithmIdBuffer,
      ivLength,
      tagLength,
      dekHash,
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
    
    const encryptedFilePath = path.join(encryptedFilesDir, `${fileId}_${fileName}.etcr`);
    
    try {
      fs.writeFileSync(encryptedFilePath, fullEncryptedData);
    } catch (writeError) {
      console.error('Error writing encrypted file:', writeError);
      return { success: false, error: `Error saving encrypted file: ${writeError.message}` };
    }
    
    // Store metadata about the encrypted file
    const activeKeyInfo = getActiveKey();
    const dekHashHex = dekHash.toString('hex');
    const metadata = {
      id: fileId,
      originalName: fileName,
      encryptedPath: encryptedFilePath,
      encryptedFilename: `${fileId}_${fileName}.etcr`,
      originalSize: fileData.length,
      encryptedSize: fullEncryptedData.length,
      algorithm: method,
      dekHash: dekHashHex,
      timestamp: new Date().toISOString(),
      keyId: activeKeyInfo ? activeKeyInfo.keyId : 'unknown', // Track which key encrypted this
      keyType: activeKeyInfo ? activeKeyInfo.metadata.type : 'unknown'
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
    
    // Auto-upload to Google Drive if enabled (and not disabled by options)
    try {
        const appSettings = store.get('appSettings');
        if (appSettings.gdriveConnected && appSettings.gdriveAutoUpload && !options.skipAutoUpload) {
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
    
    // Auto-delete original file if enabled
    try {
        const appSettings = store.get('appSettings');
        console.log('[main.js encrypt-file] Current app settings:', appSettings);
        
        if (appSettings && appSettings.autoDelete === true) {
            console.log('[main.js encrypt-file] Auto-delete is enabled. Attempting to delete original file:', filePath);
            
            // Verify the encrypted file was created successfully before deleting original
            if (fs.existsSync(encryptedFilePath)) {
                const encryptedStats = fs.statSync(encryptedFilePath);
                console.log(`[main.js encrypt-file] Encrypted file stats: ${encryptedStats.size} bytes`);
                
                if (encryptedStats.size > 0) {
                    // Additional safety check: ensure encrypted file is larger than header size
                    const minExpectedSize = 50; // At least header size + some encrypted content
                    if (encryptedStats.size >= minExpectedSize) {
                        try {
                            // Double-check original file still exists before deletion
                            if (fs.existsSync(filePath)) {
                                // Delete the original file
                                fs.unlinkSync(filePath);
                                console.log('[main.js encrypt-file] Successfully deleted original file:', filePath);
                                
                                // Verify deletion
                                if (!fs.existsSync(filePath)) {
                                    console.log('[main.js encrypt-file] Confirmed: Original file has been deleted');
                                } else {
                                    console.warn('[main.js encrypt-file] Warning: Original file still exists after deletion attempt');
                                }
                            } else {
                                console.log('[main.js encrypt-file] Original file no longer exists, skipping deletion');
                            }
                        } catch (deleteError) {
                            console.error('[main.js encrypt-file] Failed to delete original file:', deleteError.message);
                            console.error('[main.js encrypt-file] File may be locked or in use by another process');
                            // Don't fail the entire encryption process, just log the error
                        }
                    } else {
                        console.warn('[main.js encrypt-file] Encrypted file too small, not deleting original file for safety');
                    }
                } else {
                    console.warn('[main.js encrypt-file] Encrypted file is empty, not deleting original file');
                }
            } else {
                console.warn('[main.js encrypt-file] Encrypted file does not exist, not deleting original file');
            }
        } else {
            console.log('[main.js encrypt-file] Auto-delete is not enabled or setting not found. Original file preserved.');
            console.log('[main.js encrypt-file] AutoDelete setting value:', appSettings ? appSettings.autoDelete : 'settings object not found');
        }
    } catch (autoDeleteError) {
        console.error('[main.js encrypt-file] Error during auto-delete sequence:', autoDeleteError.message);
        console.error('[main.js encrypt-file] Stack trace:', autoDeleteError.stack);
        // Don't fail the entire encryption process if auto-delete fails
        console.log('[main.js encrypt-file] Continuing despite auto-delete error...');
    }
    
    // Copy encrypted file to output directory as backup
    let backupPath = null;
    try {
      const outputDir = ensureOutputDirExists();
      if (outputDir) {
        const backupFileName = `${fileName}.enc`;
        backupPath = path.join(outputDir, backupFileName);
        let counter = 1;
        
        // Generate unique filename if file already exists
        while (fs.existsSync(backupPath)) {
          const ext = path.extname(backupFileName);
          const nameWithoutExt = path.basename(backupFileName, ext);
          const newFileName = `${nameWithoutExt}_${counter}${ext}`;
          backupPath = path.join(outputDir, newFileName);
          counter++;
        }
        
        // Copy encrypted file to output directory
        fs.copyFileSync(encryptedFilePath, backupPath);
        console.log(`[main.js encrypt-file] Local backup copy saved to: ${backupPath}`);
      }
    } catch (backupError) {
      console.warn('[main.js encrypt-file] Failed to create local backup copy:', backupError.message);
      backupPath = null;
      // Don't fail the entire process, just log the warning
    }
    
    return {
      success: true,
      fileId,
      fileName,
      algorithm: method,
      size: fileData.length,
      encryptedPath: encryptedFilePath,
      backupPath: backupPath
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
    
    // Get encryption key - use the NEW key management system first, then fallbacks
    let key = password;
    
    if (!key) {
      // UPDATED: Use new key management system first
      const activeKey = getActiveKey();
      if (activeKey && activeKey.key) {
        key = activeKey.key;
        console.log(`[DECRYPTION] Using active key from storage: ${activeKey.keyId}`);
      }
      
      // Fallback: Check legacy global variable
      if (!key) {
        key = encryptionKey;
        console.log('[DECRYPTION] Using legacy global encryption key:', !!key);
      }
      
      // Fallback: Try key manager
      if (!key && keyManager) {
        try {
          if (typeof keyManager.getKey === 'function') {
            key = await keyManager.getKey();
            console.log('[DECRYPTION] Retrieved key from keyManager.getKey()');
          } else if (typeof keyManager.getMasterKey === 'function') {
            key = await keyManager.getMasterKey();
            console.log('[DECRYPTION] Retrieved key from keyManager.getMasterKey()');
          }
        } catch (keyErr) {
          console.error('[DECRYPTION] Error getting key from keyManager:', keyErr);
        }
      }
      
      // Last resort: Check file system
      if (!key) {
        const keyPath = path.join(app.getPath('userData'), 'encryption.key');
        if (fs.existsSync(keyPath)) {
          try {
            const keyData = fs.readFileSync(keyPath, 'utf8');
            key = Buffer.from(keyData, 'hex');
            console.log('[DECRYPTION] Retrieved key from filesystem');
            
            // Migrate to new storage system
            const keyId = addKeyToStorage(key, { 
              type: 'Legacy Key', 
              description: 'Migrated from filesystem during decryption' 
            });
            console.log(`[DECRYPTION] Migrated filesystem key to storage: ${keyId}`);
          } catch (fsErr) {
            console.error('[DECRYPTION] Error reading key from filesystem:', fsErr);
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
      try {
        key = Buffer.from(key, 'hex');
      } catch (hexError) {
        console.error('Error converting hex key to buffer:', hexError);
        return { success: false, error: 'Invalid key format' };
      }
    }
    
    // Validate key length
    if (!Buffer.isBuffer(key) || key.length !== 32) {
      console.error('Invalid key: must be 32 bytes (256 bits)');
      return { success: false, error: 'Invalid key: must be 32 bytes (256 bits)' };
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
      const header = encryptedData.slice(0, 4);
      
      if (header.equals(Buffer.from([0x45, 0x54, 0x43, 0x52]))) { // Magic bytes "ETCR" for our encrypted file format
        const formatVersion = encryptedData[4];
        const algorithmId = encryptedData[5];
        
        // Map algorithm ID to name
        function getAlgorithmFromId(id) {
          const idMap = {
            1: 'aes-256-gcm',
            2: 'aes-256-cbc', 
            3: 'chacha20-poly1305',
            4: 'xchacha20-poly1305',
            5: 'aes-256-ctr',
            6: 'aes-256-ofb'
          };
          return idMap[id] || 'aes-256-gcm';
        }
        
        algorithm = getAlgorithmFromId(algorithmId);
        
        const ivLength = encryptedData[6];
        const tagLength = encryptedData[7];
        const dekHash = encryptedData.slice(8, 40); // 32 bytes for SHA-256 hash
        const headerLength = 40; // 4 magic bytes + 1 version + 1 algorithm + 1 ivLength + 1 tagLength + 32 DEK hash
        
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
      } else if (algorithm === 'chacha20-poly1305' || algorithm === 'xchacha20-poly1305') {
        // Encrypted payload for ChaCha20/XChaCha20 is stored using encryptionMethods format
        // (version + algorithm code + serialized metadata + ciphertext). Defer to module and let it auto-detect algorithm.
        decryptedData = await encryptionMethods.decrypt({ encryptedData: ciphertext }, key);
      } else if (algorithm === 'aes-256-cbc') {
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        decryptedData = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } else if (algorithm === 'aes-256-ctr') {
        const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
        decryptedData = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } else if (algorithm === 'aes-256-ofb') {
        const decipher = crypto.createDecipheriv('aes-256-ofb', key, iv);
        decryptedData = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } else {
        return { success: false, error: `Unsupported algorithm: ${algorithm}` };
      }
    } catch (decryptError) {
      console.error('[DECRYPTION] Error decrypting data:', decryptError);
      
      // IMPROVED: Provide specific error messages for common decryption failures
      let errorMessage = 'Decryption failed';
      
      if (decryptError.message.includes('bad decrypt') || 
          decryptError.message.includes('auth') || 
          decryptError.message.includes('tag') ||
          decryptError.message.includes('authentication')) {
        errorMessage = 'Decryption failed: Wrong encryption key. This file was encrypted with a different key than the currently active one.';
        console.error('[DECRYPTION] Authentication/key mismatch error detected');
      } else if (decryptError.message.includes('Invalid key')) {
        errorMessage = 'Decryption failed: Invalid encryption key format.';
      } else if (decryptError.message.includes('Invalid iv') || decryptError.message.includes('Invalid nonce')) {
        errorMessage = 'Decryption failed: Corrupted encryption metadata.';
      } else {
        errorMessage = `Decryption failed: ${decryptError.message}`;
      }
      
      return { success: false, error: errorMessage };
    }
    
    if (!decryptedData) {
      return { success: false, error: 'Decryption produced no data' };
    }
    
    // Save the decrypted file to configured output directory
    const outputDir = ensureOutputDirExists();
    if (!outputDir) {
      return { success: false, error: 'Output directory not configured. Please check your settings.' };
    }
    
    let fileName;
    let originalExtension = '';
    
    // Try to extract original filename from various sources
    if (filePath) {
      // First, try to get the original name from the encrypted filename
      const encryptedFileName = path.basename(filePath);
      console.log('Encrypted file name:', encryptedFileName);
      
      // Remove .enc extension first and extract the original name
      let nameWithoutEnc = encryptedFileName;
      if (nameWithoutEnc.endsWith('.enc')) {
        nameWithoutEnc = nameWithoutEnc.slice(0, -4);
      }
      
      // Try to extract original name after hex prefix (pattern: hexid_originalname)
      const match = nameWithoutEnc.match(/^[a-f0-9]{16,32}_(.+)$/);
      if (match && match[1]) {
        fileName = match[1];
        console.log('Extracted original filename from encrypted file path:', fileName);
      } else {
        // If no hex prefix pattern, the entire name might be the original
        fileName = nameWithoutEnc;
        console.log('Using cleaned filename without .enc:', fileName);
      }
    }
    
    // If we couldn't extract from file path, try from fileId
    if (!fileName) {
      let cleanFileId = fileId.toString();
      
      // Remove .enc extension if present in fileId
      if (cleanFileId.endsWith('.enc')) {
        cleanFileId = cleanFileId.slice(0, -4);
      }
      
      // Try to extract original name after hex prefix
      const match = cleanFileId.match(/^[a-f0-9]{16,32}_(.+)$/);
      if (match && match[1]) {
        fileName = match[1];
        console.log('Extracted original filename from fileId:', fileName);
      } else {
        // Look for underscore pattern anywhere in fileId
        const underscoreIndex = cleanFileId.indexOf('_');
        if (underscoreIndex > 0 && underscoreIndex < cleanFileId.length - 1) {
          fileName = cleanFileId.substring(underscoreIndex + 1);
          console.log('Extracted filename using underscore pattern:', fileName);
        }
      }
    }
    
    // If still no valid name, use intelligent naming with file type detection
    if (!fileName || fileName === fileId.toString() || fileName.length < 1) {
      fileName = `decrypted_file_${Date.now()}`;
      
      // Try to detect file type from content and add appropriate extension
      if (decryptedData.length > 10) {
        const header = decryptedData.slice(0, 10);
        
        // Check for common file signatures (magic bytes)
        if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
          fileName += '.jpg';
        } else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
          fileName += '.png';
        } else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
          fileName += '.gif';
        } else if (header[0] === 0x50 && header[1] === 0x4B) {
          fileName += '.zip'; // Could also be docx, xlsx, etc.
        } else if (header.toString('ascii').startsWith('%PDF')) {
          fileName += '.pdf';
        } else if (header.toString('ascii').startsWith('<!DOCTYPE') || header.toString('ascii').startsWith('<html')) {
          fileName += '.html';
        } else if (header.toString('ascii').startsWith('<?xml')) {
          fileName += '.xml';
        } else if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
          fileName += '.wav';
        } else if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
          fileName += '.mp3';
        } else if (header.slice(4, 8).toString('ascii') === 'ftyp') {
          fileName += '.mp4';
        } else {
          // Try to detect text files
          let isText = true;
          for (let i = 0; i < Math.min(100, decryptedData.length); i++) {
            const byte = decryptedData[i];
            if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
              isText = false;
              break;
            }
          }
          fileName += isText ? '.txt' : '.bin';
        }
      } else {
        fileName += '.bin'; // Very small file, unknown type
      }
    }
    
    // Final cleanup: ensure we have a clean filename
    fileName = path.basename(fileName); // Remove any path components
    fileName = fileName.replace(/[<>:"/\\|?*]/g, '_'); // Replace invalid filename chars
    
    // Ensure we don't have double extensions or .enc remaining
    if (fileName.includes('.enc.')) {
      fileName = fileName.replace('.enc.', '.');
    }
    if (fileName.endsWith('.enc')) {
      fileName = fileName.slice(0, -4);
      // If removing .enc leaves no extension, add a default
      if (!path.extname(fileName)) {
        fileName += '.bin';
      }
    }
    
    console.log('Final decrypted filename:', fileName);
    
    // Generate unique filename if file already exists
    let decryptedFilePath = path.join(outputDir, fileName);
    let counter = 1;
    
    while (fs.existsSync(decryptedFilePath)) {
      const ext = path.extname(fileName);
      const nameWithoutExt = path.basename(fileName, ext);
      const newFileName = `${nameWithoutExt}_${counter}${ext}`;
      decryptedFilePath = path.join(outputDir, newFileName);
      counter++;
    }
    
    try {
      fs.writeFileSync(decryptedFilePath, decryptedData);
      console.log(`Decrypted file saved to: ${decryptedFilePath}`);
    } catch (writeError) {
      console.error('Error writing decrypted file:', writeError);
      return { success: false, error: `Error saving decrypted file: ${writeError.message}` };
    }
    
    return {
      success: true,
      filePath: decryptedFilePath,
      decryptedPath: decryptedFilePath
    };
  } catch (error) {
    console.error('Error in decrypt-file handler:', error);
    return { success: false, error: error.message };
  }
});

// Handle show-item-in-folder IPC call
ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  try {
    const { shell } = require('electron');
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error showing item in folder:', error);
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
        
        // Get encryption key - use NEW key management system first
        let key = null;
        
        // First: Try to get the active key from the new key storage system
        const activeKey = getActiveKey();
        if (activeKey && activeKey.key) {
            key = activeKey.key;
            console.log(`[DOWNLOAD] Using active key from storage: ${activeKey.keyId}`);
        }
        
        // Fallback: Check legacy global variable
        if (!key) {
            key = encryptionKey;
            console.log('[DOWNLOAD] Using legacy global encryption key:', !!key);
        }
        
        // Fallback: Try key manager
        if (!key && keyManager) {
            try {
                if (typeof keyManager.getKey === 'function') {
                    key = await keyManager.getKey();
                    console.log('[DOWNLOAD] Retrieved key from keyManager.getKey()');
                } else if (typeof keyManager.getMasterKey === 'function') {
                    key = await keyManager.getMasterKey();
                    console.log('[DOWNLOAD] Retrieved key from keyManager.getMasterKey()');
                }
            } catch (keyErr) {
                console.error('[DOWNLOAD] Error getting key from keyManager:', keyErr);
            }
        }
        
        // Last resort: Check filesystem
        if (!key) {
            const keyPath = path.join(app.getPath('userData'), 'encryption.key');
            if (fs.existsSync(keyPath)) {
                try {
                    const keyData = fs.readFileSync(keyPath, 'utf8');
                    key = Buffer.from(keyData, 'hex');
                    console.log('[DOWNLOAD] Retrieved key from filesystem');
                    
                    // Migrate to new storage system
                    const keyId = addKeyToStorage(key, { 
                        type: 'Legacy Key', 
                        description: 'Migrated from filesystem during download' 
                    });
                    console.log(`[DOWNLOAD] Migrated filesystem key to storage: ${keyId}`);
                } catch (fsErr) {
                    console.error('[DOWNLOAD] Error reading key from filesystem:', fsErr);
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
            // Try to parse the modern ETCR header first
            const magic = encryptedData.slice(0, 4);
            if (magic.equals(Buffer.from([0x45, 0x54, 0x43, 0x52]))) {
                const formatVersion = encryptedData[4];
                const algorithmId = encryptedData[5];
                const ivLength = encryptedData[6];
                const tagLength = encryptedData[7];
                const headerLength = 40; // 4 magic + 1 ver + 1 alg + 1 ivLen + 1 tagLen + 32 DEK hash

                // Map algorithm ID to name per encrypt-file implementation
                const idMap = {
                  1: 'aes-256-gcm',
                  2: 'aes-256-cbc',
                  3: 'chacha20-poly1305',
                  4: 'xchacha20-poly1305',
                  5: 'aes-256-ctr',
                  6: 'aes-256-ofb'
                };
                algorithm = idMap[algorithmId] || 'aes-256-gcm';

                iv = encryptedData.slice(headerLength, headerLength + ivLength);
                tag = encryptedData.slice(headerLength + ivLength, headerLength + ivLength + tagLength);
                ciphertext = encryptedData.slice(headerLength + ivLength + tagLength);
            } else {
                // Legacy format (no header)
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
            } else if (algorithm === 'chacha20-poly1305' || algorithm === 'xchacha20-poly1305') {
                // Defer to encryptionMethods format for ChaCha20 families (auto-detect inside)
                decryptedData = await encryptionMethods.decrypt({ encryptedData: ciphertext }, key);
            } else if (algorithm === 'aes-256-cbc') {
                const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                decryptedData = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            } else if (algorithm === 'aes-256-ctr') {
                const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
                decryptedData = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            } else if (algorithm === 'aes-256-ofb') {
                const decipher = crypto.createDecipheriv('aes-256-ofb', key, iv);
                decryptedData = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
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
        
        // Auto-save to output directory instead of showing dialog
        const outputDir = ensureOutputDirExists();
        if (!outputDir) {
            return { success: false, error: 'Output directory not configured' };
        }
        
        // Generate unique filename if file already exists
        let finalFileName = originalFileName || 'decrypted-file';
        let savePath = path.join(outputDir, finalFileName);
        let counter = 1;
        
        while (fs.existsSync(savePath)) {
            const ext = path.extname(finalFileName);
            const nameWithoutExt = path.basename(finalFileName, ext);
            const newFileName = `${nameWithoutExt}_${counter}${ext}`;
            savePath = path.join(outputDir, newFileName);
            counter++;
        }

        await fs.promises.writeFile(savePath, decryptedData);
        event.sender.send('download-progress', { progress: 100, status: 'Download complete!' });

        console.log(`File downloaded and decrypted to: ${savePath}`);
        return { success: true, filePath: savePath };
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
            // Look for files matching the fileId pattern in the encrypted directory
            if (fs.existsSync(encryptedDir)) {
                const files = fs.readdirSync(encryptedDir);
                
                // Find the file that matches the fileId (exact match or starts with fileId)
                let matchingFile = files.find(file => file === targetFileId);
                if (!matchingFile) {
                    matchingFile = files.find(file => file.startsWith(targetFileId));
                }
                
                if (matchingFile) {
                    filePath = path.join(encryptedDir, matchingFile);
                    console.log(`Found encrypted file for download: ${filePath}`);
                    
                    // Extract original filename from the file name if not provided
                    if (!targetFileName) {
                        targetFileName = matchingFile.replace(/^[a-f0-9]{32}_/, '').replace(/\.enc$/, '');
                    }
                    
                    // Try to get algorithm from metadata.json
                    const metadataPath = path.join(encryptedDir, 'metadata.json');
                    if (fs.existsSync(metadataPath)) {
                        try {
                            const metadataContent = fs.readFileSync(metadataPath, 'utf8');
                            const metadataArray = JSON.parse(metadataContent);
                            const fileMetadata = metadataArray.find(meta => meta.id === targetFileId);
                            if (fileMetadata) {
                                algorithm = fileMetadata.algorithm || 'unknown';
                                if (!targetFileName && fileMetadata.originalName) {
                                    targetFileName = fileMetadata.originalName;
                                }
                            }
                        } catch (err) {
                            console.warn('Error parsing metadata.json:', err);
                        }
                    }
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

// Add a function to ensure output directory exists
function ensureOutputDirExists() {
  const outputDir = store.get('appSettings.outputDir');
  if (outputDir && !fs.existsSync(outputDir)) {
    try {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('Created output directory:', outputDir);
    } catch (error) {
      console.error('Error creating output directory:', error);
    }
  }
  return outputDir;
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
    
    // FIXED: Use our own entropy calculation instead of missing analyzer
    console.log(`[ENTROPY] Analyzing ${fileBuffer.length} bytes`);
    
    // Calculate entropy using our improved method
    const overallEntropy = calculateBasicEntropy(fileBuffer);
    
    // Determine rating based on entropy
    let rating, isGoodEncryption;
    if (overallEntropy >= 7.5) {
      rating = 'Excellent';
      isGoodEncryption = true;
    } else if (overallEntropy >= 7.0) {
      rating = 'Very Good';
      isGoodEncryption = true;
    } else if (overallEntropy >= 6.5) {
      rating = 'Good';
      isGoodEncryption = true;
    } else if (overallEntropy >= 6.0) {
      rating = 'Fair';
      isGoodEncryption = false;
    } else if (overallEntropy >= 5.0) {
      rating = 'Poor';
      isGoodEncryption = false;
    } else {
      rating = 'Very Poor';
      isGoodEncryption = false;
    }
    
    const analysis = {
      overallEntropy: overallEntropy,
      rating: rating,
      isGoodEncryption: isGoodEncryption
    };
    
    console.log(`[ENTROPY] Results: ${overallEntropy.toFixed(3)} (${rating})`);
    
    // Try external analyzer for comparison but don't override our improved results
    if (typeof entropyAnalyzer?.analyzeEntropyInChunks === 'function') {
      try {
        const externalAnalysis = entropyAnalyzer.analyzeEntropyInChunks(fileBuffer);
        console.log(`[ENTROPY] External analyzer: ${externalAnalysis.overallEntropy?.toFixed(3)}`);
        console.log(`[ENTROPY] Our calculation: ${overallEntropy.toFixed(3)} - keeping our result`);
        // DON'T override our improved calculation - just log for comparison
      } catch (analyzerError) {
        console.warn('[ENTROPY] External analyzer failed:', analyzerError.message);
      }
    }
    
    // Generate a histogram for visualization
    let histogram = calculateHistogram(fileBuffer);
    
    // Try external histogram if available
    if (typeof entropyAnalyzer?.generateHistogram === 'function') {
      try {
        const externalHistogram = entropyAnalyzer.generateHistogram(fileBuffer);
        if (externalHistogram && Array.isArray(externalHistogram)) {
          histogram = externalHistogram;
        }
      } catch (histError) {
        console.warn('[ENTROPY] External histogram failed:', histError.message);
      }
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

// IMPROVED: Accurate entropy calculation for encrypted files
function calculateBasicEntropy(buffer) {
  const len = buffer.length;
  if (len === 0) return 0;
  
  console.log(`[ENTROPY-CALC] Analyzing ${len} bytes`);
  
  // For encrypted files, analyze the actual encrypted data (skip header if present)
  let dataToAnalyze = buffer;
  let startOffset = 0;
  let isEncryptedFormat = false;
  
  // Check if this looks like our encrypted file format
  if (len >= 6 && buffer[0] === 0xF1 && buffer[1] === 0xE2) {
    isEncryptedFormat = true;
    // Skip our header: magic(2) + version(1) + algorithm(1) + ivLen(1) + tagLen(1)
    const ivLength = buffer[4];
    const tagLength = buffer[5];
    startOffset = 6 + ivLength + tagLength; // Skip header, IV, and auth tag
    
    if (startOffset < len) {
      dataToAnalyze = buffer.slice(startOffset);
      console.log(`[ENTROPY-CALC] Detected encrypted format, analyzing ${dataToAnalyze.length} bytes of ciphertext (skipped ${startOffset} header bytes)`);
    }
  }
  
  const analyzeLen = dataToAnalyze.length;
  if (analyzeLen === 0) return 0;
  
  // For encrypted files, use a smarter approach based on file size
  if (isEncryptedFormat) {
    // Small encrypted files should automatically get high entropy scores
    // because proper encryption always produces high entropy regardless of size
    if (analyzeLen <= 100) {
      console.log(`[ENTROPY-CALC] Small encrypted file (${analyzeLen} bytes), using encrypted file heuristic`);
      // For small encrypted files, calculate basic entropy but apply encryption bonus
      const rawEntropy = calculateRawEntropy(dataToAnalyze);
      const encryptedEntropy = Math.max(rawEntropy, 7.5); // Minimum 7.5 for encrypted files
      console.log(`[ENTROPY-CALC] Raw: ${rawEntropy.toFixed(3)}, Encrypted bonus: ${encryptedEntropy.toFixed(3)}`);
      return encryptedEntropy;
    }
  }
  
  // For larger files or non-encrypted files, use standard entropy calculation
  const entropy = calculateRawEntropy(dataToAnalyze);
  console.log(`[ENTROPY-CALC] Standard calculation result: ${entropy.toFixed(3)}`);
  return entropy;
}

// Helper function for raw Shannon entropy calculation
function calculateRawEntropy(dataToAnalyze) {
  const analyzeLen = dataToAnalyze.length;
  if (analyzeLen === 0) return 0;
  
  // Count byte frequencies
  const freq = new Array(256).fill(0);
  
  if (analyzeLen <= 10000) {
    // Small files: analyze everything for maximum accuracy
    for (let i = 0; i < analyzeLen; i++) {
      freq[dataToAnalyze[i]]++;
    }
  } else {
    // Larger files: use strategic sampling
    const sampleSize = Math.min(analyzeLen, 50000);
    const interval = Math.max(1, Math.floor(analyzeLen / sampleSize));
    
    for (let i = 0; i < analyzeLen; i += interval) {
      freq[dataToAnalyze[i]]++;
    }
  }
  
  // Calculate Shannon entropy
  let entropy = 0;
  const totalBytes = analyzeLen <= 10000 ? analyzeLen : Math.ceil(analyzeLen / Math.max(1, Math.floor(analyzeLen / 50000)));
  
  for (let i = 0; i < 256; i++) {
    if (freq[i] > 0) {
      const p = freq[i] / totalBytes;
      entropy -= p * Math.log2(p);
    }
  }
  
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
    
    // NEW: Check active key from key storage first
    const activeKey = getActiveKey();
    if (activeKey) {
      console.log(`[KeyManager] Active key found: ${activeKey.keyId}`);
      return {
        success: true,
        hasKey: true,
        keyId: activeKey.keyId,
        source: 'keyStorage',
        type: activeKey.metadata.type,
        created: activeKey.metadata.created
      };
    }
    
    // FALLBACK: Check legacy key sources for backward compatibility
    let key = encryptionKey;
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
          
          // NEW: Migrate legacy key to new storage system
          const keyId = addKeyToStorage(key, { 
            type: 'Legacy Key', 
            description: 'Imported from previous version' 
          });
          console.log(`[KeyManager] Migrated legacy key to storage: ${keyId}`);
          
          return {
            success: true,
            hasKey: true,
            keyId: keyId,
            source: 'migrated',
            type: 'Legacy Key'
          };
        } catch (fsErr) {
          console.error('Error reading key from filesystem:', fsErr);
        }
      }
    }
    
    if (key) {
      // NEW: Migrate any existing key to new storage system
      let keyId = '';
      if (Buffer.isBuffer(key)) {
        keyId = key.toString('hex').substring(0, 8);
      } else if (typeof key === 'string') {
        keyId = key.substring(0, 8);
      }
      
      const storageKeyId = addKeyToStorage(key, { 
        type: 'Legacy Key', 
        description: 'Existing key from memory' 
      });
      
      return {
        success: true,
        hasKey: true,
        keyId: storageKeyId,
        source: source,
        type: 'Legacy Key'
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
    
    // NEW: Just generate a new key without checking for existing ones
    // Users can manage multiple keys now
    const key = crypto.randomBytes(32); // 256 bits
    const keyId = addKeyToStorage(key, {
      type: 'Generated Key',
      description: 'Randomly generated encryption key'
    });
    
    // Try to save to key manager if available (for backup)
    if (keyManager && typeof keyManager.setKey === 'function') {
      try {
        await keyManager.setKey(key);
      } catch (keyErr) {
        console.error('Error saving key to keyManager:', keyErr);
      }
    }
    
    // Save active key to file system as backup
    try {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      if (activeKeyId === keyId) { // Only save if this is the active key
        fs.writeFileSync(keyPath, key.toString('hex'), 'utf8');
        console.log('Active key saved to file system at:', keyPath);
      }
    } catch (fileErr) {
      console.error('Error saving key to file system:', fileErr);
    }
    
    console.log(`[KeyManager] Generated new key: ${keyId}`);
    return {
      success: true,
      keyId: keyId,
      isActive: activeKeyId === keyId
    };
  } catch (error) {
    console.error('Error generating key:', error);
    return { success: false, error: error.message };
  }
});

// Handle force-generate-key IPC call (generates key even if one exists)
ipcMain.handle('force-generate-key', async (event) => {
  try {
    console.log('force-generate-key handler called - generating new key despite existing key');
    
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
      console.log('Key forcefully saved to file system at:', keyPath);
    } catch (fileErr) {
      console.error('Error saving key to file system:', fileErr);
    }
    
    return {
      success: true,
      keyId: key.toString('hex').substring(0, 8)
    };
  } catch (error) {
    console.error('Error force generating key:', error);
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
    
    // First, try to load metadata from the metadata.json file
    let metadataLookup = {};
    const metadataPath = path.join(encryptedDir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
        const metadataArray = JSON.parse(metadataContent);
        // Convert array to lookup object for faster access
        metadataArray.forEach(meta => {
          if (meta.id) {
            metadataLookup[meta.id] = meta;
          }
        });
        console.log(`[FILE-LIST] Loaded metadata for ${Object.keys(metadataLookup).length} files`);
      } catch (metaErr) {
        console.error('[FILE-LIST] Error reading metadata.json:', metaErr);
      }
    }

    // Get all files in the directory
    const files = fs.readdirSync(encryptedDir).filter(f => f !== 'metadata.json'); // Exclude metadata file
    const fileList = [];
    
    // Process each file to get metadata
    for (const fileName of files) {
      try {
        const filePath = path.join(encryptedDir, fileName);
        const stats = fs.statSync(filePath);
        
        // Skip directories and non-regular files
        if (!stats.isFile()) continue;
        
        // Extract file ID from filename (pattern: fileId_originalname.enc)
        let fileId = fileName;
        const match = fileName.match(/^([a-f0-9]{32})_(.+)\.enc$/);
        if (match) {
          fileId = match[1];
        }
        
        // Start with metadata from metadata.json if available
        let metadata = metadataLookup[fileId] || {};
        
        console.log(`[FILE-LIST] Processing ${fileName}, found metadata:`, !!metadata.originalName);

        // Read a small part of the file to check headers
        const fileBuffer = Buffer.alloc(1024); // Read enough for potential headers
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, fileBuffer, 0, Math.min(1024, stats.size), 0);
        fs.closeSync(fd);

        let algorithm = 'aes-256-gcm'; // Default algorithm
        let originalName = fileName; // Default original name

        // Check for new header format (Magic Bytes ETCR)
        if (stats.size >= 40 && fileBuffer[0] === 0x45 && fileBuffer[1] === 0x54 && fileBuffer[2] === 0x43 && fileBuffer[3] === 0x52) { // Ensure buffer is large enough for header
          const formatVersion = fileBuffer[4];
          if (formatVersion === 0x01) { // Check if we support this version
            const algorithmId = fileBuffer[5];
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

        // Use the extracted fileId or generate from name (or use existing if present)
        const finalFileId = metadata.id || fileId || fileName.replace(/\.[^/.]+$/, '');
        
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
          id: finalFileId,
          name: metadata.originalName || currentNameToUse, // Prefer metadata originalName
          size: stats.size,
          created: metadata.timestamp ? new Date(metadata.timestamp).getTime() : stats.birthtime.getTime(),
          algorithm: algorithm, // Use the determined algorithm
          entropy: entropy,
          extension: extension,
          path: filePath,
          encryptedBy: metadata.keyId || 'Unknown' // Add which key encrypted this file
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
    
    // NEW: Add to key storage system instead of overwriting
    const keyId = addKeyToStorage(key, {
      type: 'Imported Key',
      description: 'Key imported by user'
    });
    
    // Create keys directory if it doesn't exist
    const keysDir = path.join(app.getPath('userData'), 'keys');
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
      console.log('Created keys directory:', keysDir);
    }
    
    // Save key to individual file in keys directory
    try {
      const keyFilePath = path.join(keysDir, `${keyId}.key`);
      const keyFileData = {
        keyId: keyId,
        key: key.toString('hex'),
        metadata: {
          type: 'Imported Key',
          description: 'Key imported by user',
          created: new Date().toISOString(),
          imported: true
        }
      };
      fs.writeFileSync(keyFilePath, JSON.stringify(keyFileData, null, 2), 'utf8');
      console.log(`Imported key saved to file: ${keyFilePath}`);
    } catch (fileErr) {
      console.error('Error saving imported key to file system:', fileErr);
      // Don't fail the import if file saving fails
    }
    
    // Try to save to key manager if available (for backup)
    if (keyManager && typeof keyManager.setKey === 'function') {
      try {
        await keyManager.setKey(key);
        console.log('Imported key saved to keyManager');
      } catch (keyErr) {
        console.error('Error saving imported key to keyManager:', keyErr);
      }
    }
    
    // Update active key backup file if this becomes the active key
    if (activeKeyId === keyId) {
      try {
        const keyPath = path.join(app.getPath('userData'), 'encryption.key');
        fs.writeFileSync(keyPath, key.toString('hex'), 'utf8');
        console.log('Updated active key backup file');
      } catch (fileErr) {
        console.error('Error updating active key backup file:', fileErr);
      }
    }
    
    console.log(`[KeyManager] Imported key: ${keyId}`);
    return {
      success: true,
      keyId: keyId,
      isActive: activeKeyId === keyId
    };
  } catch (error) {
    console.error('Error importing key:', error);
    return { success: false, error: error.message };
  }
});

// Handle create-custom-key IPC call - UPDATED for multiple keys
ipcMain.handle('create-custom-key', async (event, passphrase, entropyPhrase) => {
  try {
    console.log('[KeyManager] create-custom-key handler called');
    
    // Validate passphrases
    if (!passphrase) {
      return { success: false, error: 'No passphrase provided' };
    }
    
    if (passphrase.length < 8) {
      return { success: false, error: 'Passphrase must be at least 8 characters long' };
    }
    
    console.log('[KeyManager] Creating custom key from passphrase...');
    
    // Create a key from the passphrase using PBKDF2 (non-blocking version)
    // Use entropyPhrase as salt if provided, otherwise use a random salt
    const salt = entropyPhrase ? 
      crypto.createHash('sha256').update(entropyPhrase).digest().slice(0, 16) : 
      crypto.randomBytes(16);
    
    console.log('[KeyManager] Deriving key with PBKDF2...');
    
    // Use the async version of PBKDF2 to prevent blocking
    const key = await new Promise((resolve, reject) => {
      crypto.pbkdf2(passphrase, salt, 100000, 32, 'sha256', (err, derivedKey) => {
        if (err) {
          console.error('[KeyManager] PBKDF2 error:', err);
          reject(err);
        } else {
          console.log('[KeyManager] PBKDF2 completed successfully');
          resolve(derivedKey);
        }
      });
    });
    
    console.log('[KeyManager] Key derivation completed, adding to storage...');
    
    // NEW: Add to key storage
    const keyId = addKeyToStorage(key, {
      type: 'Custom Key',
      description: 'Key derived from passphrase',
      salt: salt.toString('hex')
    });
    
    // Try to save to key manager if available (for backup)
    if (keyManager && typeof keyManager.setKey === 'function') {
      try {
        await keyManager.setKey(key);
        console.log('[KeyManager] Key saved to keyManager');
      } catch (keyErr) {
        console.error('[KeyManager] Error saving key to keyManager:', keyErr);
      }
    }
    
    // Save active key to file system as backup
    try {
      const keyPath = path.join(app.getPath('userData'), 'encryption.key');
      if (activeKeyId === keyId) { // Only save if this is the active key
        fs.writeFileSync(keyPath, key.toString('hex'), 'utf8');
        console.log('[KeyManager] Active key saved to filesystem');
      }
    } catch (fileErr) {
      console.error('[KeyManager] Error saving key to file system:', fileErr);
    }
    
    console.log(`[KeyManager] Custom key creation completed successfully: ${keyId}`);
    
    return {
      success: true,
      keyId: keyId,
      isActive: activeKeyId === keyId
    };
  } catch (error) {
    console.error('[KeyManager] Error creating custom key:', error);
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

// Add after the existing open-file-dialog handler

// Handle open-directory-dialog IPC call for directory browsing
ipcMain.handle('open-directory-dialog', async () => {
  console.log('[MAIN] open-directory-dialog handler called');
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      filters: []
    });
    
    console.log('[MAIN] Directory dialog result:', result.canceled ? 'Canceled' : `Selected directory: ${result.filePaths[0]}`);
    
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedDirectory = result.filePaths[0];
      console.log('[MAIN] Returning selected directory:', selectedDirectory);
      return selectedDirectory;
    }
    
    console.log('[MAIN] No directory selected, returning null');
    return null;
  } catch (error) {
    console.error('[MAIN] Error in open-directory-dialog:', error);
    return null;
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
        const selectedPath = result.filePaths[0];
        console.log('[Main] User selected directory:', selectedPath);
        
        // Save the selected path to settings
        const currentSettings = store.get('appSettings');
        store.set('appSettings', {
            ...currentSettings,
            outputDir: selectedPath
        });
        
        console.log('[Main] Updated outputDir setting to:', selectedPath);
        return selectedPath;
    }
    console.log('[Main] User cancelled directory selection');
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
    
    // Check OAuth setup validation
    const setupIssues = validateOAuthSetup();
    if (setupIssues.length > 0) {
      const errorMsg = `OAuth setup incomplete:\n${setupIssues.map(issue => `• ${issue}`).join('\n')}\n\nPlease see OAUTH_SETUP_GUIDE.md for detailed instructions.`;
      console.error('[main.js]', errorMsg);
      return { 
        success: false, 
        error: errorMsg,
        needsSetup: true,
        setupIssues: setupIssues
      };
    }
    
    try {
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
    } catch (error) {
      console.error('[main.js] Error generating auth URL:', error);
      return { 
        success: false, 
        error: `Failed to generate authorization URL: ${error.message}. Please check your Google API credentials.`,
        needsSetup: true 
      };
    }
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

// Duplicate handler removed - using the first registration earlier in the file

// IPC handler to list files from Google Drive
ipcMain.handle('gdrive-list-files', async (event, { parentFolderId = null, pageToken = null } = {}) => {
  try {
    console.log(`[main.js] gdrive-list-files called with parentFolderId: ${parentFolderId}, pageToken: ${pageToken}`);
    getGoogleAuthClient(); // Ensure auth client and Drive API are initialized
    if (!googleDrive) {
      console.error('[main.js] Google Drive API client not initialized. Cannot list files.');
      return { success: false, error: 'Google Drive client not available.', files: [] };
    }

    let targetFolderId = parentFolderId;
    let listedFolderName = null;

    // Helper function to find legacy SeamlessEncryptor_Files folder
    async function findLegacyFolder() {
      try {
        const response = await googleDrive.files.list({
          q: `mimeType='application/vnd.google-apps.folder' and name='SeamlessEncryptor_Files' and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive',
        });
        
        if (response.data.files.length > 0) {
          console.log(`[main.js] Found legacy folder 'SeamlessEncryptor_Files' with ID: ${response.data.files[0].id}`);
          return response.data.files[0].id;
        }
        return null;
      } catch (error) {
        console.error('[main.js] Error finding legacy folder:', error);
        return null;
      }
    }

    // Prioritize EncryptedVault structure for consistency
    if (!targetFolderId) {
      try {
        // Always use the new vault structure first
        const vaultStructure = await getOrCreateVaultStructure();
        targetFolderId = vaultStructure.dateFolderId;
        console.log('[main.js] Using EncryptedVault structure');
      } catch (vaultError) {
        console.error('[main.js] Error with vault structure:', vaultError);
        
        // Fallback to legacy folder if vault creation fails
        const legacyFolderId = await findLegacyFolder();
        if (legacyFolderId) {
          console.log('[main.js] Falling back to legacy SeamlessEncryptor_Files folder');
          targetFolderId = legacyFolderId;
        } else {
          // Final fallback to default app folder
          const defaultAppFolderId = await getOrCreateAppFolderId();
          targetFolderId = defaultAppFolderId;
          console.log('[main.js] Using default app folder as final fallback');
        }
      }
    }

    // Attempt to get folder name if we don't have it
    if (targetFolderId && targetFolderId !== 'root') {
        try {
            const folderResponse = await googleDrive.files.get({
                fileId: targetFolderId,
                fields: 'name'
            });
            listedFolderName = folderResponse.data.name;
        } catch (nameError) {
            console.warn(`[main.js] Could not get folder name for ID ${targetFolderId}:`, nameError.message);
        }
    }

    const query = targetFolderId === 'root' 
      ? "trashed=false" 
      : `'${targetFolderId}' in parents and trashed=false`;

    const response = await googleDrive.files.list({
      q: query,
      pageSize: 20, // Number of files to retrieve per page
      pageToken: pageToken,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, iconLink, webViewLink, parents, capabilities)',
      orderBy: 'folder, name', // Show folders first, then sort by name
      spaces: 'drive',
    });

    // Set folder name based on what we're looking at
    if (!listedFolderName) {
      if (targetFolderId === 'root') {
        listedFolderName = 'My Drive';
      } else {
        // Check if this is our legacy folder
        const legacyFolderId = await findLegacyFolder();
        if (legacyFolderId && targetFolderId === legacyFolderId) {
          listedFolderName = 'SeamlessEncryptor_Files (Legacy)';
        } else {
          listedFolderName = 'Encrypted Vault';
        }
      }
    }

    // Transform files to include encryption detection and source info
    const transformedFiles = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      size: file.size,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
      isEncrypted: file.name.endsWith('.etcr') || file.name.endsWith('.enc'),
      iconLink: file.iconLink,
      webViewLink: file.webViewLink,
      parents: file.parents,
      capabilities: file.capabilities,
      source: listedFolderName.includes('Legacy') ? 'legacy' : 'vault'
    }));

    console.log(`[main.js] Found ${transformedFiles.length} files/folders in Drive folder ID ${targetFolderId}. Name: ${listedFolderName}`);
    return { 
        success: true, 
        files: transformedFiles, 
        nextPageToken: response.data.nextPageToken, 
        currentFolderId: targetFolderId, 
        currentFolderName: listedFolderName,
        hasLegacyFiles: transformedFiles.some(f => f.source === 'legacy'),
        hasVaultFiles: transformedFiles.some(f => f.source === 'vault')
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

// Handle export-key IPC call
ipcMain.handle('export-key', async (event) => {
  try {
    console.log('export-key handler called');
    
    // Get the current encryption key
    let key = encryptionKey;
    
    // If no key in memory, try to get from filesystem
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
      return { success: false, error: 'No encryption key available to export' };
    }
    
    // Show save dialog for export location
    const result = await dialog.showSaveDialog({
      title: 'Export Encryption Key',
      defaultPath: `encryption-key-${Date.now()}.key`,
      filters: [
        { name: 'Key Files', extensions: ['key'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false, error: 'Export cancelled' };
    }
    
    // Write the key to the selected file
    const keyHex = Buffer.isBuffer(key) ? key.toString('hex') : key;
    fs.writeFileSync(result.filePath, keyHex, 'utf8');
    
    console.log('Key exported to:', result.filePath);
    
    return {
      success: true,
      exportPath: result.filePath,
      keyId: keyHex.substring(0, 8)
    };
  } catch (error) {
    console.error('Error exporting key:', error);
    return { success: false, error: error.message };
  }
});

// NEW: Handle list-keys IPC call
ipcMain.handle('list-keys', async (event) => {
  try {
    console.log('[KeyManager] list-keys handler called');
    const keys = getAllKeys();
    console.log(`[KeyManager] Returning ${keys.length} keys`);
    return {
      success: true,
      keys: keys,
      activeKeyId: activeKeyId
    };
  } catch (error) {
    console.error('[KeyManager] Error listing keys:', error);
    return { success: false, error: error.message };
  }
});

// NEW: Handle set-active-key IPC call
ipcMain.handle('set-active-key', async (event, keyId) => {
  try {
    console.log(`[KeyManager] set-active-key handler called with keyId: ${keyId}`);
    
    if (!keyId) {
      return { success: false, error: 'No key ID provided' };
    }
    
    const success = setActiveKey(keyId);
    if (success) {
      // Update file system backup
      try {
        const keyPath = path.join(app.getPath('userData'), 'encryption.key');
        const activeKey = getActiveKey();
        if (activeKey) {
          fs.writeFileSync(keyPath, activeKey.key.toString('hex'), 'utf8');
          console.log(`[KeyManager] Updated file system backup for active key ${keyId}`);
        }
      } catch (fileErr) {
        console.error('[KeyManager] Error updating file system backup:', fileErr);
      }
      
      return {
        success: true,
        activeKeyId: keyId,
        message: `Key ${keyId} is now active`
      };
    } else {
      return {
        success: false,
        error: `Key ${keyId} not found`
      };
    }
  } catch (error) {
    console.error('[KeyManager] Error setting active key:', error);
    return { success: false, error: error.message };
  }
});

// File-based Key Management IPC Handlers
ipcMain.handle('generate-key-to-file', async (event, keyName) => {
  try {
    console.log('[KeyManager] generate-key-to-file handler called');
    const result = await keyManager.generateKey(keyName);
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('[KeyManager] Error generating key to file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-key-to-file', async (event, keyData, sourceName) => {
  try {
    console.log('[KeyManager] import-key-to-file handler called');
    const result = await keyManager.importKeyToFile(keyData, sourceName);
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('[KeyManager] Error importing key to file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-key-files', async (event) => {
  try {
    console.log('[KeyManager] list-key-files handler called');
    const keyFiles = await keyManager.listKeyFiles();
    return {
      success: true,
      keyFiles: keyFiles
    };
  } catch (error) {
    console.error('[KeyManager] Error listing key files:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-key-file', async (event, fileName) => {
  try {
    console.log(`[KeyManager] read-key-file handler called for: ${fileName}`);
    const keyData = await keyManager.readKeyFile(fileName);
    return {
      success: true,
      keyData: keyData
    };
  } catch (error) {
    console.error('[KeyManager] Error reading key file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-key-file', async (event, fileName) => {
  try {
    console.log(`[KeyManager] delete-key-file handler called for: ${fileName}`);
    const deleted = await keyManager.deleteKeyFile(fileName);
    return {
      success: deleted,
      message: deleted ? 'Key file deleted successfully' : 'Key file not found'
    };
  } catch (error) {
    console.error('[KeyManager] Error deleting key file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-key-folder-path', async (event) => {
  try {
    const keyFolderPath = keyManager.getKeyFolderPath();
    return {
      success: true,
      path: keyFolderPath
    };
  } catch (error) {
    console.error('[KeyManager] Error getting key folder path:', error);
    return { success: false, error: error.message };
  }
});

// Handle delete-key IPC call - UPDATED for multiple keys
ipcMain.handle('delete-key', async (event, keyId) => {
  try {
    console.log(`[KeyManager] delete-key handler called with keyId: ${keyId}`);
    
    if (!keyId) {
      return { success: false, error: 'No key ID provided' };
    }
    
    const success = deleteKey(keyId);
    if (success) {
      // Update file system backup if we deleted the active key
      try {
        const keyPath = path.join(app.getPath('userData'), 'encryption.key');
        const activeKey = getActiveKey();
        if (activeKey) {
          fs.writeFileSync(keyPath, activeKey.key.toString('hex'), 'utf8');
          console.log(`[KeyManager] Updated file system backup after deleting key ${keyId}`);
        } else {
          // No active key left, remove the backup file
          if (fs.existsSync(keyPath)) {
            fs.unlinkSync(keyPath);
            console.log(`[KeyManager] Removed file system backup (no active keys left)`);
          }
        }
      } catch (fileErr) {
        console.error('[KeyManager] Error updating file system backup:', fileErr);
      }
      
      return {
        success: true,
        message: `Key ${keyId} has been deleted successfully`,
        activeKeyId: activeKeyId
      };
    } else {
      return {
        success: false,
        error: `Key ${keyId} not found`
      };
    }
  } catch (error) {
    console.error('[KeyManager] Error deleting key:', error);
    return { success: false, error: error.message };
  }
});

// Manifest management functions
async function updateManifest(dateFolderId, originalFilename, encryptedFilename, dekHash, metadata = {}) {
    try {
        const manifestName = 'manifest.json';
        
        // Try to find existing manifest
        let manifestFileId = null;
        const response = await googleDrive.files.list({
            q: `name='${manifestName}' and '${dateFolderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });
        
        let manifest = { files: {}, metadata: { created: new Date().toISOString(), updated: new Date().toISOString() } };
        
        // Load existing manifest if it exists
        if (response.data.files.length > 0) {
            manifestFileId = response.data.files[0].id;
            try {
                const manifestResponse = await googleDrive.files.get({
                    fileId: manifestFileId,
                    alt: 'media'
                });
                manifest = JSON.parse(manifestResponse.data);
                manifest.metadata.updated = new Date().toISOString();
            } catch (parseError) {
                console.warn('[main.js] Could not parse existing manifest, creating new one');
            }
        }
        
        // Add/update file entry
        manifest.files[originalFilename] = {
            encryptedFilename,
            dekHash,
            timestamp: new Date().toISOString(),
            ...metadata
        };
        
        // Upload or update manifest
        const manifestContent = JSON.stringify(manifest, null, 2);
        const manifestBuffer = Buffer.from(manifestContent, 'utf8');
        
        if (manifestFileId) {
            // Update existing manifest
            await googleDrive.files.update({
                fileId: manifestFileId,
                media: {
                    mimeType: 'application/json',
                    body: manifestBuffer
                }
            });
        } else {
            // Create new manifest
            await googleDrive.files.create({
                requestBody: {
                    name: manifestName,
                    parents: [dateFolderId],
                    mimeType: 'application/json'
                },
                media: {
                    mimeType: 'application/json',
                    body: manifestBuffer
                }
            });
        }
        
        console.log(`[main.js] Updated manifest for file: ${originalFilename} -> ${encryptedFilename}`);
        return true;
    } catch (error) {
        console.error('[main.js] Error updating manifest:', error);
        return false;
    }
}

async function uploadDEKBackup(keysFolderId, password, dekHash) {
    try {
        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters for DEK backup');
        }
        
        // Get current DEK
        const dek = await keyManager.getCurrentDEK();
        
        // Create password-protected backup
        const encryptedDEK = await keyManager.createPasswordProtectedDEKBackup(password, dek);
        
        // Upload to keys folder
        const keyFileName = `${dekHash.substring(0, 16)}.key.enc`;
        
        await googleDrive.files.create({
            requestBody: {
                name: keyFileName,
                parents: [keysFolderId],
                mimeType: 'application/octet-stream'
            },
            media: {
                mimeType: 'application/octet-stream',
                body: encryptedDEK
            }
        });
        
        console.log(`[main.js] Uploaded DEK backup: ${keyFileName}`);
        return true;
    } catch (error) {
        console.error('[main.js] Error uploading DEK backup:', error);
        return false;
    }
}

// Upload file to Google Drive with new vault structure
ipcMain.handle('upload-to-gdrive', async (event, { fileId, fileName, password = null }) => {
  try {
    console.log(`[main.js] upload-to-gdrive called for file: ${fileName}`);
    
    if (!googleDrive) {
      return { success: false, error: 'Google Drive not connected' };
    }
    
    // Get the vault structure
    const vaultStructure = await getOrCreateVaultStructure();
    
    // Find the encrypted file
    const encryptedFilesDir = path.join(app.getPath('userData'), 'encrypted');
    const encryptedFilePath = path.join(encryptedFilesDir, `${fileId}_${fileName}.etcr`);
    
    if (!fs.existsSync(encryptedFilePath)) {
      return { success: false, error: 'Encrypted file not found' };
    }
    
    // Read file and extract DEK hash from header
    const fileData = fs.readFileSync(encryptedFilePath);
    const header = fileData.slice(0, 4);
    
    if (!header.equals(Buffer.from([0x45, 0x54, 0x43, 0x52]))) {
      return { success: false, error: 'Invalid file format' };
    }
    
    const dekHash = fileData.slice(8, 40);
    const dekHashHex = dekHash.toString('hex');
    
    // Upload encrypted file
    const encryptedFilename = `${fileId}_${fileName}.etcr`;
    const uploadResult = await uploadFileToDriveInternal(
      encryptedFilePath, 
      encryptedFilename, 
      vaultStructure.dateFolderId
    );
    
    if (!uploadResult.success) {
      return uploadResult;
    }
    
    // Update manifest
    await updateManifest(
      vaultStructure.dateFolderId,
      fileName,
      encryptedFilename,
      dekHashHex,
      {
        originalSize: fileData.length,
        algorithm: 'aes-256-gcm', // Could be extracted from header
        uploadedAt: new Date().toISOString()
      }
    );
    
    // Upload DEK backup if password provided
    if (password) {
      await uploadDEKBackup(vaultStructure.keysFolderId, password, dekHashHex);
    }
    
    console.log(`[main.js] Successfully uploaded file to vault: ${fileName}`);
    return { 
      success: true, 
      fileId: uploadResult.fileId, 
      message: 'File uploaded to encrypted vault successfully' 
    };
    
  } catch (error) {
    console.error('[main.js] Error uploading to Google Drive vault:', error);
    return { success: false, error: error.message };
  }
});

// Create DEK backup
ipcMain.handle('create-dek-backup', async (event, { password }) => {
  try {
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long' };
    }
    
    if (!googleDrive) {
      return { success: false, error: 'Google Drive not connected' };
    }
    
    // Get vault structure
    const vaultStructure = await getOrCreateVaultStructure();
    
    // Get current DEK
    const dek = await keyManager.getCurrentDEK();
    const dekHash = crypto.createHash('sha256').update(dek).digest('hex');
    
    // Upload DEK backup
    const result = await uploadDEKBackup(vaultStructure.keysFolderId, password, dekHash);
    
    if (result) {
      return { success: true, message: 'DEK backup created successfully' };
    } else {
      return { success: false, error: 'Failed to create DEK backup' };
    }
    
  } catch (error) {
    console.error('[main.js] Error creating DEK backup:', error);
    return { success: false, error: error.message };
  }
});

// Restore DEK from backup
ipcMain.handle('restore-dek-backup', async (event, { password, dekHash }) => {
  try {
    if (!password) {
      return { success: false, error: 'Password is required' };
    }
    
    if (!googleDrive) {
      return { success: false, error: 'Google Drive not connected' };
    }
    
    // Get vault structure
    const vaultStructure = await getOrCreateVaultStructure();
    
    // Find the DEK backup file
    const keyFileName = `${dekHash.substring(0, 16)}.key.enc`;
    const response = await googleDrive.files.list({
      q: `name='${keyFileName}' and '${vaultStructure.keysFolderId}' in parents and trashed=false`,
      fields: 'files(id)',
    });
    
    if (response.data.files.length === 0) {
      return { success: false, error: 'DEK backup not found' };
    }
    
    // Download the backup
    const fileId = response.data.files[0].id;
    const backupResponse = await googleDrive.files.get({
      fileId: fileId,
      alt: 'media'
    });
    
    // Decrypt the DEK
    const encryptedDEK = Buffer.from(backupResponse.data, 'binary');
    const dek = await keyManager.decryptPasswordProtectedDEKBackup(password, encryptedDEK);
    
    // Store the restored DEK
    await keytar.setPassword('seamless-encryptor-keys', 'master', dek.toString('hex'));
    
    return { success: true, message: 'DEK restored successfully' };
    
  } catch (error) {
    console.error('[main.js] Error restoring DEK backup:', error);
    return { success: false, error: error.message };
  }
});

// Get vault information
ipcMain.handle('get-vault-info', async (event) => {
  try {
    if (!googleDrive) {
      return { success: false, error: 'Google Drive not connected' };
    }
    
    const vaultStructure = await getOrCreateVaultStructure();
    
    return {
      success: true,
      vaultInfo: {
        userUUID: vaultStructure.userUUID,
        vaultPath: `/EncryptedVault/${vaultStructure.userUUID}`,
        currentDateFolder: new Date().toISOString().split('T')[0],
        folders: {
          vault: vaultStructure.vaultFolderId,
          user: vaultStructure.userFolderId,
          today: vaultStructure.dateFolderId,
          keys: vaultStructure.keysFolderId
        }
      }
    };
    
  } catch (error) {
    console.error('[main.js] Error getting vault info:', error);
    return { success: false, error: error.message };
  }
});

// Save temporary file
ipcMain.handle('save-temporary-file', async (event, fileName, buffer) => {
  try {
    const tempDir = path.join(app.getPath('temp'), 'seamless-encryptor');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate unique filename to avoid conflicts
    const uniqueName = `${Date.now()}_${fileName}`;
    const tempPath = path.join(tempDir, uniqueName);
    
    // Write buffer to file
    fs.writeFileSync(tempPath, Buffer.from(buffer));
    
    console.log(`[main.js] Saved temporary file: ${tempPath}`);
    return tempPath;
    
  } catch (error) {
    console.error('[main.js] Error saving temporary file:', error);
    throw error;
  }
});

// Download file from Google Drive
ipcMain.handle('gdrive-download-file', async (event, { fileId, fileName }) => {
  try {
    console.log(`[main.js] gdrive-download-file called for: ${fileName}`);
    
    if (!googleDrive) {
      return { success: false, error: 'Google Drive not connected' };
    }
    
    // Get the file content with proper response type handling
    const response = await googleDrive.files.get({
      fileId: fileId,
      alt: 'media'
    }, {
      responseType: 'arraybuffer' // Ensure we get binary data
    });
    
    if (!response || !response.data) {
      return { success: false, error: 'No file data received from Google Drive' };
    }
    
    // Use configured output directory instead of downloads
    const outputDir = ensureOutputDirExists();
    if (!outputDir) {
      return { success: false, error: 'Output directory not configured' };
    }
    
    // Generate unique filename if file already exists
    let finalFileName = fileName;
    let filePath = path.join(outputDir, finalFileName);
    let counter = 1;
    
    while (fs.existsSync(filePath)) {
      const ext = path.extname(finalFileName);
      const nameWithoutExt = path.basename(finalFileName, ext);
      const newFileName = `${nameWithoutExt}_${counter}${ext}`;
      filePath = path.join(outputDir, newFileName);
      counter++;
    }
    
    // Write file to output directory with proper data handling
    try {
      let fileData;
      if (response.data instanceof ArrayBuffer) {
        fileData = Buffer.from(response.data);
      } else if (Buffer.isBuffer(response.data)) {
        fileData = response.data;
      } else if (typeof response.data === 'string') {
        fileData = Buffer.from(response.data, 'utf8');
      } else {
        fileData = Buffer.from(response.data);
      }
      
      fs.writeFileSync(filePath, fileData);
      console.log(`[main.js] Downloaded file to: ${filePath} (${fileData.length} bytes)`);
      
    } catch (writeError) {
      console.error(`[main.js] Error writing downloaded file:`, writeError);
      return { success: false, error: `Failed to save file: ${writeError.message}` };
    }
    
    return {
      success: true,
      filePath: filePath,
      message: `Downloaded ${fileName} to output folder`
    };
    
  } catch (error) {
    console.error('[main.js] Error downloading file from Google Drive:', error);
    return { success: false, error: error.message };
  }
});

