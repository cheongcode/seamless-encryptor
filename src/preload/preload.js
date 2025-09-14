const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Files
  encryptFile: (filePath) => ipcRenderer.invoke('encrypt-file', filePath),
  decryptFile: (encryptedData) => ipcRenderer.invoke('decrypt-file', encryptedData),
  decryptFileFromPath: (filePath) => ipcRenderer.invoke('decrypt-file-from-path', filePath),
  downloadFile: (fileId, fileName) => ipcRenderer.invoke('download-file', { fileId, fileName }),
  downloadEncryptedFile: (fileId, fileName) => ipcRenderer.invoke('download-encrypted-file', { fileId, fileName }),
  deleteFile: (fileId) => ipcRenderer.invoke('delete-file', fileId),
  saveDroppedFile: (fileObject) => ipcRenderer.invoke('save-dropped-file', fileObject),
  
  // Keys
  generateKey: () => ipcRenderer.invoke('generate-key'),
  getKey: () => ipcRenderer.invoke('get-key'),
  setKey: (key) => ipcRenderer.invoke('set-key', key),
  saveKeyFile: (filePath, keyData) => ipcRenderer.invoke('save-key-file', { filePath, keyData }),
  loadKeyFile: (filePath) => ipcRenderer.invoke('load-key-file', filePath),
  
  // Dialogs
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openMultipleFileDialog: () => ipcRenderer.invoke('open-multiple-file-dialog'),
  saveFileDialog: () => ipcRenderer.invoke('save-file-dialog'),
  openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
  
  // Events
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
