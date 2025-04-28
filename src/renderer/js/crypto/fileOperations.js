/**
 * File encryption, decryption, and management functions
 */
import { showToast } from '../utils/toast.js';
import { formatFileSize, getEntropyClass } from '../utils/format.js';

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
            if (progressText) progressText.textContent = `Encrypting file ${i+1} of ${totalFiles}...`;
            
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
            showToast(`Successfully encrypted ${successCount} of ${totalFiles} files`, 'success');
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
 * Decrypts a file
 * @param {Object} appApi - The electron API for IPC communication
 * @param {string} fileId - ID of the file to decrypt
 */
export async function decryptFile(appApi, fileId) {
    if (!appApi || !appApi.decryptFile) {
        showToast('Decryption API not available', 'error');
        return null;
    }
    
    try {
        // Show progress
        const progressContainer = document.getElementById('progress-container');
        const progressText = document.getElementById('progress-text');
        
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (progressText) progressText.textContent = 'Decrypting...';
        
        // Decrypt the file
        const result = await appApi.decryptFile({ id: fileId });
        
        // Hide progress
        if (progressContainer) progressContainer.classList.add('hidden');
        
        if (result && result.success) {
            showToast(`File decrypted successfully!`, 'success');
            
            // Convert data to blob and download
            const blob = new Blob([result.data]);
            downloadBlob(blob, result.name);
            
            return result;
        } else {
            showToast(`Failed to decrypt file: ${result?.error || 'Unknown error'}`, 'error');
            return null;
        }
    } catch (error) {
        console.error('[fileOperations.js] Error decrypting file:', error);
        showToast(`Decryption error: ${error.message}`, 'error');
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) progressContainer.classList.add('hidden');
        return null;
    }
}

/**
 * Downloads the encrypted version of a file
 * @param {Object} appApi - The electron API for IPC communication
 * @param {string} fileId - ID of the file to download
 */
export async function downloadEncryptedFile(appApi, fileId) {
    if (!appApi || !appApi.getEncryptedFile) {
        showToast('Download API not available', 'error');
        return;
    }
    
    try {
        // Show progress
        const progressContainer = document.getElementById('progress-container');
        const progressText = document.getElementById('progress-text');
        
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (progressText) progressText.textContent = 'Preparing download...';
        
        // Get the encrypted file
        const result = await appApi.getEncryptedFile({ id: fileId });
        
        // Hide progress
        if (progressContainer) progressContainer.classList.add('hidden');
        
        if (result && result.success) {
            const blob = new Blob([result.data]);
            const fileName = `${result.name}.encrypted`;
            
            downloadBlob(blob, fileName);
            showToast(`Downloading encrypted file: ${fileName}`, 'success');
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
 * Deletes an encrypted file
 * @param {Object} appApi - The electron API for IPC communication
 * @param {string} fileId - ID of the file to delete
 */
export async function deleteEncryptedFile(appApi, fileId) {
    if (!appApi || !appApi.deleteFile) {
        showToast('Delete API not available', 'error');
        return;
    }
    
    try {
        const result = await appApi.deleteFile({ id: fileId });
        
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
        
        // Get file list and empty elements
        const fileList = document.getElementById('encrypted-files-list');
        const emptyState = document.getElementById('encrypted-files-empty');
        
        // If neither element exists, create them
        if (!fileList && !emptyState) {
            console.warn('[fileOperations.js] File list elements not found, attempting to create them');
            
            // Try to find the parent container
            const fileListContainer = document.querySelector('.card-body') || 
                                      document.querySelector('.file-list-container') || 
                                      document.querySelector('.file-list-section');
            
            if (fileListContainer) {
                // Create both elements
                const newEmptyState = document.createElement('div');
                newEmptyState.id = 'encrypted-files-empty';
                newEmptyState.className = 'file-list-empty hidden';
                newEmptyState.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="empty-icon">
                        <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 9l-5 5-5-5M12 12.8V2.5"/>
                    </svg>
                    <p>No encrypted files yet</p>
                    <button id="start-encryption-cta" class="btn btn-outline" style="margin-top: 1rem;">
                        Encrypt Your First File
                    </button>
                `;
                
                const newFileList = document.createElement('div');
                newFileList.id = 'encrypted-files-list';
                newFileList.className = 'file-list';
                
                fileListContainer.appendChild(newEmptyState);
                fileListContainer.appendChild(newFileList);
                
                // Update references
                fileList = newFileList;
                emptyState = newEmptyState;
                
                // Set up the CTA button event listener
                const startEncryptionCta = document.getElementById('start-encryption-cta');
                if (startEncryptionCta) {
                    startEncryptionCta.addEventListener('click', () => {
                        const encryptBtn = document.getElementById('encrypt-button');
                        if (encryptBtn) encryptBtn.click();
                    });
                }
            } else {
                console.error('[fileOperations.js] Could not find container for file list elements');
                return;
            }
        }
        
        // Get files from the main process
        const files = await appApi.getEncryptedFiles();
        console.log('[fileOperations.js] Encrypted files loaded:', files);
        
        // Clear existing file list
        if (fileList) fileList.innerHTML = '';
        console.log('[fileOperations.js] Cleared file list, adding files:', files ? files.length : 0);
        
        // Show empty state or file list based on file count
        if (!files || files.length === 0) {
            if (fileList) fileList.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        
        // We have files, show the list and hide empty state
        if (fileList) fileList.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        
        // Add files to the list
        files.forEach(file => {
            const fileName = file.name || `${file.id}${file.extension || ''}`;
            const fileSize = formatFileSize(file.size);
            const dateCreated = new Date(file.created).toLocaleString();
            const entropyClass = getEntropyClass(file.entropy || 0.7);
            
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
                    </div>
                    <div class="file-entropy">
                        <div class="entropy-bar ${entropyClass}" title="Encryption quality: ${Math.round((file.entropy || 0.7) * 100)}%">
                            <div class="entropy-fill" style="width: ${(file.entropy || 0.7) * 100}%"></div>
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
                    decryptFile(appApi, file.id);
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
