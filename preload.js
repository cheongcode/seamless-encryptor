// Preload script for Electron app
const { contextBridge, ipcRenderer } = require('electron');

console.log('[preload.js] Preload script starting execution...');
console.log(`[PRELOAD ${new Date().toISOString()}] Preload script starting...`);
console.log('Process type:', process.type);
console.log('Node version:', process.versions.node);
console.log('Chrome version:', process.versions.chrome);
console.log('Electron version:', process.versions.electron);

// Helper function to debug IPC calls
function debugIpc(method, ...args) {
  console.log(`[preload.js] IPC call: ${method}`, ...args);
  return args;
}

// Helper function for safely invoking IPC methods with better error handling
async function safeInvoke(channel, ...args) {
  console.log(`[preload.js] Invoking ${channel} with args:`, args);
  try {
    const result = await ipcRenderer.invoke(channel, ...args);
    console.log(`[preload.js] ${channel} result:`, result);
    return result;
  } catch (error) {
    console.error(`[preload.js] Error invoking ${channel}:`, error);
    throw error;
  }
}

// Attempt to expose the API to the renderer process
try {
  console.log('[preload.js] Attempting to expose electronAPI via contextBridge...');
  console.log(`[PRELOAD ${new Date().toISOString()}] About to expose API to renderer...`);
  
  // Create API object with all available methods
  const apiMethods = {
    // Basic test method to check if IPC is working
    test: () => {
      console.log('[preload.js] test() called');
      return safeInvoke('test-ipc');
    },
    
    // IPC test method (alias for clarity)
    testIPC: () => {
      console.log('[preload.js] testIPC() called');
      return safeInvoke('test-ipc');
    },
    
    // Get app version
    getAppVersion: () => {
      console.log('[preload.js] getAppVersion() called');
      return safeInvoke('get-app-version');
    },
    
    // File operations
    openFileDialog: () => {
      console.log('[preload.js] openFileDialog() called');
      return safeInvoke('open-file-dialog');
    },
    
    saveFileDialog: (defaultFilename) => {
      console.log('[preload.js] saveFileDialog() called with:', defaultFilename);
      return safeInvoke('save-file-dialog', defaultFilename);
    },
    
    encryptFile: (filePath, method) => {
      console.log('[preload.js] encryptFile() called with:', { filePath, method });
      return safeInvoke('encrypt-file', filePath, method);
    },
    
    decryptFile: (fileId, fileName) => {
      console.log('[preload.js] decryptFile() called with:', { fileId, fileName });
      return safeInvoke('decrypt-file', fileId, fileName);
    },
    
    getEncryptedFiles: () => {
      console.log('[preload.js] getEncryptedFiles() called');
      return safeInvoke('get-encrypted-files');
    },
    
    downloadEncryptedFile: (fileId, fileName = null) => {
      console.log('[preload.js] downloadEncryptedFile() called with:', { fileId, fileName });
      // Format parameters correctly to match what the main process expects
      return safeInvoke('download-encrypted-file', { fileId, fileName: fileName || fileId });
    },
    
    deleteEncryptedFile: (fileId) => {
      console.log('[preload.js] deleteEncryptedFile() called with:', fileId);
      return safeInvoke('delete-encrypted-file', fileId);
    },
    
    // Key management
    generateKey: () => {
      console.log('[preload.js] generateKey() called');
      return safeInvoke('generate-key');
    },
    
    checkKeyStatus: () => {
      console.log('[preload.js] checkKeyStatus() called');
      return safeInvoke('check-key-status');
    },
    
    importKey: (keyData) => {
      console.log('[preload.js] importKey() called');
      return safeInvoke('import-key', keyData);
    },
    
    createCustomKey: (passphrase, entropyPhrase) => {
      console.log('[preload.js] createCustomKey() called');
      return safeInvoke('create-custom-key', passphrase, entropyPhrase);
    },
    
    // Encryption methods
    getEncryptionMethods: () => {
      console.log('[preload.js] getEncryptionMethods() called');
      return safeInvoke('get-encryption-methods');
    },
    
    getCurrentEncryptionMethod: () => {
      console.log('[preload.js] getCurrentEncryptionMethod() called');
      return safeInvoke('get-current-encryption-method');
    },
    
    setEncryptionMethod: (method) => {
      console.log('[preload.js] setEncryptionMethod() called with:', method);
      return safeInvoke('set-encryption-method', method);
    },
    
    // Event listeners (for async notifications from main process)
    onError: (callback) => {
      console.log('[preload.js] onError listener registered');
      ipcRenderer.on('error', (event, message) => {
        console.log('[preload.js] Error event received:', message);
        callback(message);
      });
    },
    
    onSuccess: (callback) => {
      console.log('[preload.js] onSuccess listener registered');
      ipcRenderer.on('success', (event, message) => {
        console.log('[preload.js] Success event received:', message);
        callback(message);
      });
    },
    
    onProgress: (callback) => {
      console.log('[preload.js] onProgress listener registered');
      ipcRenderer.on('progress', (event, progress) => {
        console.log('[preload.js] Progress event received:', progress);
        callback(progress);
      });
    },

    // Entropy Analysis
    analyzeFileEntropy: (fileIdOrPath) => {
      console.log('[preload.js] analyzeFileEntropy() called with:', fileIdOrPath);
      return safeInvoke('analyze-file-entropy', fileIdOrPath);
    },

    // Shell operations
    openExternalUrl: (url) => {
      console.log('[preload.js] openExternalUrl() called with:', url);
      return safeInvoke('open-external-url', url);
    }
  };
  
  // Log all methods we're exposing
  console.log('[preload.js] Exposing the following API methods:', Object.keys(apiMethods));
  
  // Expose the API via contextBridge - use BOTH window.api and window.electronAPI for compatibility
  contextBridge.exposeInMainWorld('api', apiMethods);
  console.log('[preload.js] API successfully exposed as window.api');
  
  contextBridge.exposeInMainWorld('electronAPI', apiMethods);
  console.log('[preload.js] electronAPI successfully exposed.');
  console.log(`[PRELOAD ${new Date().toISOString()}] API exposed to renderer process`);

  // Also expose additional test method
  console.log('[preload.js] Exposing additional test methods...');
  contextBridge.exposeInMainWorld('testApi', {
    ping: () => {
      console.log('[preload.js] testApi.ping() called');
      return 'pong';
    },
    echo: (msg) => {
      console.log('[preload.js] testApi.echo() called with:', msg);
      return msg;
    }
  });
  
  // Additional debug listeners for every IPC method
  console.log('[preload.js] Setting up debug IPC listeners...');
  ipcRenderer.on('debug', (event, message) => {
    console.log('[preload.js] Debug message from main process:', message);
  });

  // --- Settings API ---
  console.log('[preload.js] Exposing settingsApi...');
  contextBridge.exposeInMainWorld('settingsApi', {
    getAppSettings: () => safeInvoke('get-app-settings'),
    setAppSettings: (settings) => safeInvoke('set-app-settings', settings),
    resetAppSettings: () => safeInvoke('reset-app-settings'),
    selectOutputDirectory: () => safeInvoke('select-output-directory'),
    getDefaultOutputDir: () => safeInvoke('get-default-output-dir'),
    clearAppData: () => safeInvoke('clear-app-data')
  });
  console.log('[preload.js] settingsApi exposed successfully.');

  // --- Cloud API (for Google Drive, etc.) ---
  console.log('[preload.js] Exposing cloudApi...');
  contextBridge.exposeInMainWorld('cloudApi', {
    // Google Drive
    connectGDrive: () => safeInvoke('gdrive-connect'),
    disconnectGDrive: () => safeInvoke('gdrive-disconnect'),
    getGDriveAuthStatus: () => safeInvoke('gdrive-status'),
    exchangeGDriveAuthCode: (code) => safeInvoke('gdrive-exchange-auth-code', code),
    listGDriveFiles: (options) => safeInvoke('gdrive-list-files', options)
    // Future cloud provider functions can be added here
  });
  console.log('[preload.js] cloudApi exposed successfully.');

} catch (error) {
  console.error('[preload.js] Error setting up preload API:', error);
  console.error('Error in preload script:', error);
}

console.log('[preload.js] Exposing window.api and window.electronAPI to ensure compatibility');

console.log('[preload.js] Preload script finished execution.');