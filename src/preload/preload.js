// Preload script for secure IPC communication

const { contextBridge, ipcRenderer } = require('electron');

// Expose specific API methods to the renderer process
contextBridge.exposeInMainWorld('api', {
  // File operations
  encryptFile: (filePath) => ipcRenderer.invoke('encrypt-file', filePath),
  decryptFile: (encryptedData) => ipcRenderer.invoke('decrypt-file', encryptedData),
  downloadFile: (fileId, fileName) => ipcRenderer.invoke('download-file', { fileId, fileName }),
  downloadEncryptedFile: (fileId, fileName) => ipcRenderer.invoke('download-encrypted-file', { fileId, fileName }),
  deleteFile: (fileId) => ipcRenderer.invoke('delete-file', fileId),
  saveDroppedFile: (fileObject) => ipcRenderer.invoke('save-dropped-file', fileObject),
  
  // Key management
  generateKey: () => ipcRenderer.invoke('generate-key'),
  getKey: () => ipcRenderer.invoke('get-key'),
  setKey: (key) => ipcRenderer.invoke('set-key', key),
  
  // File dialogs
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: () => ipcRenderer.invoke('save-file-dialog'),
  
  // Event listeners
  onProgress: (callback) => {
    ipcRenderer.on('progress', (_event, value) => callback(value));
    return () => ipcRenderer.removeListener('progress', callback);
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_event, data) => callback(data));
    return () => ipcRenderer.removeListener('download-progress', callback);
  },
  onError: (callback) => {
    ipcRenderer.on('error', (_event, message) => callback(message));
    return () => ipcRenderer.removeListener('error', callback);
  },
  onSuccess: (callback) => {
    ipcRenderer.on('success', (_event, message) => callback(message));
    return () => ipcRenderer.removeListener('success', callback);
  }
});
