/**
 * File encryption, decryption, and management functions
 */
import { showToast } from '../utils/toast.js';
import { formatFileSize, getEntropyClass } from '../utils/format.js';
import { showEntropyVisualization } from '../utils/entropyVisualization.js';

/**
 * Encrypts files selected by the user
 * @param {Object} appApi - The electron API for IPC communication
 */
export async function encryptFiles(appApi) {
    console.log('[fileOperations.js] Encrypt button clicked');
    try {
        // Get the selected encryption method
        const encryptionMethodSelect = document.getElementById('encryption-method');
        const method = encryptionMethodSelect ? encryptionMethodSelect.value : 'aes-256-gcm';
        console.log('[fileOperations.js] Using encryption method:', method);
        
        // Show file dialog and get selected files
        const filePaths = await appApi.openFileDialog();
        console.log('[fileOperations.js] Selected files:', filePaths);
        
        if (!filePaths || filePaths.length === 0) {
            console.log('[fileOperations.js] No files selected');
            return;
        }
        
        // Show progress indicator
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = 'Encrypting files...';
        
        // Process files one at a time
        let successCount = 0;
        const totalFiles = filePaths.length;
        
        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            console.log(`[fileOperations.js] Encrypting file ${i+1}/${totalFiles}: ${filePath}`);
            
            // Update progress
            const progress = Math.round((i / totalFiles) * 100);
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `Encrypting file ${i+1} of ${totalFiles} using ${method}...`;
            
            // Important: Pass a single file path, not an array or object
            const result = await appApi.encryptFile(filePath, method);
            console.log(`[fileOperations.js] Encryption result for file ${i+1}:`, result);
            
            if (result && result.success) {
                successCount++;
            } else {
                // Show error for this file but continue with others
                showToast(`Failed to encrypt ${filePath.split('\\').pop()}: ${result?.error || 'Unknown error'}`, 'error');
                
                // If the error is about missing key, ensure warning is shown
                const noKeyWarning = document.getElementById('no-key-warning');
                if (result?.error && result.error.includes('No encryption key available') && noKeyWarning) {
                    noKeyWarning.classList.remove('hidden');
                    // Stop processing more files if there's no key
                    break;
                }
            }
        }
        
        // Hide progress indicator
        if (progressContainer) progressContainer.classList.add('hidden');
        
        // Show final results
        if (successCount > 0) {
            showToast(`Successfully encrypted ${successCount} of ${totalFiles} files using ${method}`, 'success');
            // Refresh file list
            await loadEncryptedFiles(appApi);
        } else {
            showToast('No files were encrypted successfully', 'error');
        }
    } catch (error) {
        console.error('[fileOperations.js] Error encrypting files:', error);
        showToast(`Error encrypting files: ${error.message}`, 'error');
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) progressContainer.classList.add('hidden');
    }
}

/**
 * Decrypts a file with the given ID
 * @param {string} fileId - The ID of the file to decrypt
 * @param {string} password - The password to decrypt the file with
 * @returns {Promise<object>} - Result object with success status and error if any
 */
export async function decryptFile(fileId, password) {
    try {
        if (!fileId) {
            return { success: false, error: 'File ID is required' };
        }
        
        if (!password || typeof password !== 'string' || password.trim() === '') {
            return { success: false, error: 'Valid password is required' };
        }
        
        // Get api from window
        const { appApi } = window;
        if (!appApi || !appApi.decryptFile) {
            showToast('Decryption API not available', 'error');
            return { success: false, error: 'API not available' };
        }
        
        // Show loading toast
        showToast('Decrypting file...', 'info');
        
        // Call the main process to decrypt
        const result = await appApi.decryptFile({ fileId, password });
        
        if (!result || !result.success) {
            const errorMessage = result?.error || 'Unknown error decrypting file';
            showToast(`Failed to decrypt: ${errorMessage}`, 'error');
            return { success: false, error: errorMessage };
        }
        
        // Show success message
        showToast('File decrypted successfully!', 'success');
        
        // Refresh the file list
        await loadFilesList();
        
        return { success: true, decryptedPath: result.decryptedPath };
        
    } catch (error) {
        console.error('Error decrypting file:', error);
        showToast(`Error decrypting file: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Downloads the encrypted version of a file
 * @param {Object} appApi - The electron API for IPC communication
 * @param {string} fileId - ID of the file to download
 */
export async function downloadEncryptedFile(appApi, fileId) {
    if (!appApi) {
        // Try to get API from window
        if (window.api) {
            appApi = window.api;
            console.log('[fileOperations.js] Using window.api for download');
        } else if (window.electronAPI) {
            appApi = window.electronAPI;
            console.log('[fileOperations.js] Using window.electronAPI for download');
        } else {
            console.error('[fileOperations.js] No API available for download');
            showToast('Download API not available', 'error');
            return;
        }
    }
    
    if (!appApi.downloadEncryptedFile) {
        showToast('Download API not available', 'error');
        return;
    }
    
    try {
        // Show progress
        const progressContainer = document.getElementById('progress-container');
        const progressText = document.getElementById('progress-text');
        
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (progressText) progressText.textContent = 'Preparing download...';
        
        // Register download progress event listener
        let progressListener = null;
        if (appApi.onDownloadProgress) {
            progressListener = appApi.onDownloadProgress((data) => {
                console.log('Download progress:', data);
                if (progressText) progressText.textContent = data.status || 'Downloading...';
                
                const progressBar = document.getElementById('progress-bar');
                if (progressBar && typeof data.progress === 'number') {
                    progressBar.style.width = `${data.progress}%`;
                }
            });
        }
        
        // Call the download function
        const result = await appApi.downloadEncryptedFile(fileId, getFileNameFromId(fileId));
        
        // Remove progress listener
        if (progressListener && typeof progressListener === 'function') {
            progressListener();
        }
        
        // Hide progress
        if (progressContainer) {
            setTimeout(() => {
                progressContainer.classList.add('hidden');
            }, 1000);
        }
        
        if (result && result.success) {
            showToast(`File downloaded successfully`, 'success');
        } else {
            showToast(`Failed to download file: ${result?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('[fileOperations.js] Error downloading encrypted file:', error);
        showToast(`Download error: ${error.message}`, 'error');
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) progressContainer.classList.add('hidden');
    }
}

/**
 * Extracts a file name from a file ID
 * @param {string} fileId - The file ID 
 * @returns {string} - The extracted file name
 */
function getFileNameFromId(fileId) {
    // Extract filename from ID format like "12345_filename.ext"
    if (!fileId) return 'file';
    
    // Try to extract name from ID
    const parts = fileId.split('_');
    if (parts.length > 1) {
        return parts.slice(1).join('_'); // Return everything after the first underscore
    }
    
    return fileId;
}

/**
 * Deletes an encrypted file
 * @param {Object} appApi - The electron API for IPC communication
 * @param {string} fileId - ID of the file to delete
 */
export async function deleteEncryptedFile(appApi, fileId) {
    if (!appApi || !appApi.deleteEncryptedFile) {
        showToast('Delete API not available', 'error');
        return;
    }
    
    try {
        const result = await appApi.deleteEncryptedFile(fileId);
        
        if (result && result.success) {
            showToast('File deleted successfully', 'success');
            
            // Remove file card from UI
            const fileCard = document.querySelector(`.file-card[data-file-id="${fileId}"]`);
            if (fileCard) {
                fileCard.remove();
            }
            
            // Refresh file list
            await loadEncryptedFiles(appApi);
        } else {
            showToast(`Failed to delete file: ${result?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('[fileOperations.js] Error deleting file:', error);
        showToast(`Delete error: ${error.message}`, 'error');
    }
}

/**
 * Loads and displays the list of encrypted files
 * @param {Object} appApi - The electron API for IPC communication
 */
export async function loadEncryptedFiles(appApi) {
    try {
        console.log('[fileOperations.js] Loading encrypted files');
        
        // If no API was passed, try to get it from window
        if (!appApi) {
            if (window.api) {
                appApi = window.api;
                console.log('[fileOperations.js] Using window.api');
            } else if (window.electronAPI) {
                appApi = window.electronAPI;
                console.log('[fileOperations.js] Using window.electronAPI');
            } else {
                console.error('[fileOperations.js] No API available');
                showToast('API not available', 'error');
                return;
            }
        }
        
        // Get file list and empty elements
        let fileList = document.getElementById('encrypted-files-list');
        let emptyState = document.getElementById('encrypted-files-empty');
        
        // If neither element exists, create them
        if (!fileList || !emptyState) {
            console.warn('[fileOperations.js] Some file list elements not found, attempting to fix them');
            
            // Try to find the parent container
            const fileListContainer = document.querySelector('.card') || 
                                     document.querySelector('.file-list-section');
            
            if (fileListContainer) {
                // Create elements if they don't exist
                if (!emptyState) {
                    const newEmptyState = document.createElement('div');
                    newEmptyState.id = 'encrypted-files-empty';
                    newEmptyState.className = 'file-list-empty';
                    newEmptyState.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="empty-icon">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="9" y1="15" x2="15" y2="15"></line>
                        </svg>
                        <p>No encrypted files yet</p>
                        <p style="font-size: 0.8rem; margin-top: 0.5rem;">Files you encrypt will appear here. Drag and drop files above to get started.</p>
                    `;
                    
                    fileListContainer.appendChild(newEmptyState);
                    emptyState = newEmptyState;
                }
                
                if (!fileList) {
                    const newFileList = document.createElement('div');
                    newFileList.id = 'encrypted-files-list';
                    newFileList.className = 'file-list';
                    newFileList.style.display = 'none';
                    
                    fileListContainer.appendChild(newFileList);
                    fileList = newFileList;
                }
            } else {
                console.error('[fileOperations.js] Could not find container for file list elements');
                return;
            }
        }
        
        // Get files from the main process
        const filesResult = await appApi.getEncryptedFiles();
        console.log('[fileOperations.js] Encrypted files loaded:', filesResult);
        
        let files = filesResult;
        // Handle both array responses and { success: true, files: [...] } format
        if (filesResult && typeof filesResult === 'object' && filesResult.success === true && Array.isArray(filesResult.files)) {
            files = filesResult.files;
        }
        
        // Clear existing file list
        if (fileList) fileList.innerHTML = '';
        console.log('[fileOperations.js] Cleared file list, adding files:', files ? files.length : 0);
        
        // Show empty state or file list based on file count
        if (!files || files.length === 0) {
            if (fileList) fileList.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        // We have files, show the list and hide empty state
        if (fileList) fileList.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        
        // Add files to the list
        files.forEach(file => {
            const fileName = file.name || `${file.id}${file.extension || ''}`;
            const fileSize = formatFileSize(file.size);
            const dateCreated = new Date(file.created).toLocaleString();

            // Normalize entropy: Shannon entropy (0-8) to a 0-1 scale for UI
            // Default to a normalized value of 0.7 (equivalent to Shannon entropy of 5.6)
            const shannonEntropy = file.entropy; // This is on a 0-8 scale
            const normalizedEntropy = (shannonEntropy !== null && shannonEntropy !== undefined)
                ? Math.min(Math.max(shannonEntropy / 8, 0), 1) // Ensure it's clamped between 0 and 1
                : 0.7; // Default normalized entropy
            
            const displayPercentage = Math.round(normalizedEntropy * 100);
            const entropyClass = getEntropyClass(normalizedEntropy); // Pass normalized value
            
            // Create a card for each file
            const fileCard = document.createElement('div');
            fileCard.className = 'file-card';
            fileCard.dataset.fileId = file.id;
            fileCard.innerHTML = `
                <div class="file-info">
                    <div class="file-name" title="${fileName}">${fileName}</div>
                    <div class="file-meta">
                        <span class="file-size">${fileSize}</span> · 
                        <span class="file-date">${dateCreated}</span>
                        ${file.algorithm ? `· <span class="file-algorithm">${formatAlgorithm(file.algorithm)}</span>` : ''}
                    </div>
                    <div class="file-entropy">
                        <div class="entropy-bar ${entropyClass}" title="Encryption quality: ${displayPercentage}%">
                            <div class="entropy-fill" style="width: ${displayPercentage}%"></div>
                        </div>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="decrypt-button bg-white/10 hover:bg-green-500/20 text-white/80 hover:text-green-500 p-1.5 rounded transition-colors" title="Decrypt file">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <button class="download-encrypted-button bg-white/10 hover:bg-blue-500/20 text-white/80 hover:text-blue-500 p-1.5 rounded transition-colors" title="Download encrypted file">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <button class="entropy-button bg-white/10 hover:bg-purple-500/20 text-white/80 hover:text-purple-500 p-1.5 rounded transition-colors" title="View encryption quality details">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                    <button class="delete-button bg-white/10 hover:bg-red-500/20 text-white/80 hover:text-red-500 p-1.5 rounded transition-colors" title="Delete file">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            `;
            
            fileList.appendChild(fileCard);
            
            // Add event listeners to buttons directly
            const decryptBtn = fileCard.querySelector('.decrypt-button');
            if (decryptBtn) {
                decryptBtn.addEventListener('click', () => {
                    console.log(`[fileOperations.js] Decrypt button clicked for file ID: ${file.id}`);
                    // Prompt user for password
                    const password = prompt('Enter decryption password:');
                    if (password) {
                        decryptFile(file.id, password);
                    } else {
                        showToast('Decryption cancelled - password required', 'warning');
                    }
                });
            }
            
            const downloadBtn = fileCard.querySelector('.download-encrypted-button');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    console.log(`[fileOperations.js] Download button clicked for file ID: ${file.id}`);
                    downloadEncryptedFile(appApi, file.id);
                });
            }
            
            const deleteBtn = fileCard.querySelector('.delete-button');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    console.log(`[fileOperations.js] Delete button clicked for file ID: ${file.id}`);
                    if (confirm(`Are you sure you want to delete ${fileName}?`)) {
                        deleteEncryptedFile(appApi, file.id);
                    }
                });
            }
            
            // Add event listener for entropy button
            const entropyButton = fileCard.querySelector('.entropy-button');
            if (entropyButton) {
                entropyButton.addEventListener('click', () => {
                    showEntropyAnalysis(appApi, file);
                });
            }
            
            // Also make the entropy bar clickable
            const entropyBar = fileCard.querySelector('.entropy-bar');
            if (entropyBar) {
                entropyBar.style.cursor = 'pointer';
                entropyBar.addEventListener('click', () => {
                    showEntropyAnalysis(appApi, file);
                });
            }
        });
        
        console.log('[fileOperations.js] File list rendering complete');
    } catch (error) {
        console.error('[fileOperations.js] Error loading encrypted files:', error);
        showToast('Error loading files', 'error');
    }
}

/**
 * Downloads a blob as a file
 * @param {Blob} blob - The blob to download
 * @param {string} fileName - The name for the downloaded file
 */
export function downloadBlob(blob, fileName) {
    // Use FileSaver.js if available, otherwise fallback to manual download
    if (window.saveAs) {
        window.saveAs(blob, fileName);
    } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
}

/**
 * Calculates entropy for byte data
 * @param {Uint8Array} buffer - Raw binary data
 * @returns {number} Entropy value between 0-1
 */
export function calculateEntropy(buffer) {
    try {
        // Simple Shannon entropy calculation
        const len = buffer.length;
        if (len === 0) return 0;
        
        // Count byte frequency
        const freq = new Array(256).fill(0);
        for (let i = 0; i < len; i++) {
            freq[buffer[i]]++;
        }
        
        // Calculate entropy
        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            if (freq[i] > 0) {
                const p = freq[i] / len;
                entropy -= p * Math.log2(p);
            }
        }
        
        // Normalize to 0-1 (max entropy for bytes is 8)
        return entropy / 8;
    } catch (error) {
        console.error('[fileOperations.js] Error calculating entropy:', error);
        return 0.5; // Return medium entropy on error
    }
}

/**
 * Formats algorithm name for display
 * @param {string} algorithm - Algorithm identifier
 * @returns {string} Formatted algorithm name
 */
function formatAlgorithm(algorithm) {
    if (!algorithm) return 'Unknown';
    
    // Convert to uppercase and remove any underscores/dashes
    const formatted = algorithm.toUpperCase().replace(/[_-]/g, ' ');
    return formatted;
}

/**
 * Creates a file card element
 * @param {Object} file - File information object
 * @returns {HTMLElement} File card element
 */
export function createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.setAttribute('data-file-id', file.id);
    
    const fileDate = file.date ? new Date(file.date).toLocaleDateString() : 'Unknown date';
    
    card.innerHTML = `
        <div class="file-header">
            <div class="file-name">${file.name || 'Unknown File'}</div>
            <div class="file-actions">
                <button class="action-button download-btn" title="Download Encrypted File">
                    <i class="fas fa-download"></i>
                </button>
                <button class="action-button decrypt-btn" title="Decrypt File">
                    <i class="fas fa-unlock"></i>
                </button>
                <button class="action-button delete-btn" title="Delete File">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="file-meta">
            ${file.size ? formatFileSize(file.size) : 'Unknown size'} · ${fileDate}
            ${file.algorithm ? `· <span class="file-algorithm">${formatAlgorithm(file.algorithm)}</span>` : ''}
            ${file.entropy ? `· <span class="file-entropy">Entropy: ${file.entropy.toFixed(2)}</span>` : ''}
        </div>
    `;
    
    // Add event listener for delete button
    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
                try {
                    // Get api from window
                    const { appApi } = window;
                    if (!appApi || !appApi.deleteFile) {
                        showToast('Delete API not available', 'error');
                        return;
                    }
                    
                    const result = await appApi.deleteFile(file.id);
                    if (result && result.success) {
                        card.remove();
                        showToast(`File "${file.name}" deleted successfully`, 'success');
                    } else {
                        showToast(`Failed to delete file: ${result?.error || 'Unknown error'}`, 'error');
                    }
                } catch (error) {
                    console.error('Error deleting file:', error);
                    showToast(`Delete error: ${error.message}`, 'error');
                }
            }
        });
    }
    
    // Add event listener for download button
    const downloadBtn = card.querySelector('.download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                // Get api from window
                const { appApi } = window;
                if (!appApi || !appApi.downloadEncryptedFile) {
                    showToast('Download API not available', 'error');
                    return;
                }
                
                showToast(`Downloading "${file.name}"...`, 'info');
                const result = await appApi.downloadEncryptedFile(file.id);
                if (result && result.success) {
                    showToast(`File "${file.name}" downloaded successfully`, 'success');
                } else {
                    showToast(`Failed to download file: ${result?.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error('Error downloading file:', error);
                showToast(`Download error: ${error.message}`, 'error');
            }
        });
    }
    
    // Add event listener for decrypt button
    const decryptBtn = card.querySelector('.decrypt-btn');
    if (decryptBtn) {
        decryptBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                // Get api from window
                const { api, electronAPI } = window;
                const appApi = api || electronAPI;
                
                if (!appApi || !appApi.decryptFile) {
                    showToast('Decrypt API not available', 'error');
                    return;
                }
                
                // Prompt user for password
                const password = prompt('Enter decryption password:');
                if (password === null) {
                    // User cancelled the prompt
                    return;
                }
                
                // Call the decryptFile function with the file ID and password
                const result = await decryptFile(file.id, password);
                
                if (result && result.success) {
                    // Success message handled in decryptFile function
                } else {
                    // Error message handled in decryptFile function
                }
            } catch (error) {
                console.error('Error decrypting file:', error);
                showToast(`Decrypt error: ${error.message}`, 'error');
            }
        });
    }
    
    return card;
}

/**
 * Loads and displays the list of encrypted files
 */
export async function loadFilesList() {
    try {
        const filesContainer = document.getElementById('files-container');
        if (!filesContainer) {
            console.error('Files container not found');
            return;
        }

        // Show loading indicator
        filesContainer.innerHTML = '<div class="loading-files">Loading files...</div>';
        
        // Get api from window
        const { api, electronAPI } = window;
        const appApi = api || electronAPI;
        
        if (!appApi || !appApi.getEncryptedFiles) {
            showToast('Files API not available', 'error');
            filesContainer.innerHTML = '<div class="no-files">Error: API not available</div>';
            return;
        }
        
        // Load files from the main process
        const filesResult = await appApi.getEncryptedFiles();
        
        let files = filesResult;
        // Handle both array responses and { success: true, files: [...] } format
        if (filesResult && typeof filesResult === 'object' && filesResult.success === true && Array.isArray(filesResult.files)) {
            files = filesResult.files;
        } else if (!Array.isArray(files)) {
            // If it's neither an array nor has a files property, treat as an error
            const errorMessage = (filesResult && filesResult.error) || 'Unknown error loading files';
            showToast(`Failed to load files: ${errorMessage}`, 'error');
            filesContainer.innerHTML = `<div class="no-files">Error: ${errorMessage}</div>`;
            return;
        }
        
        // If no files, show empty state
        if (files.length === 0) {
            filesContainer.innerHTML = `
                <div class="no-files">
                    <i class="fas fa-folder-open"></i>
                    <p>No encrypted files yet</p>
                    <p class="hint">Drag and drop files here or use the button above to encrypt your first file</p>
                </div>
            `;
            return;
        }
        
        // Clear container
        filesContainer.innerHTML = '';
        
        // Create file cards and add to container
        files.forEach(file => {
            const card = createFileCard(file);
            filesContainer.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading files:', error);
        const filesContainer = document.getElementById('files-container');
        if (filesContainer) {
            filesContainer.innerHTML = `<div class="no-files">Error: ${error.message}</div>`;
        }
        showToast(`Error loading files: ${error.message}`, 'error');
    }
}

/**
 * Shows the entropy analysis visualization for a file
 * @param {Object} appApi - The API for accessing main process functions
 * @param {Object} file - The file data
 */
async function showEntropyAnalysis(appApi, file) {
    try {
        if (!file || !file.id) {
            console.error('[fileOperations.js] Invalid file data for entropy analysis');
            showToast('Cannot analyze this file: missing file ID', 'error');
            return;
        }
        
        console.log(`[fileOperations.js] Showing entropy analysis for file: ${file.name || file.id}`);
        
        // Show loading toast
        showToast('Analyzing encryption quality...', 'info');
        
        // Show the entropy visualization
        await showEntropyVisualization(appApi, file);
        
    } catch (error) {
        console.error('[fileOperations.js] Error showing entropy analysis:', error);
        showToast(`Error analyzing encryption: ${error.message || 'Unknown error'}`, 'error');
    }
}
