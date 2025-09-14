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

  let encryptionKey = null;
  let keyVisible = false;
  let isFirstTime = false;

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
});