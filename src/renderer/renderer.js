// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('dropZone');
  const selectFileBtn = document.getElementById('selectFile');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const status = document.getElementById('status');
  const error = document.getElementById('error');
  const success = document.getElementById('success');
  const fileList = document.getElementById('fileList');

  // Initialize encryption key
  let encryptionKey = null;

  async function initializeKey() {
      let key = await window.api.getKey();
      if (!key) {
          key = await window.api.generateKey();
          await window.api.setKey(key);
      }
      encryptionKey = key;
  }

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop zone when dragging over it
  ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, unhighlight, false);
  });

  // Handle dropped files
  dropZone.addEventListener('drop', handleDrop, false);

  // Handle file selection button
  selectFileBtn.addEventListener('click', async () => {
      const filePath = await window.api.openFileDialog();
      if (filePath) {
          await handleSelectedFile(filePath);
      }
  });

  function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
  }

  function highlight(e) {
      dropZone.classList.add('dragover');
  }

  function unhighlight(e) {
      dropZone.classList.remove('dragover');
  }

  function handleDrop(e) {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
          const file = files[0];
          handleDroppedFile(file);
      }
  }

  function showSuccess(message) {
      success.textContent = message;
      success.style.display = 'block';
      setTimeout(() => {
          success.style.display = 'none';
      }, 3000);
  }

  function showError(message) {
      error.textContent = message;
      error.style.display = 'block';
      setTimeout(() => {
          error.style.display = 'none';
      }, 5000);
  }

  function updateFileList() {
      fileList.innerHTML = '';
      
      // Get all files from localStorage
      const files = Object.keys(localStorage)
          .filter(key => key.startsWith('file-'))
          .map(key => JSON.parse(localStorage.getItem(key)))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (files.length === 0) {
          fileList.innerHTML = '<p>No encrypted files yet</p>';
          return;
      }

      files.forEach(file => {
          const fileElement = document.createElement('div');
          fileElement.className = 'file-item';
          fileElement.innerHTML = `
              <span class="file-name">${file.name}</span>
              <div class="file-actions">
                  <button onclick="downloadFile('${file.id}', '${file.name}')">Download</button>
                  <button onclick="downloadEncryptedFile('${file.id}', '${file.name}')">Download Encrypted</button>
                  <button onclick="deleteFile('${file.id}')" class="delete">Delete</button>
              </div>
          `;
          fileList.appendChild(fileElement);
      });
  }

  // For files coming from the file dialog
  async function handleSelectedFile(filePath) {
      try {
          progressContainer.style.display = 'block';
          progressBar.style.width = '0%';
          status.textContent = 'Encrypting and uploading file...';

          // Encrypt and upload the file
          const result = await window.api.encryptFile(filePath);
          
          if (result && result.success) {
              // Store file info in localStorage
              const fileInfo = {
                  id: result.fileId,
                  name: result.fileName,
                  timestamp: new Date().toISOString()
              };
              localStorage.setItem(`file-${result.fileId}`, JSON.stringify(fileInfo));
              
              // Update UI
              updateFileList();
              showSuccess('File encrypted and uploaded successfully!');
          } else {
              throw new Error(result ? result.error : 'Unknown error during encryption');
          }
      } catch (err) {
          showError(`Error: ${err.message || 'Unknown error'}`);
      } finally {
          progressContainer.style.display = 'none';
      }
  }

  // For files coming from drag and drop
  async function handleDroppedFile(file) {
      try {
          // Check file size (limit to 100MB to prevent memory issues)
          const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
          if (file.size > MAX_FILE_SIZE) {
              throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
          }
          
          // Show progress
          progressContainer.style.display = 'block';
          progressBar.style.width = '0%';
          status.textContent = 'Reading dropped file...';
          
          // Read the file content
          const reader = new FileReader();
          const fileData = await new Promise((resolve, reject) => {
              reader.onload = (e) => resolve(e.target.result);
              reader.onerror = (e) => reject(new Error('Error reading file'));
              reader.readAsArrayBuffer(file);
          });
          
          // Create a simplified file object with only the necessary data
          const fileInfo = {
              name: file.name,
              type: file.type,
              size: file.size,
              data: Array.from(new Uint8Array(fileData))
          };
          
          progressBar.style.width = '30%';
          status.textContent = 'Processing file...';
          
          // Save the file data to a temporary location
          const tempPath = await window.api.saveDroppedFile(fileInfo);
          if (tempPath) {
              // Then process it like a selected file
              await handleSelectedFile(tempPath);
          } else {
              throw new Error('Could not save the dropped file temporarily');
          }
      } catch (err) {
          showError(`Error: ${err.message || 'Unknown error'}`);
          progressContainer.style.display = 'none';
      }
  }

  // Attach download and delete functions to window
  window.downloadFile = async function(fileId, fileName) {
      try {
          progressContainer.style.display = 'block';
          
          const result = await window.api.downloadFile(fileId, fileName);
          
          if (result.success) {
              showSuccess('File downloaded and decrypted successfully!');
          } else {
              throw new Error(result.error || 'Unknown error during download');
          }
      } catch (err) {
          showError(`Error: ${err.message || 'Unknown error'}`);
      } finally {
          // Hide progress after a short delay to allow user to see completion
          setTimeout(() => {
              progressContainer.style.display = 'none';
          }, 1500);
      }
  };

  window.deleteFile = async function(fileId) {
      try {
          // Remove from localStorage
          localStorage.removeItem(`file-${fileId}`);
          
          // Remove from storage service
          await window.api.deleteFile(fileId);
          
          showSuccess('File deleted successfully!');
          updateFileList();
      } catch (err) {
          showError(`Error: ${err.message || 'Unknown error'}`);
      }
  };

  // Add new function for downloading encrypted files
  window.downloadEncryptedFile = async function(fileId, fileName) {
      try {
          progressContainer.style.display = 'block';
          
          const result = await window.api.downloadEncryptedFile(fileId, fileName);
          
          if (result.success) {
              showSuccess('Encrypted file downloaded successfully!');
          } else {
              throw new Error(result.error || 'Unknown error during download');
          }
      } catch (err) {
          showError(`Error: ${err.message || 'Unknown error'}`);
      } finally {
          // Hide progress after a short delay to allow user to see completion
          setTimeout(() => {
              progressContainer.style.display = 'none';
          }, 1500);
      }
  };

  // Progress and status updates
  window.api.onProgress((value) => {
      progressBar.style.width = `${value}%`;
  });

  window.api.onDownloadProgress((data) => {
      progressBar.style.width = `${data.progress}%`;
      status.textContent = data.status;
  });

  window.api.onError((message) => {
      showError(message);
  });

  window.api.onSuccess((message) => {
      showSuccess(message);
  });

  // Initialize
  initializeKey();
  updateFileList();
}); 