document.addEventListener('DOMContentLoaded', () => {
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  const dropZone = document.getElementById('dropZone');
  const selectFileBtn = document.getElementById('selectFile');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const status = document.getElementById('status');
  const error = document.getElementById('error');
  const success = document.getElementById('success');
  const fileList = document.getElementById('fileList');
  const refreshFilesBtn = document.getElementById('refreshFiles');
  
  const decryptDropZone = document.getElementById('decryptDropZone');
  const selectEncryptedFileBtn = document.getElementById('selectEncryptedFile');
  const selectMultipleEncryptedBtn = document.getElementById('selectMultipleEncrypted');
  const decryptProgressContainer = document.getElementById('decryptProgressContainer');
  const decryptProgressBar = document.getElementById('decryptProgressBar');
  const decryptStatus = document.getElementById('decryptStatus');
  const decryptError = document.getElementById('decryptError');
  const decryptSuccess = document.getElementById('decryptSuccess');
  const recentDecryptionsCard = document.getElementById('recentDecryptionsCard');
  const decryptHistoryList = document.getElementById('decryptHistoryList');
  const clearDecryptHistoryBtn = document.getElementById('clearDecryptHistory');
  
  const keyWizard = document.getElementById('keyWizard');
  const keyManagementCard = document.getElementById('keyManagementCard');
  const startKeyGenerationBtn = document.getElementById('startKeyGeneration');
  const currentKeyDisplay = document.getElementById('currentKey');
  const generateNewKeyBtn = document.getElementById('generateNewKey');
  const exportKeyBtn = document.getElementById('exportKey');
  const importKeyBtn = document.getElementById('importKey');
  const copyKeyBtn = document.getElementById('copyKey');
  const showHideKeyBtn = document.getElementById('showHideKey');

  // Google Drive elements
  const googleDriveSetupCard = document.getElementById('googleDriveSetupCard');
  const googleDriveConnectionStatus = document.getElementById('googleDriveConnectionStatus');
  const googleDriveNotConnected = document.getElementById('googleDriveNotConnected');
  const googleDriveConnected = document.getElementById('googleDriveConnected');
  const googleDriveManager = document.getElementById('googleDriveManager');
  const googleClientIdInput = document.getElementById('googleClientId');
  const googleClientSecretInput = document.getElementById('googleClientSecret');
  const connectGoogleDriveBtn = document.getElementById('connectGoogleDrive');
  const connectGoogleDriveAutoBtn = document.getElementById('connectGoogleDriveAuto');
  const googleDriveUserInfo = document.getElementById('googleDriveUserInfo');
  const autoUploadToggle = document.getElementById('autoUploadToggle');
  const uploadToDriveBtn = document.getElementById('uploadToDrive');
  const createFolderBtn = document.getElementById('createFolder');
  const refreshDriveBtn = document.getElementById('refreshDrive');
  const gridViewBtn = document.getElementById('gridView');
  const listViewBtn = document.getElementById('listView');
  const uploadLocalFilesBtn = document.getElementById('uploadLocalFiles');
  const downloadAllFilesBtn = document.getElementById('downloadAllFiles');
  const syncStatusBtn = document.getElementById('syncStatus');
  const uploadFirstFileBtn = document.getElementById('uploadFirstFile');
  const driveFiles = document.getElementById('driveFiles');
  const uploadDropZone = document.getElementById('uploadDropZone');
  const disconnectGoogleDriveBtn = document.getElementById('disconnectGoogleDrive');
  const googleDriveProgressContainer = document.getElementById('googleDriveProgressContainer');
  const googleDriveProgressBar = document.getElementById('googleDriveProgressBar');
  const googleDriveStatus = document.getElementById('googleDriveStatus');
  const googleDriveError = document.getElementById('googleDriveError');
  const googleDriveSuccess = document.getElementById('googleDriveSuccess');

  let encryptionKey = null;
  let keyVisible = false;
  let isFirstTime = false;
  
  // Google Drive state
  let autoUploadEnabled = false;
  let currentViewMode = 'grid'; // 'grid' or 'list'
  let driveFilesList = [];
  let syncQueue = [];

  initializeApp();

  async function initializeApp() {
    try {
      const existingKey = await window.api.getKey();
      if (!existingKey) {
        isFirstTime = true;
        showKeyWizard();
      } else {
        encryptionKey = existingKey;
        showKeyManagement();
        updateKeyDisplay();
      }
      
      updateFileList();
      
      // Check Google Drive connection status
      await checkGoogleDriveConnection();
      
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
    } catch (err) {
      showError('Failed to initialize application: ' + err.message);
    }
  }

  function showKeyWizard() {
    keyWizard.style.display = 'block';
    keyManagementCard.style.display = 'none';
  }

  function showKeyManagement() {
    keyWizard.style.display = 'none';
    keyManagementCard.style.display = 'block';
  }

  // Enhanced key generation with better UX
  startKeyGenerationBtn.addEventListener('click', async () => {
    try {
      startKeyGenerationBtn.disabled = true;
      startKeyGenerationBtn.innerHTML = '<i data-feather="loader"></i> Generating secure key...';
      feather.replace();

      // Add a slight delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newKey = await window.api.generateKey();
      await window.api.setKey(newKey);
      encryptionKey = newKey;

      // Animate transition
      keyWizard.style.transform = 'translateY(-20px)';
      keyWizard.style.opacity = '0';
      
      setTimeout(() => {
        showKeyManagement();
        updateKeyDisplay();
        keyManagementCard.style.transform = 'translateY(20px)';
        keyManagementCard.style.opacity = '0';
        
        setTimeout(() => {
          keyManagementCard.style.transform = 'translateY(0)';
          keyManagementCard.style.opacity = '1';
          keyManagementCard.style.transition = 'all 0.3s ease';
        }, 50);
        
        showSuccess('🎉 Your encryption key has been generated successfully! Your files are now secure.');
      }, 300);

    } catch (err) {
      showError('Failed to generate encryption key: ' + err.message);
      startKeyGenerationBtn.disabled = false;
      startKeyGenerationBtn.innerHTML = '<i data-feather="key"></i> Generate My Encryption Key';
      feather.replace();
    }
  });

  // Tab switching with enhanced animations
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });

  function switchTab(tabName) {
    // Update nav tabs
    navTabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update tab content with fade animation
    tabContents.forEach(content => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // Refresh data when switching to certain tabs
    if (tabName === 'manage') {
      updateFileList();
    } else if (tabName === 'keys') {
      updateKeyDisplay();
    } else if (tabName === 'decrypt') {
      updateDecryptHistory();
    }

    // Re-initialize icons after tab switch
    setTimeout(() => {
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
    }, 100);
  }

  // Enhanced key display with better security
  async function updateKeyDisplay() {
    try {
      const key = await window.api.getKey();
      if (key) {
        encryptionKey = key;
        if (keyVisible) {
          // Format key for better readability
          const formattedKey = key.match(/.{1,8}/g).join(' ');
          currentKeyDisplay.innerHTML = `<span style="font-family: 'SF Mono', Monaco, monospace;">${formattedKey}</span>`;
        } else {
          currentKeyDisplay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
              <span style="flex: 1;">${'●'.repeat(32)} (Hidden for security)</span>
              <small style="color: var(--text-muted); font-size: 0.75rem;">256-bit AES Key</small>
            </div>
          `;
        }
      } else {
        currentKeyDisplay.textContent = 'No encryption key found';
      }
    } catch (err) {
      currentKeyDisplay.textContent = 'Error loading encryption key';
      console.error('Key display error:', err);
    }
  }

  // Enhanced key management event listeners
  generateNewKeyBtn.addEventListener('click', async () => {
    const confirmed = await showConfirmDialog(
      '⚠️ Generate New Key?',
      'Generating a new encryption key will make your existing encrypted files inaccessible unless you have backups. This action cannot be undone.',
      'Generate New Key',
      'Cancel'
    );
    
    if (confirmed) {
      try {
        generateNewKeyBtn.disabled = true;
        generateNewKeyBtn.innerHTML = '<i data-feather="loader"></i> Generating...';
        feather.replace();

        const newKey = await window.api.generateKey();
        await window.api.setKey(newKey);
        encryptionKey = newKey;
        updateKeyDisplay();
        showSuccess('🔑 New encryption key generated successfully! Make sure to backup your new key.');
        updateFileList(); // Refresh file list as old files may no longer be accessible
      } catch (err) {
        showError(`Failed to generate new key: ${err.message}`);
      } finally {
        generateNewKeyBtn.disabled = false;
        generateNewKeyBtn.innerHTML = '<i data-feather="refresh-ccw"></i> Generate New Key';
        feather.replace();
      }
    }
  });

  exportKeyBtn.addEventListener('click', async () => {
    try {
      const key = await window.api.getKey();
      if (!key) {
        showError('No encryption key found to export');
        return;
      }
      
      const savePath = await window.api.saveFileDialog();
      if (savePath) {
        const keyData = {
          version: '1.0',
          key: key,
          created: new Date().toISOString(),
          application: 'Seamless Encryptor',
          keyStrength: 'AES-256',
          description: 'Seamless Encryptor Master Key - Keep this file secure!'
        };
        
        await window.api.saveKeyFile(savePath, JSON.stringify(keyData, null, 2));
        showSuccess('🔐 Encryption key exported successfully! Store this file in a secure location.');
      }
    } catch (err) {
      showError(`Failed to export key: ${err.message}`);
    }
  });

  importKeyBtn.addEventListener('click', async () => {
    const confirmed = await showConfirmDialog(
      '⚠️ Import New Key?',
      'Importing a new key will replace your current encryption key. Make sure you have backed up your current key if needed.',
      'Import Key',
      'Cancel'
    );
    
    if (confirmed) {
      try {
        const filePath = await window.api.openFileDialog();
        if (filePath) {
          const keyData = await window.api.loadKeyFile(filePath);
          if (keyData && keyData.key) {
            await window.api.setKey(keyData.key);
            encryptionKey = keyData.key;
            updateKeyDisplay();
            showSuccess('🔑 Encryption key imported successfully!');
            updateFileList(); // Refresh file list
          } else {
            showError('Invalid key file format');
          }
        }
      } catch (err) {
        showError(`Failed to import key: ${err.message}`);
      }
    }
  });

  copyKeyBtn.addEventListener('click', async () => {
    try {
      const key = await window.api.getKey();
      if (key) {
        await navigator.clipboard.writeText(key);
        showSuccess('🔑 Encryption key copied to clipboard!');
        
        // Visual feedback
        copyKeyBtn.innerHTML = '<i data-feather="check"></i> Copied!';
        setTimeout(() => {
          copyKeyBtn.innerHTML = '<i data-feather="copy"></i> Copy to Clipboard';
          feather.replace();
        }, 2000);
        feather.replace();
      } else {
        showError('No encryption key found');
      }
    } catch (err) {
      showError('Failed to copy key to clipboard');
    }
  });

  showHideKeyBtn.addEventListener('click', () => {
    keyVisible = !keyVisible;
    updateKeyDisplay();
    showHideKeyBtn.innerHTML = keyVisible 
      ? '<i data-feather="eye-off"></i> Hide Key'
      : '<i data-feather="eye"></i> Show Key';
    feather.replace();
  });

  // Enhanced file management
  refreshFilesBtn.addEventListener('click', () => {
    refreshFilesBtn.disabled = true;
    refreshFilesBtn.innerHTML = '<i data-feather="loader"></i> Refreshing...';
    feather.replace();
    
    updateFileList();
    
    setTimeout(() => {
      refreshFilesBtn.disabled = false;
      refreshFilesBtn.innerHTML = '<i data-feather="refresh-cw"></i> Refresh';
      feather.replace();
      showSuccess('📁 File list refreshed!');
    }, 1000);
  });

  // Enhanced drag and drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
  });

  dropZone.addEventListener('drop', handleDrop, false);

  // File selection
  selectFileBtn.addEventListener('click', async () => {
    const filePath = await window.api.openFileDialog();
    if (filePath) {
      await handleSelectedFile(filePath);
    }
  });


  // Decryption tab event listeners
  if (selectEncryptedFileBtn) {
    selectEncryptedFileBtn.addEventListener('click', async () => {
      const filePath = await window.api.openFileDialog();
      if (filePath) {
        await handleDecryptFile(filePath);
      }
    });
  }

  if (selectMultipleEncryptedBtn) {
    selectMultipleEncryptedBtn.addEventListener('click', async () => {
      const filePaths = await window.api.openMultipleFileDialog();
      if (filePaths && filePaths.length > 0) {
        for (const filePath of filePaths) {
          await handleDecryptFile(filePath);
        }
      }
    });
  }

  if (clearDecryptHistoryBtn) {
    clearDecryptHistoryBtn.addEventListener('click', () => {
      clearDecryptionHistory();
    });
  }

  // Decrypt drop zone functionality
  if (decryptDropZone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      decryptDropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      decryptDropZone.addEventListener(eventName, () => {
        decryptDropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      decryptDropZone.addEventListener(eventName, () => {
        decryptDropZone.classList.remove('dragover');
      }, false);
    });

    decryptDropZone.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          await handleDecryptDroppedFile(file);
        }
      }
    }, false);
  }

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

  // Enhanced progress display
  function showProgress(message, percentage = 0) {
    progressContainer.style.display = 'block';
    progressBar.style.width = `${percentage}%`;
    status.textContent = message;
  }

  function hideProgress() {
    setTimeout(() => {
      progressContainer.style.display = 'none';
    }, 1500);
  }

  // Enhanced alert system
  function showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
      successMessage.textContent = message;
    } else {
      success.querySelector('span:last-child').textContent = message;
    }
    success.style.display = 'flex';
    feather.replace();
    setTimeout(() => {
      success.style.display = 'none';
    }, 4000);
  }

  function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
      errorMessage.textContent = message;
    } else {
      error.querySelector('span:last-child').textContent = message;
    }
    error.style.display = 'flex';
    feather.replace();
    setTimeout(() => {
      error.style.display = 'none';
    }, 6000);
  }

  // Enhanced confirmation dialog
  async function showConfirmDialog(title, message, confirmText, cancelText) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
      `;
      
      dialog.innerHTML = `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 2rem;
          max-width: 400px;
          margin: 1rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          animation: slideUp 0.3s ease;
        ">
          <h3 style="margin-bottom: 1rem; color: var(--text-color);">${title}</h3>
          <p style="margin-bottom: 2rem; color: var(--text-muted); line-height: 1.6;">${message}</p>
          <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button class="btn secondary" id="cancelBtn">${cancelText}</button>
            <button class="btn danger" id="confirmBtn">${confirmText}</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      dialog.querySelector('#confirmBtn').onclick = () => {
        document.body.removeChild(dialog);
        resolve(true);
      };
      
      dialog.querySelector('#cancelBtn').onclick = () => {
        document.body.removeChild(dialog);
        resolve(false);
      };
      
      dialog.onclick = (e) => {
        if (e.target === dialog) {
          document.body.removeChild(dialog);
          resolve(false);
        }
      };
    });
  }

  // Auth code input dialog
  async function showAuthCodeDialog() {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
      `;
      
      dialog.innerHTML = `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 2rem;
          max-width: 500px;
          margin: 1rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          animation: slideUp 0.3s ease;
        ">
          <h3 style="margin-bottom: 1rem; color: var(--text-color); display: flex; align-items: center; gap: 0.5rem;">
            <i data-feather="shield" style="color: var(--primary-color);"></i>
            Google Drive Authorization
          </h3>
          <div style="margin-bottom: 2rem;">
            <p style="color: var(--text-muted); line-height: 1.6; margin-bottom: 1rem;">
              A browser window has opened for Google authorization. After you authorize the app, 
              Google will show you an authorization code.
            </p>
            <p style="color: var(--text-muted); line-height: 1.6; margin-bottom: 1.5rem;">
              <strong>Please copy that code and paste it below:</strong>
            </p>
            <input type="text" id="authCodeInput" placeholder="Paste authorization code here..." 
                   style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); 
                          border-radius: 8px; font-size: 1rem; font-family: monospace;">
          </div>
          <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button class="btn secondary" id="cancelAuthBtn">Cancel</button>
            <button class="btn" id="confirmAuthBtn">Connect</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      const authInput = dialog.querySelector('#authCodeInput');
      const confirmBtn = dialog.querySelector('#confirmAuthBtn');
      const cancelBtn = dialog.querySelector('#cancelAuthBtn');
      
      // Focus on input
      setTimeout(() => authInput.focus(), 100);
      
      // Enable confirm button only when input has value
      authInput.addEventListener('input', () => {
        confirmBtn.disabled = !authInput.value.trim();
      });
      
      confirmBtn.onclick = () => {
        const code = authInput.value.trim();
        if (code) {
          document.body.removeChild(dialog);
          resolve(code);
        }
      };
      
      cancelBtn.onclick = () => {
        document.body.removeChild(dialog);
        resolve(null);
      };
      
      // Handle Enter key
      authInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && authInput.value.trim()) {
          confirmBtn.click();
        }
      });
      
      dialog.onclick = (e) => {
        if (e.target === dialog) {
          document.body.removeChild(dialog);
          resolve(null);
        }
      };
      
      // Initialize feather icons in dialog
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
    });
  }

  // Enhanced file list with better UI
  function updateFileList() {
    const files = Object.keys(localStorage)
      .filter(key => key.startsWith('file-'))
      .map(key => JSON.parse(localStorage.getItem(key)))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (files.length === 0) {
      fileList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i data-feather="folder"></i>
          </div>
          <h3>No encrypted files yet</h3>
          <p>Start by encrypting your first file in the Encrypt Files tab</p>
        </div>
      `;
      feather.replace();
      return;
    }

    fileList.innerHTML = '';
    files.forEach(file => {
      const fileElement = document.createElement('div');
      fileElement.className = 'file-item';
      
      const extension = file.name.split('.').pop().toUpperCase();
      const displayExtension = extension.length > 3 ? extension.substring(0, 3) : extension;
      
      const timestamp = new Date(file.timestamp);
      const timeString = timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      fileElement.innerHTML = `
        <div class="file-info">
          <div class="file-icon">${displayExtension}</div>
          <div class="file-details">
            <div class="file-name">${file.name}</div>
            <div class="file-meta">
              <i data-feather="shield" style="width: 14px; height: 14px; margin-right: 4px;"></i>
              Encrypted on ${timeString}
            </div>
          </div>
        </div>
        <div class="file-actions">
          <button class="btn success" onclick="downloadFile('${file.id}', '${file.name}')">
            <i data-feather="download"></i>
            Download
          </button>
          <button class="btn secondary" onclick="downloadEncryptedFile('${file.id}', '${file.name}')">
            <i data-feather="lock"></i>
            Get .enc
          </button>
          <button class="btn danger" onclick="deleteFile('${file.id}')">
            <i data-feather="trash-2"></i>
            Delete
          </button>
        </div>
      `;
      fileList.appendChild(fileElement);
    });
    feather.replace();
  }

  // Decryption helper functions
  function showDecryptProgress(message, percentage = 0) {
    if (decryptProgressContainer) {
      decryptProgressContainer.style.display = 'block';
      decryptProgressBar.style.width = `${percentage}%`;
      decryptStatus.textContent = message;
    }
  }

  function hideDecryptProgress() {
    if (decryptProgressContainer) {
      setTimeout(() => {
        decryptProgressContainer.style.display = 'none';
      }, 1500);
    }
  }

  function showDecryptSuccess(message) {
    if (decryptSuccess) {
      const successMessage = decryptSuccess.querySelector('span:last-child');
      if (successMessage) {
        successMessage.textContent = message;
      }
      decryptSuccess.style.display = 'flex';
      feather.replace();
      setTimeout(() => {
        decryptSuccess.style.display = 'none';
      }, 4000);
    }
  }

  function showDecryptError(message) {
    if (decryptError) {
      const errorMessage = decryptError.querySelector('span:last-child');
      if (errorMessage) {
        errorMessage.textContent = message;
      }
      decryptError.style.display = 'flex';
      feather.replace();
      setTimeout(() => {
        decryptError.style.display = 'none';
      }, 6000);
    }
  }

  async function handleDecryptFile(filePath) {
    try {
      showDecryptProgress('Analyzing file...', 10);
      
      // Check if file exists and get info
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
      
      showDecryptProgress('Decrypting file...', 30);
      
      const result = await window.api.decryptFileFromPath(filePath);
      
      if (result && result.success) {
        // Add to decrypt history
        addToDecryptHistory({
          originalFile: fileName,
          decryptedPath: result.path,
          timestamp: new Date().toISOString()
        });
        
        const sizeInfo = result.originalSize && result.decryptedSize ? 
          ` (${(result.originalSize / 1024).toFixed(1)}KB → ${(result.decryptedSize / 1024).toFixed(1)}KB)` : '';
        
        showDecryptSuccess(`🔓 File decrypted successfully! Saved to: ${result.path}${sizeInfo}`);
        updateDecryptHistory();
      } else {
        throw new Error((result && result.error) || 'Failed to decrypt file');
      }
    } catch (err) {
      showDecryptError(`Decryption failed: ${err.message || 'Unknown error'}`);
      console.error('Decryption error:', err);
    } finally {
      hideDecryptProgress();
    }
  }

  async function handleDecryptDroppedFile(file) {
    try {
      showDecryptProgress('Reading dropped file...', 5);
      
      // Check file size
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }
      
      showDecryptProgress('Processing file...', 20);
      
      // Read file data
      const reader = new FileReader();
      const fileData = await new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Error reading file'));
        reader.readAsArrayBuffer(file);
      });
      
      const fileInfo = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: Array.from(new Uint8Array(fileData))
      };
      
      showDecryptProgress('Saving temporary file...', 40);
      
      // Save to temp location
      const tempPath = await window.api.saveDroppedFile(fileInfo);
      if (tempPath) {
        // Decrypt the temp file
        await handleDecryptFile(tempPath);
      } else {
        throw new Error('Could not save the dropped file temporarily');
      }
    } catch (err) {
      showDecryptError(`Error processing dropped file: ${err.message || 'Unknown error'}`);
      hideDecryptProgress();
    }
  }

  function addToDecryptHistory(decryptInfo) {
    try {
      let history = JSON.parse(localStorage.getItem('decryptHistory') || '[]');
      history.unshift(decryptInfo); // Add to beginning
      
      // Keep only last 10 decryptions
      if (history.length > 10) {
        history = history.slice(0, 10);
      }
      
      localStorage.setItem('decryptHistory', JSON.stringify(history));
    } catch (err) {
      console.error('Error saving decrypt history:', err);
    }
  }

  function updateDecryptHistory() {
    if (!decryptHistoryList || !recentDecryptionsCard) return;
    
    try {
      const history = JSON.parse(localStorage.getItem('decryptHistory') || '[]');
      
      if (history.length === 0) {
        recentDecryptionsCard.style.display = 'none';
        return;
      }
      
      recentDecryptionsCard.style.display = 'block';
      decryptHistoryList.innerHTML = '';
      
      history.forEach((item, index) => {
        const timestamp = new Date(item.timestamp);
        const timeString = timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const historyItem = document.createElement('div');
        historyItem.className = 'file-item';
        historyItem.innerHTML = `
          <div class="file-info">
            <div class="file-icon">DEC</div>
            <div class="file-details">
              <div class="file-name">${item.originalFile}</div>
              <div class="file-meta">
                <i data-feather="unlock" style="width: 14px; height: 14px; margin-right: 4px;"></i>
                Decrypted on ${timeString}
              </div>
            </div>
          </div>
          <div class="file-actions">
            <button class="btn secondary" onclick="openDecryptedFile('${item.decryptedPath}')">
              <i data-feather="external-link"></i>
              Open Location
            </button>
            <button class="btn danger" onclick="removeFromDecryptHistory(${index})">
              <i data-feather="x"></i>
              Remove
            </button>
          </div>
        `;
        decryptHistoryList.appendChild(historyItem);
      });
      
      feather.replace();
    } catch (err) {
      console.error('Error updating decrypt history:', err);
    }
  }

  function clearDecryptionHistory() {
    localStorage.removeItem('decryptHistory');
    updateDecryptHistory();
    showDecryptSuccess('🗑️ Decryption history cleared!');
  }

  // Enhanced file processing
  async function handleSelectedFile(filePath) {
    try {
      showProgress('Preparing file for encryption...', 0);
      
      const result = await window.api.encryptFile(filePath);
      
      if (result && result.success) {
        const fileInfo = {
          id: result.fileId,
          name: result.fileName,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem(`file-${result.fileId}`, JSON.stringify(fileInfo));
        
        updateFileList();
        showSuccess(`🔐 File encrypted successfully! Original: ${(result.originalSize / 1024).toFixed(1)}KB → Encrypted: ${(result.encryptedSize / 1024).toFixed(1)}KB`);
        
        // Auto-upload if enabled
        if (autoUploadEnabled) {
          await handleAutoUpload(result.fileId, result.fileName);
        }
      } else {
        throw new Error(result ? result.error : 'Unknown error during encryption');
      }
    } catch (err) {
      showError(`Encryption failed: ${err.message || 'Unknown error'}`);
    } finally {
      hideProgress();
    }
  }

  async function handleDroppedFile(file) {
    try {
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }
      
      showProgress('Reading dropped file...', 10);
      
      const reader = new FileReader();
      const fileData = await new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Error reading file'));
        reader.readAsArrayBuffer(file);
      });
      
      const fileInfo = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: Array.from(new Uint8Array(fileData))
      };
      
      showProgress('Processing file...', 30);
      
      const tempPath = await window.api.saveDroppedFile(fileInfo);
      if (tempPath) {
        await handleSelectedFile(tempPath);
      } else {
        throw new Error('Could not save the dropped file temporarily');
      }
    } catch (err) {
      showError(`Error processing dropped file: ${err.message || 'Unknown error'}`);
      hideProgress();
    }
  }

  // Global functions for file operations
  window.downloadFile = async function(fileId, fileName) {
    try {
      showProgress('Downloading and decrypting file...', 0);
      
      const result = await window.api.downloadFile(fileId, fileName);
      
      if (result.success) {
        showSuccess('📥 File downloaded and decrypted successfully!');
      } else {
        throw new Error(result.error || 'Unknown error during download');
      }
    } catch (err) {
      showError(`Download failed: ${err.message || 'Unknown error'}`);
    } finally {
      hideProgress();
    }
  };

  window.deleteFile = async function(fileId) {
    const confirmed = await showConfirmDialog(
      '🗑️ Delete File?',
      'Are you sure you want to delete this encrypted file? This action cannot be undone.',
      'Delete File',
      'Cancel'
    );
    
    if (confirmed) {
      try {
        localStorage.removeItem(`file-${fileId}`);
        await window.api.deleteFile(fileId);
        
        showSuccess('🗑️ File deleted successfully!');
        updateFileList();
      } catch (err) {
        showError(`Delete failed: ${err.message || 'Unknown error'}`);
      }
    }
  };

  window.downloadEncryptedFile = async function(fileId, fileName) {
    try {
      showProgress('Downloading encrypted file...', 0);
      
      const result = await window.api.downloadEncryptedFile(fileId, fileName);
      
      if (result.success) {
        showSuccess('🔒 Encrypted file downloaded successfully!');
      } else {
        throw new Error(result.error || 'Unknown error during download');
      }
    } catch (err) {
      showError(`Download failed: ${err.message || 'Unknown error'}`);
    } finally {
      hideProgress();
    }
  };

  // Event listeners from main process
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

  // Global functions for decrypt history
  window.openDecryptedFile = async function(filePath) {
    try {
      // This would need to be implemented in the main process
      await window.api.openFileLocation(filePath);
    } catch (err) {
      showDecryptError(`Could not open file location: ${err.message}`);
    }
  };

  window.removeFromDecryptHistory = function(index) {
    try {
      let history = JSON.parse(localStorage.getItem('decryptHistory') || '[]');
      history.splice(index, 1);
      localStorage.setItem('decryptHistory', JSON.stringify(history));
      updateDecryptHistory();
      showDecryptSuccess('🗑️ Item removed from history!');
    } catch (err) {
      showDecryptError(`Error removing from history: ${err.message}`);
    }
  };

  // Google Drive Integration Functions
  
  async function checkGoogleDriveConnection() {
    try {
      // First check if credentials are available in environment
      const envCheck = await window.api.googleDriveCheckEnvCredentials();
      if (envCheck.success && envCheck.hasCredentials) {
        // Hide manual credential input form
        const credentialsForm = document.querySelector('.google-credentials-form');
        if (credentialsForm) {
          credentialsForm.style.display = 'none';
        }
        
        // Show auto-connect message
        const setupInstructions = googleDriveNotConnected.querySelector('div[style*="margin: 2rem 0"]');
        if (setupInstructions) {
          setupInstructions.innerHTML = `
            <div class="alert success" style="margin: 1rem 0;">
              <i data-feather="check-circle"></i>
              <div>
                <strong>Credentials Configured:</strong> Google Drive credentials are already configured in your environment. 
                Click the button below to connect automatically.
              </div>
            </div>
          `;
          feather.replace();
        }
        
        // Update connect button text
        if (connectGoogleDriveBtn) {
          connectGoogleDriveBtn.innerHTML = '<i data-feather="cloud"></i> Connect to Google Drive (Auto)';
          feather.replace();
        }
        if (connectGoogleDriveAutoBtn) {
          connectGoogleDriveAutoBtn.innerHTML = '<i data-feather="cloud"></i> Connect to Google Drive (Auto)';
          feather.replace();
        }
        
        // Try to auto-initialize
        const initResult = await window.api.googleDriveInit();
        if (initResult.success && initResult.authenticated) {
          showGoogleDriveConnected();
          await updateGoogleDriveUserInfo();
          await updateGoogleDriveFilesList();
          return;
        }
      }
      
      // Check if already connected
      const result = await window.api.googleDriveIsConnected();
      if (result.success && result.connected) {
        showGoogleDriveConnected();
        await updateGoogleDriveUserInfo();
        await updateGoogleDriveFilesList();
      } else {
        showGoogleDriveNotConnected();
      }
    } catch (err) {
      console.error('Error checking Google Drive connection:', err);
      showGoogleDriveNotConnected();
    }
  }

  function showGoogleDriveConnected() {
    googleDriveNotConnected.style.display = 'none';
    googleDriveConnected.style.display = 'block';
    googleDriveManager.style.display = 'block';
    
    googleDriveConnectionStatus.innerHTML = '<i data-feather="cloud"></i> Connected';
    googleDriveConnectionStatus.classList.add('connected');
    
    // Load auto-upload setting
    autoUploadEnabled = localStorage.getItem('autoUploadEnabled') === 'true';
    if (autoUploadToggle) {
      autoUploadToggle.checked = autoUploadEnabled;
    }
    
    feather.replace();
  }

  function showGoogleDriveNotConnected() {
    googleDriveNotConnected.style.display = 'block';
    googleDriveConnected.style.display = 'none';
    googleDriveManager.style.display = 'none';
    
    googleDriveConnectionStatus.innerHTML = '<i data-feather="cloud-off"></i> Not Connected';
    googleDriveConnectionStatus.classList.remove('connected');
    feather.replace();
  }

  async function updateGoogleDriveUserInfo() {
    try {
      const result = await window.api.googleDriveGetUserInfo();
      if (result.success) {
        const { user, storage } = result;
        const usedGB = (storage.usage / (1024 ** 3)).toFixed(2);
        const totalGB = (storage.limit / (1024 ** 3)).toFixed(0);
        const usagePercent = ((storage.usage / storage.limit) * 100).toFixed(1);
        
        googleDriveUserInfo.innerHTML = `
          <img src="${user.photoLink || ''}" alt="${user.displayName}" 
               style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;"
               onerror="this.style.display='none'">
          <div class="user-details">
            <h4>${user.displayName}</h4>
            <p>${user.emailAddress}</p>
          </div>
        `;
        
        // Update storage usage bar
        updateStorageUsage(storage.usage, storage.limit);
      }
    } catch (err) {
      console.error('Error updating Google Drive user info:', err);
    }
  }
  
  function updateStorageUsage(used, total) {
    const usedGB = (used / (1024 ** 3)).toFixed(1);
    const totalGB = (total / (1024 ** 3)).toFixed(0);
    const usagePercent = ((used / total) * 100).toFixed(1);
    
    const storageUsed = document.getElementById('storageUsed');
    const storageUsedText = document.getElementById('storageUsedText');
    const storageTotalText = document.getElementById('storageTotalText');
    
    if (storageUsed) storageUsed.style.width = `${usagePercent}%`;
    if (storageUsedText) storageUsedText.textContent = `${usedGB} GB`;
    if (storageTotalText) storageTotalText.textContent = `${totalGB} GB`;
  }

  async function updateGoogleDriveFilesList() {
    try {
      const result = await window.api.googleDriveListFiles();
      if (result.success) {
        const files = result.files || [];
        const localFiles = getLocalFiles();
        driveFilesList = files;
        
        if (files.length === 0) {
          driveFiles.innerHTML = `
            <div class="empty-vault">
              <div class="empty-vault-icon">
                <i data-feather="shield"></i>
              </div>
              <h3>Your Encrypted Vault is Empty</h3>
              <p>Upload files to start building your secure cloud vault</p>
              <button class="btn" id="uploadFirstFile">
                <i data-feather="upload"></i>
                Upload Your First File
              </button>
            </div>
          `;
          
          // Re-attach event listener
          const uploadFirstFileBtn = document.getElementById('uploadFirstFile');
          if (uploadFirstFileBtn) {
            uploadFirstFileBtn.addEventListener('click', () => {
              uploadToDriveBtn.click();
            });
          }
          
          feather.replace();
          return;
        }

        renderDriveFiles(files, localFiles);
        updateSyncStatus(files, localFiles);
      }
    } catch (err) {
      console.error('Error updating Google Drive files list:', err);
      showGoogleDriveError(`Failed to load Google Drive files: ${err.message}`);
    }
  }
  
  function renderDriveFiles(files, localFiles) {
    const isGridView = currentViewMode === 'grid';
    const containerClass = isGridView ? 'file-grid' : 'file-list';
    
    driveFiles.innerHTML = `<div class="${containerClass}" id="filesContainer"></div>`;
    const container = document.getElementById('filesContainer');
    
    files.forEach(file => {
      const isLocalFile = localFiles.some(local => local.id === file.fileId);
      const syncStatus = isLocalFile ? 'synced' : 'cloud-only';
      const syncLabel = isLocalFile ? 'Synced' : 'Cloud Only';
      const syncIcon = isLocalFile ? 'check-circle' : 'cloud';
      
      const createdDate = new Date(file.createdTime).toLocaleDateString();
      const fileSize = (file.size / 1024).toFixed(1);
      const fileExtension = getFileExtension(file.originalName);
      const fileIcon = getFileIcon(fileExtension);
      
      if (isGridView) {
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        fileCard.innerHTML = `
          <div class="file-card-actions">
            ${!isLocalFile ? `<button class="btn success" onclick="downloadFromGoogleDrive('${file.driveFileId}', '${file.originalName}', '${file.fileId}')" title="Download to Local">
              <i data-feather="download"></i>
            </button>` : ''}
            <button class="btn danger" onclick="deleteFromGoogleDrive('${file.driveFileId}')" title="Delete from Drive">
              <i data-feather="trash-2"></i>
            </button>
          </div>
          <div class="file-card-icon">
            <i data-feather="${fileIcon}"></i>
          </div>
          <div class="file-card-name" title="${file.originalName}">${file.originalName}</div>
          <div class="file-card-meta">
            <span>${fileSize} KB • ${createdDate}</span>
            <span class="sync-indicator ${syncStatus}">
              <i data-feather="${syncIcon}"></i>
              ${syncLabel}
            </span>
          </div>
        `;
        container.appendChild(fileCard);
      } else {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-list-item';
        fileItem.innerHTML = `
          <div class="file-list-icon">
            <i data-feather="${fileIcon}"></i>
          </div>
          <div class="file-list-details">
            <div class="file-list-name">${file.originalName}</div>
            <div class="file-list-meta">
              ${fileSize} KB • Uploaded ${createdDate} • 
              <span class="sync-indicator ${syncStatus}">
                <i data-feather="${syncIcon}"></i>
                ${syncLabel}
              </span>
            </div>
          </div>
          <div class="file-list-actions">
            ${!isLocalFile ? `<button class="btn success" onclick="downloadFromGoogleDrive('${file.driveFileId}', '${file.originalName}', '${file.fileId}')">
              <i data-feather="download"></i>
              Download
            </button>` : ''}
            <button class="btn danger" onclick="deleteFromGoogleDrive('${file.driveFileId}')">
              <i data-feather="trash-2"></i>
              Delete
            </button>
          </div>
        `;
        container.appendChild(fileItem);
      }
    });
    
    feather.replace();
  }
  
  function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
  }
  
  function getFileIcon(extension) {
    const iconMap = {
      // Images
      'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'bmp': 'image', 'webp': 'image', 'svg': 'image',
      // Documents
      'pdf': 'file-text', 'doc': 'file-text', 'docx': 'file-text', 'txt': 'file-text', 'rtf': 'file-text',
      // Spreadsheets
      'xls': 'file-text', 'xlsx': 'file-text', 'csv': 'file-text',
      // Presentations
      'ppt': 'file-text', 'pptx': 'file-text',
      // Archives
      'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'tar': 'archive', 'gz': 'archive',
      // Audio
      'mp3': 'music', 'wav': 'music', 'flac': 'music', 'aac': 'music', 'm4a': 'music',
      // Video
      'mp4': 'video', 'avi': 'video', 'mov': 'video', 'mkv': 'video', 'webm': 'video',
      // Code
      'js': 'code', 'html': 'code', 'css': 'code', 'py': 'code', 'java': 'code', 'cpp': 'code', 'c': 'code'
    };
    
    return iconMap[extension] || 'file';
  }
  
  function updateSyncStatus(driveFiles, localFiles) {
    const syncedCount = driveFiles.filter(driveFile => 
      localFiles.some(localFile => localFile.id === driveFile.fileId)
    ).length;
    
    const localOnlyCount = localFiles.filter(localFile =>
      !driveFiles.some(driveFile => driveFile.fileId === localFile.id)
    ).length;
    
    const syncStatusText = document.getElementById('syncStatusText');
    if (syncStatusText) {
      if (localOnlyCount === 0 && driveFiles.length === localFiles.length) {
        syncStatusText.textContent = 'All files synced';
      } else if (localOnlyCount > 0) {
        syncStatusText.textContent = `${localOnlyCount} local files need upload`;
      } else {
        syncStatusText.textContent = `${syncedCount}/${driveFiles.length + localOnlyCount} files synced`;
      }
    }
  }

  function getLocalFiles() {
    return Object.keys(localStorage)
      .filter(key => key.startsWith('file-'))
      .map(key => JSON.parse(localStorage.getItem(key)));
  }

  function showGoogleDriveProgress(message, percentage = 0) {
    googleDriveProgressContainer.style.display = 'block';
    googleDriveProgressBar.style.width = `${percentage}%`;
    googleDriveStatus.textContent = message;
  }

  function hideGoogleDriveProgress() {
    setTimeout(() => {
      googleDriveProgressContainer.style.display = 'none';
    }, 1500);
  }

  function showGoogleDriveSuccess(message) {
    const successMessage = googleDriveSuccess.querySelector('span:last-child');
    if (successMessage) {
      successMessage.textContent = message;
    }
    googleDriveSuccess.style.display = 'flex';
    feather.replace();
    setTimeout(() => {
      googleDriveSuccess.style.display = 'none';
    }, 4000);
  }

  function showGoogleDriveError(message) {
    const errorMessage = googleDriveError.querySelector('span:last-child');
    if (errorMessage) {
      errorMessage.textContent = message;
    }
    googleDriveError.style.display = 'flex';
    feather.replace();
    setTimeout(() => {
      googleDriveError.style.display = 'none';
    }, 6000);
  }

  // Auto-upload functionality
  async function handleAutoUpload(fileId, fileName) {
    if (!autoUploadEnabled || !window.api.googleDriveIsConnected) {
      return;
    }
    
    try {
      syncQueue.push({ fileId, fileName, status: 'pending' });
      updateSyncQueueDisplay();
      
      const result = await window.api.googleDriveUpload(fileId, fileName);
      
      if (result.success) {
        syncQueue = syncQueue.filter(item => item.fileId !== fileId);
        showGoogleDriveSuccess(`📤 ${fileName} auto-uploaded to vault!`);
        await updateGoogleDriveFilesList();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      syncQueue = syncQueue.filter(item => item.fileId !== fileId);
      console.error('Auto-upload failed:', err);
      showGoogleDriveError(`Auto-upload failed for ${fileName}: ${err.message}`);
    }
    
    updateSyncQueueDisplay();
  }
  
  function updateSyncQueueDisplay() {
    const syncStatusText = document.getElementById('syncStatusText');
    if (syncStatusText && syncQueue.length > 0) {
      syncStatusText.textContent = `Uploading ${syncQueue.length} file(s)...`;
    }
  }

  // Google Drive Event Listeners
  
  // Auto-upload toggle
  if (autoUploadToggle) {
    autoUploadToggle.addEventListener('change', (e) => {
      autoUploadEnabled = e.target.checked;
      localStorage.setItem('autoUploadEnabled', autoUploadEnabled.toString());
      
      if (autoUploadEnabled) {
        showGoogleDriveSuccess('✅ Auto-upload enabled! New files will be automatically uploaded to your vault.');
      } else {
        showGoogleDriveSuccess('⏸️ Auto-upload disabled.');
      }
    });
  }
  
  // View toggle buttons
  if (gridViewBtn && listViewBtn) {
    gridViewBtn.addEventListener('click', () => {
      currentViewMode = 'grid';
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
      if (driveFilesList.length > 0) {
        renderDriveFiles(driveFilesList, getLocalFiles());
      }
    });
    
    listViewBtn.addEventListener('click', () => {
      currentViewMode = 'list';
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
      if (driveFilesList.length > 0) {
        renderDriveFiles(driveFilesList, getLocalFiles());
      }
    });
  }
  
  // Drive toolbar buttons
  if (uploadToDriveBtn) {
    uploadToDriveBtn.addEventListener('click', async () => {
      const filePath = await window.api.openFileDialog();
      if (filePath) {
        try {
          showGoogleDriveProgress('Encrypting and uploading file...', 0);
          
          // First encrypt the file
          const encryptResult = await window.api.encryptFile(filePath);
          if (encryptResult && encryptResult.success) {
            // Add to local storage
            const fileInfo = {
              id: encryptResult.fileId,
              name: encryptResult.fileName,
              timestamp: new Date().toISOString()
            };
            localStorage.setItem(`file-${encryptResult.fileId}`, JSON.stringify(fileInfo));
            
            // Upload to Drive
            const uploadResult = await window.api.googleDriveUpload(encryptResult.fileId, encryptResult.fileName);
            if (uploadResult.success) {
              await updateGoogleDriveFilesList();
              showGoogleDriveSuccess(`🔐 ${encryptResult.fileName} encrypted and uploaded to vault!`);
            } else {
              throw new Error(uploadResult.error);
            }
          } else {
            throw new Error(encryptResult ? encryptResult.error : 'Encryption failed');
          }
        } catch (err) {
          showGoogleDriveError(`Upload failed: ${err.message}`);
        } finally {
          hideGoogleDriveProgress();
        }
      }
    });
  }
  
  if (refreshDriveBtn) {
    refreshDriveBtn.addEventListener('click', async () => {
      refreshDriveBtn.disabled = true;
      refreshDriveBtn.innerHTML = '<i data-feather="loader"></i>';
      feather.replace();
      
      await updateGoogleDriveFilesList();
      
      setTimeout(() => {
        refreshDriveBtn.disabled = false;
        refreshDriveBtn.innerHTML = '<i data-feather="refresh-cw"></i>';
        feather.replace();
        showGoogleDriveSuccess('📁 Vault refreshed!');
      }, 1000);
    });
  }
  
  // Quick action buttons
  if (uploadLocalFilesBtn) {
    uploadLocalFilesBtn.addEventListener('click', async () => {
      try {
        const localFiles = getLocalFiles();
        if (localFiles.length === 0) {
          showGoogleDriveError('No local files to upload');
          return;
        }

        showGoogleDriveProgress('Preparing to upload files...', 0);
        
        for (let i = 0; i < localFiles.length; i++) {
          const file = localFiles[i];
          const progress = Math.round(((i + 1) / localFiles.length) * 100);
          
          showGoogleDriveProgress(`Uploading ${file.name}...`, progress);
          
          const result = await window.api.googleDriveUpload(file.id, file.name);
          if (!result.success) {
            throw new Error(`Failed to upload ${file.name}: ${result.error}`);
          }
        }

        hideGoogleDriveProgress();
        await updateGoogleDriveFilesList();
        showGoogleDriveSuccess(`📤 Successfully uploaded ${localFiles.length} file(s) to your vault!`);
      } catch (err) {
        hideGoogleDriveProgress();
        showGoogleDriveError(`Upload failed: ${err.message}`);
      }
    });
  }
  
  if (downloadAllFilesBtn) {
    downloadAllFilesBtn.addEventListener('click', async () => {
      try {
        const result = await window.api.googleDriveListFiles();
        if (!result.success) {
          throw new Error(result.error);
        }

        const cloudFiles = result.files || [];
        const localFiles = getLocalFiles();
        const filesToDownload = cloudFiles.filter(cloudFile => 
          !localFiles.some(localFile => localFile.id === cloudFile.fileId)
        );

        if (filesToDownload.length === 0) {
          showGoogleDriveError('All vault files are already available locally');
          return;
        }

        showGoogleDriveProgress('Preparing to download files...', 0);
        
        for (let i = 0; i < filesToDownload.length; i++) {
          const file = filesToDownload[i];
          const progress = Math.round(((i + 1) / filesToDownload.length) * 100);
          
          showGoogleDriveProgress(`Downloading ${file.originalName}...`, progress);
          
          const downloadResult = await window.api.googleDriveDownload(file.driveFileId, file.originalName, file.fileId);
          if (!downloadResult.success) {
            throw new Error(`Failed to download ${file.originalName}: ${downloadResult.error}`);
          }

          // Add to local storage
          const fileInfo = {
            id: file.fileId,
            name: file.originalName,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem(`file-${file.fileId}`, JSON.stringify(fileInfo));
        }

        hideGoogleDriveProgress();
        updateFileList();
        await updateGoogleDriveFilesList();
        showGoogleDriveSuccess(`📥 Successfully downloaded ${filesToDownload.length} file(s) from your vault!`);
      } catch (err) {
        hideGoogleDriveProgress();
        showGoogleDriveError(`Download failed: ${err.message}`);
      }
    });
  }

  // Handle both connect buttons (manual and auto)
  async function handleGoogleDriveConnect() {
      try {
        // Disable both buttons
        if (connectGoogleDriveBtn) {
          connectGoogleDriveBtn.disabled = true;
          connectGoogleDriveBtn.innerHTML = '<i data-feather="loader"></i> Connecting...';
        }
        if (connectGoogleDriveAutoBtn) {
          connectGoogleDriveAutoBtn.disabled = true;
          connectGoogleDriveAutoBtn.innerHTML = '<i data-feather="loader"></i> Connecting...';
        }
        feather.replace();

        // Check if we should use environment credentials or manual input
        const envCheck = await window.api.googleDriveCheckEnvCredentials();
        let credentials = null;
        
        if (envCheck.success && envCheck.hasCredentials) {
          // Use environment credentials
          credentials = envCheck.credentials;
        } else {
          // Use manual input
          const clientId = googleClientIdInput?.value?.trim();
          const clientSecret = googleClientSecretInput?.value?.trim();
          
          if (!clientId || !clientSecret) {
            showGoogleDriveError('Please enter both Client ID and Client Secret');
            return;
          }

          credentials = {
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uris: ['http://localhost:3001/oauth2callback']
          };

          // Save credentials to localStorage for future use
          localStorage.setItem('googleCredentials', JSON.stringify(credentials));
        }

        const initResult = await window.api.googleDriveInit(credentials);
        if (!initResult.success) {
          throw new Error(initResult.error);
        }

        if (initResult.authenticated) {
          showGoogleDriveConnected();
          await updateGoogleDriveUserInfo();
          await updateGoogleDriveFilesList();
          showGoogleDriveSuccess('✅ Google Drive connected successfully!');
        } else {
          // Start seamless OAuth flow
          const oauthResult = await window.api.googleDriveStartOAuth();
          
          if (oauthResult.success && oauthResult.code) {
            // Authenticate with the received code
            const authenticateResult = await window.api.googleDriveAuthenticate(oauthResult.code);
            if (authenticateResult.success) {
              showGoogleDriveConnected();
              await updateGoogleDriveUserInfo();
              await updateGoogleDriveFilesList();
              showGoogleDriveSuccess('✅ Google Drive connected successfully!');
            } else {
              throw new Error(authenticateResult.error);
            }
          } else {
            throw new Error(oauthResult.error || 'Authorization failed');
          }
        }
      } catch (err) {
        showGoogleDriveError(`Connection failed: ${err.message}`);
      } finally {
        // Re-enable both buttons
        if (connectGoogleDriveBtn) {
          connectGoogleDriveBtn.disabled = false;
          connectGoogleDriveBtn.innerHTML = '<i data-feather="cloud"></i> Connect to Google Drive';
        }
        if (connectGoogleDriveAutoBtn) {
          connectGoogleDriveAutoBtn.disabled = false;
          connectGoogleDriveAutoBtn.innerHTML = '<i data-feather="cloud"></i> Connect to Google Drive (Auto)';
        }
        feather.replace();
      }
  }

  // Add event listeners for both buttons
  if (connectGoogleDriveBtn) {
    connectGoogleDriveBtn.addEventListener('click', handleGoogleDriveConnect);
  }
  
  if (connectGoogleDriveAutoBtn) {
    connectGoogleDriveAutoBtn.addEventListener('click', handleGoogleDriveConnect);
  }

  // Disconnect functionality
  if (disconnectGoogleDriveBtn) {
    disconnectGoogleDriveBtn.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog(
        '🔌 Disconnect Google Drive?',
        'This will remove your Google Drive connection. Your files will remain in both locations, but automatic sync will stop.',
        'Disconnect',
        'Cancel'
      );
      
      if (confirmed) {
        try {
          await window.api.googleDriveSignOut();
          localStorage.removeItem('googleCredentials');
          showGoogleDriveNotConnected();
          showGoogleDriveSuccess('🔌 Google Drive disconnected successfully!');
        } catch (err) {
          showGoogleDriveError(`Disconnect failed: ${err.message}`);
        }
      }
    });
  }

  if (refreshGoogleDriveFilesBtn) {
    refreshGoogleDriveFilesBtn.addEventListener('click', async () => {
      refreshGoogleDriveFilesBtn.disabled = true;
      refreshGoogleDriveFilesBtn.innerHTML = '<i data-feather="loader"></i> Refreshing...';
      feather.replace();
      
      await updateGoogleDriveFilesList();
      
      setTimeout(() => {
        refreshGoogleDriveFilesBtn.disabled = false;
        refreshGoogleDriveFilesBtn.innerHTML = '<i data-feather="refresh-cw"></i> Refresh Files';
        feather.replace();
        showGoogleDriveSuccess('📁 File list refreshed!');
      }, 1000);
    });
  }

  if (viewGoogleDriveStorageBtn) {
    viewGoogleDriveStorageBtn.addEventListener('click', async () => {
      await updateGoogleDriveUserInfo();
      showGoogleDriveSuccess('📊 Storage information updated!');
    });
  }

  if (disconnectGoogleDriveBtn) {
    disconnectGoogleDriveBtn.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog(
        '🔌 Disconnect Google Drive?',
        'This will remove your Google Drive connection. Your files will remain in both locations, but automatic sync will stop.',
        'Disconnect',
        'Cancel'
      );
      
      if (confirmed) {
        try {
          await window.api.googleDriveSignOut();
          localStorage.removeItem('googleCredentials');
          showGoogleDriveNotConnected();
          showGoogleDriveSuccess('🔌 Google Drive disconnected successfully!');
        } catch (err) {
          showGoogleDriveError(`Disconnect failed: ${err.message}`);
        }
      }
    });
  }

  if (uploadAllToGoogleDriveBtn) {
    uploadAllToGoogleDriveBtn.addEventListener('click', async () => {
      try {
        const localFiles = getLocalFiles();
        if (localFiles.length === 0) {
          showGoogleDriveError('No local files to upload');
          return;
        }

        showGoogleDriveProgress('Preparing to upload files...', 0);
        
        for (let i = 0; i < localFiles.length; i++) {
          const file = localFiles[i];
          const progress = Math.round(((i + 1) / localFiles.length) * 100);
          
          showGoogleDriveProgress(`Uploading ${file.name}...`, progress);
          
          const result = await window.api.googleDriveUpload(file.id, file.name);
          if (!result.success) {
            throw new Error(`Failed to upload ${file.name}: ${result.error}`);
          }
        }

        hideGoogleDriveProgress();
        await updateGoogleDriveFilesList();
        showGoogleDriveSuccess(`📤 Successfully uploaded ${localFiles.length} file(s) to Google Drive!`);
      } catch (err) {
        hideGoogleDriveProgress();
        showGoogleDriveError(`Upload failed: ${err.message}`);
      }
    });
  }

  if (downloadAllFromGoogleDriveBtn) {
    downloadAllFromGoogleDriveBtn.addEventListener('click', async () => {
      try {
        const result = await window.api.googleDriveListFiles();
        if (!result.success) {
          throw new Error(result.error);
        }

        const cloudFiles = result.files || [];
        const localFiles = getLocalFiles();
        const filesToDownload = cloudFiles.filter(cloudFile => 
          !localFiles.some(localFile => localFile.id === cloudFile.fileId)
        );

        if (filesToDownload.length === 0) {
          showGoogleDriveError('All Google Drive files are already available locally');
          return;
        }

        showGoogleDriveProgress('Preparing to download files...', 0);
        
        for (let i = 0; i < filesToDownload.length; i++) {
          const file = filesToDownload[i];
          const progress = Math.round(((i + 1) / filesToDownload.length) * 100);
          
          showGoogleDriveProgress(`Downloading ${file.originalName}...`, progress);
          
          const downloadResult = await window.api.googleDriveDownload(file.driveFileId, file.originalName, file.fileId);
          if (!downloadResult.success) {
            throw new Error(`Failed to download ${file.originalName}: ${downloadResult.error}`);
          }

          // Add to local storage
          const fileInfo = {
            id: file.fileId,
            name: file.originalName,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem(`file-${file.fileId}`, JSON.stringify(fileInfo));
        }

        hideGoogleDriveProgress();
        updateFileList();
        await updateGoogleDriveFilesList();
        showGoogleDriveSuccess(`📥 Successfully downloaded ${filesToDownload.length} file(s) from Google Drive!`);
      } catch (err) {
        hideGoogleDriveProgress();
        showGoogleDriveError(`Download failed: ${err.message}`);
      }
    });
  }

  // Global functions for Google Drive file operations
  window.downloadFromGoogleDrive = async function(driveFileId, fileName, fileId) {
    try {
      showGoogleDriveProgress(`Downloading ${fileName}...`, 0);
      
      const result = await window.api.googleDriveDownload(driveFileId, fileName, fileId);
      
      if (result.success) {
        // Add to local storage
        const fileInfo = {
          id: fileId,
          name: fileName,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem(`file-${fileId}`, JSON.stringify(fileInfo));
        
        updateFileList();
        await updateGoogleDriveFilesList();
        showGoogleDriveSuccess(`📥 ${fileName} downloaded successfully!`);
      } else {
        throw new Error(result.error || 'Unknown error during download');
      }
    } catch (err) {
      showGoogleDriveError(`Download failed: ${err.message || 'Unknown error'}`);
    } finally {
      hideGoogleDriveProgress();
    }
  };

  window.deleteFromGoogleDrive = async function(driveFileId) {
    const confirmed = await showConfirmDialog(
      '🗑️ Delete from Google Drive?',
      'Are you sure you want to delete this file from Google Drive? This action cannot be undone.',
      'Delete File',
      'Cancel'
    );
    
    if (confirmed) {
      try {
        const result = await window.api.googleDriveDelete(driveFileId);
        
        if (result.success) {
          await updateGoogleDriveFilesList();
          showGoogleDriveSuccess('🗑️ File deleted from Google Drive successfully!');
        } else {
          throw new Error(result.error || 'Unknown error during deletion');
        }
      } catch (err) {
        showGoogleDriveError(`Delete failed: ${err.message || 'Unknown error'}`);
      }
    }
  };

  // Add upload to Google Drive buttons to existing file list
  const originalUpdateFileList = updateFileList;
  updateFileList = function() {
    originalUpdateFileList();
    
    // Add Google Drive upload buttons to file items if connected
    checkGoogleDriveConnection().then(() => {
      const fileItems = document.querySelectorAll('.file-item');
      fileItems.forEach(item => {
        const actions = item.querySelector('.file-actions');
        if (actions && googleDriveConnectionStatus.classList.contains('connected')) {
          const fileId = actions.querySelector('button[onclick*="downloadFile"]')?.onclick.toString().match(/'([^']+)'/)?.[1];
          const fileName = actions.querySelector('button[onclick*="downloadFile"]')?.onclick.toString().match(/'([^']+)',\s*'([^']+)'/)?.[2];
          
          if (fileId && fileName) {
            const uploadBtn = document.createElement('button');
            uploadBtn.className = 'btn secondary';
            uploadBtn.innerHTML = '<i data-feather="upload-cloud"></i> Upload to Drive';
            uploadBtn.onclick = () => uploadToGoogleDrive(fileId, fileName);
            actions.appendChild(uploadBtn);
          }
        }
      });
      feather.replace();
    });
  };

  window.uploadToGoogleDrive = async function(fileId, fileName) {
    try {
      showGoogleDriveProgress(`Uploading ${fileName} to Google Drive...`, 0);
      
      const result = await window.api.googleDriveUpload(fileId, fileName);
      
      if (result.success) {
        await updateGoogleDriveFilesList();
        showGoogleDriveSuccess(`📤 ${fileName} uploaded to Google Drive successfully!`);
      } else {
        throw new Error(result.error || 'Unknown error during upload');
      }
    } catch (err) {
      showGoogleDriveError(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      hideGoogleDriveProgress();
    }
  };

  // Listen for Google Drive progress events
  window.api.onGoogleDriveProgress((data) => {
    showGoogleDriveProgress(data.status, data.progress);
  });

  // Load saved credentials on startup
  const savedCredentials = localStorage.getItem('googleCredentials');
  if (savedCredentials && googleClientIdInput && googleClientSecretInput) {
    try {
      const creds = JSON.parse(savedCredentials);
      googleClientIdInput.value = creds.client_id || '';
      googleClientSecretInput.value = creds.client_secret || '';
    } catch (err) {
      console.error('Error loading saved credentials:', err);
    }
  }

});