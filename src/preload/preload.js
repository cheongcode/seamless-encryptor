// Preload script for secure IPC communication

const { contextBridge, ipcRenderer } = require('electron');

console.log('[preload.js] Preload script starting execution...');
console.log('[PRELOAD ' + new Date().toISOString() + '] Preload script starting...');
console.log('Process type:', process.type);
console.log('Node version:', process.versions.node);
console.log('Chrome version:', process.versions.chrome);
console.log('Electron version:', process.versions.electron);

// Helper function for safer IPC invocation with error logging
const safeInvoke = async (channel, ...args) => {
  try {
    console.log(`Invoking IPC channel: "${channel}" with args:`, args);
    const result = await ipcRenderer.invoke(channel, ...args);
    console.log(`Result from "${channel}":`, result);
    return result;
  } catch (error) {
    console.error(`Error in IPC channel "${channel}":`, error);
    throw error;
  }
};

// Expose specific API methods to the renderer process
try {
  console.log('[preload.js] Attempting to expose electronAPI via contextBridge...');
  console.log('[PRELOAD ' + new Date().toISOString() + '] About to expose API to renderer...');
  
  // Main application API
  const apiMethods = {
    // File operations
    encryptFile: (filePath, method) => {
      console.log(`[preload.js] encryptFile() called with:`, filePath, `method: ${method}`);
      return safeInvoke('encrypt-file', filePath, method);
    },
    decryptFile: (fileId, password) => {
      console.log(`preload: decryptFile called with fileId: ${fileId}, password: ${password ? '***' : 'none'}`);
      return safeInvoke('decrypt-file', { fileId, password });
    },
    downloadFile: (fileId, fileName) => {
      console.log(`preload: downloadFile called with fileId: ${fileId}, fileName: ${fileName}`);
      return safeInvoke('download-file', { fileId, fileName });
    },
    downloadEncryptedFile: (fileId, fileName) => {
      console.log(`preload: downloadEncryptedFile called with fileId: ${fileId}, fileName: ${fileName}`);
      return safeInvoke('download-encrypted-file', { fileId, fileName });
    },
    deleteFile: (fileId) => {
      console.log(`preload: deleteFile called with fileId: ${fileId}`);
      return safeInvoke('delete-file', fileId);
    },
    saveDroppedFile: (fileObject) => {
      console.log(`preload: saveDroppedFile called with filename: ${fileObject.name}`);
      return safeInvoke('save-dropped-file', fileObject);
    },
    listFiles: () => {
      console.log('preload: listFiles called');
      return safeInvoke('list-files');
    },
    
    // Key management
    generateKey: () => {
      console.log('preload: generateKey called');
      return safeInvoke('generate-key');
    },
    forceGenerateKey: () => {
      console.log('preload: forceGenerateKey called');
      return safeInvoke('force-generate-key');
    },
    createCustomKey: (passphrase, entropyPhrase) => {
      console.log('preload: createCustomKey called');
      return safeInvoke('create-custom-key', passphrase, entropyPhrase);
    },
    getKey: () => {
      console.log('preload: getKey called');
      return safeInvoke('get-key');
    },
    setKey: (key) => {
      console.log('preload: setKey called');
      return safeInvoke('set-key', key);
    },
    checkKeyStatus: () => {
      console.log('preload: checkKeyStatus called');
      return safeInvoke('check-key-status');
    },
    exportKey: () => {
      console.log('preload: exportKey called');
      return safeInvoke('export-key');
    },
    deleteKey: (keyId) => {
      console.log('preload: deleteKey called with keyId:', keyId);
      return safeInvoke('delete-key', keyId);
    },
    importKey: (keyData) => {
      console.log('preload: importKey called');
      return safeInvoke('import-key', keyData);
    },
    
    // NEW: Multiple key management APIs
    listKeys: () => {
      console.log('preload: listKeys called');
      return safeInvoke('list-keys');
    },
    setActiveKey: (keyId) => {
      console.log('preload: setActiveKey called with keyId:', keyId);
      return safeInvoke('set-active-key', keyId);
    },
    
    // Encryption methods
    getEncryptionMethods: () => {
      console.log('preload: getEncryptionMethods called');
      return safeInvoke('get-encryption-methods');
    },
    getCurrentEncryptionMethod: () => {
      console.log('preload: getCurrentEncryptionMethod called');
      return safeInvoke('get-current-encryption-method');
    },
    setEncryptionMethod: (method) => {
      console.log(`preload: setEncryptionMethod called with method: ${method}`);
      return safeInvoke('set-encryption-method', method);
    },
    
    // File dialogs and operations
    openFileDialog: () => {
      console.log('preload: openFileDialog called');
      return safeInvoke('open-file-dialog');
    },
    openDirectoryDialog: () => {
      console.log('preload: openDirectoryDialog called');
      return safeInvoke('open-directory-dialog');
    },
    saveFileDialog: (fileName) => {
      console.log(`preload: saveFileDialog called with fileName: ${fileName}`);
      return safeInvoke('save-file-dialog', fileName);
    },
    getFileStats: (filePath) => {
      console.log(`preload: getFileStats called with path: ${filePath}`);
      return safeInvoke('getFileStats', filePath);
    },
    
    // Testing IPC (from test-preload.js)
    testIPC: () => {
      console.log('preload: testIPC called');
      return safeInvoke('test-ipc');
    },
    
    // Event listeners
    onProgress: (callback) => {
      console.log('preload: onProgress listener registered');
      const listener = (_event, value) => {
        console.log(`preload: progress event received:`, value);
        callback(value);
      };
      ipcRenderer.on('progress', listener);
      return () => ipcRenderer.removeListener('progress', listener);
    },
    onDownloadProgress: (callback) => {
      console.log('preload: onDownloadProgress listener registered');
      const listener = (_event, data) => {
        console.log(`preload: download-progress event received:`, data);
        callback(data);
      };
      ipcRenderer.on('download-progress', listener);
      return () => ipcRenderer.removeListener('download-progress', listener);
    },
    onError: (callback) => {
      console.log('preload: onError listener registered');
      const listener = (_event, message) => {
        console.log(`preload: error event received: ${message}`);
        callback(message);
      };
      ipcRenderer.on('error', listener);
      return () => ipcRenderer.removeListener('error', listener);
    },
    onSuccess: (callback) => {
      console.log('preload: onSuccess listener registered');
      const listener = (_event, message) => {
        console.log(`preload: success event received: ${message}`);
        callback(message);
      };
      ipcRenderer.on('success', listener);
      return () => ipcRenderer.removeListener('success', listener);
    },
    
    // Analyze file entropy for visualization
    analyzeFileEntropy: (fileId) => {
      console.log(`preload: analyzeFileEntropy called with fileId: ${fileId}`);
      return safeInvoke('analyze-file-entropy', fileId);
    },
    
    // List encrypted files
    getEncryptedFiles: () => {
      console.log('preload: getEncryptedFiles called');
      return safeInvoke('get-encrypted-files');
    },
    
    // Delete encrypted file
    deleteEncryptedFile: (fileId) => {
      console.log(`preload: deleteEncryptedFile called with fileId: ${fileId}`);
      return safeInvoke('delete-encrypted-file', fileId);
    },
    openExternalUrl: (url) => {
      console.log(`preload: openExternalUrl called with url: ${url}`);
      return safeInvoke('open-external-url', url);
    },
    saveTemporaryFile: (fileName, buffer) => {
      console.log(`preload: saveTemporaryFile called with fileName: ${fileName}`);
      return safeInvoke('save-temporary-file', fileName, buffer);
    }
  };
  
  // Log the available API methods
  console.log('[preload.js] Exposing the following API methods:', Object.keys(apiMethods));
  
  // Expose the API
  contextBridge.exposeInMainWorld('api', apiMethods);
  console.log('[preload.js] API successfully exposed as window.api');
  
  // Also expose as electronAPI for backwards compatibility
  contextBridge.exposeInMainWorld('electronAPI', apiMethods);
  console.log('[preload.js] electronAPI successfully exposed.');
  console.log('[PRELOAD ' + new Date().toISOString() + '] API exposed to renderer process');

  // For additional testing
  console.log('[preload.js] Exposing additional test methods...');
  
  // Also expose the test API for compatibility with existing test pages
  contextBridge.exposeInMainWorld('testAPI', {
    testIPC: () => {
      console.log('testAPI: testIPC function called from renderer');
      return safeInvoke('test-ipc');
    }
  });
  
  console.log('[preload.js] Setting up debug IPC listeners...');
  
  // Final safety check to ensure both APIs are available in all contexts
  console.log('[preload.js] Exposing window.api and window.electronAPI to ensure compatibility');
  
  // Settings API
  contextBridge.exposeInMainWorld('settingsApi', {
    getAppSettings: () => safeInvoke('get-app-settings'),
    setAppSettings: (settings) => safeInvoke('set-app-settings', settings),
    resetAppSettings: () => safeInvoke('reset-app-settings'),
    selectOutputDirectory: () => safeInvoke('select-output-directory'),
    getDefaultOutputDir: () => safeInvoke('get-default-output-dir'),
    clearAppData: () => safeInvoke('clear-app-data'),
    getAppVersion: () => safeInvoke('get-app-version')
  });
  console.log('[preload.js] settingsApi successfully exposed.');

  // Cloud API (for Google Drive)
  contextBridge.exposeInMainWorld('cloudApi', {
    connectGDrive: () => safeInvoke('gdrive-connect'),
    exchangeGDriveAuthCode: (authCode) => safeInvoke('gdrive-exchange-auth-code', authCode),
    getGDriveStatus: () => safeInvoke('gdrive-status'),
    listGDriveFiles: (options) => safeInvoke('gdrive-list-files', options),
    disconnectGDrive: () => safeInvoke('gdrive-disconnect'),
    uploadFileToGDrive: (filePath, fileName, parentFolderId) => safeInvoke('gdrive-upload-file', { filePath, fileName, parentFolderId }),
    uploadEncryptedFileToGDrive: (fileId) => safeInvoke('gdrive-upload-encrypted-file', fileId),
    downloadGDriveFile: (options) => safeInvoke('gdrive-download-file', options),
    uploadToVault: (options) => safeInvoke('upload-to-gdrive', options),
    getVaultInfo: () => safeInvoke('get-vault-info'),
    createDEKBackup: (options) => safeInvoke('create-dek-backup', options),
    restoreDEKBackup: (options) => safeInvoke('restore-dek-backup', options)
  });
  console.log('[preload.js] cloudApi successfully exposed.');

  console.log('[preload.js] Preload script finished execution.');
} catch (error) {
  console.error('Error in preload script:', error);
}
