/**
 * Main renderer process script - initializes the application UI and handles user interactions
 */

// Debug logging utility - centralized control of logging
const DEBUG_MODE = false; // Set to false in production
function log(...args) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

function logError(...args) {
    // Always log errors for debugging
    console.error(...args);
}

// Wait for the window to be loaded
window.addEventListener('DOMContentLoaded', () => {
    log('DOM fully loaded');
    
    // Get the API from the preload script
    const appApi = window.api || window.electronAPI;
    
    if (!appApi) {
        logError('API not found. Context bridge may not be working correctly.');
        document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: API not available. The application cannot function properly.</div>';
        return;
    }
    
    log('API loaded successfully', Object.keys(appApi));
    
    // Import required modules
    import('./js/crypto/fileOperations.js')
        .then(module => {
            log('fileOperations module loaded');
            const { encryptFiles, loadEncryptedFiles } = module;
            
            // Initialize the encryption functionality
            initEncryption(appApi, encryptFiles, loadEncryptedFiles);
        })
        .catch(error => {
            logError('Error loading fileOperations module:', error);
        });
});

/**
 * Initializes the encryption functionality
 * @param {Object} appApi - The API for interacting with the main process
 * @param {Function} encryptFiles - Function to encrypt files
 * @param {Function} loadEncryptedFiles - Function to load encrypted files
 */
function initEncryption(appApi, encryptFiles, loadEncryptedFiles) {
    log('Initializing encryption functionality');
    
    // Check key status on load
    checkAndUpdateKeyStatus(appApi);
    
    // Load the encrypted files list
    loadEncryptedFilesIfElementExists(appApi, loadEncryptedFiles);
    
    // Setup tab switching
    setupTabNavigation(appApi, loadEncryptedFiles);
    
    // Setup encrypt button
    setupEncryptButton(appApi, encryptFiles, loadEncryptedFiles);
    
    // Setup key generation
    setupKeyGeneration(appApi);
    
    // Setup drag and drop functionality
    setupDragAndDrop(appApi);
}

/**
 * Safely loads encrypted files if the element exists
 */
function loadEncryptedFilesIfElementExists(appApi, loadEncryptedFiles) {
    try {
        if (document.getElementById('encrypted-files-list') || 
            document.getElementById('encrypted-files-empty')) {
            loadEncryptedFiles(appApi);
        } else {
            log('Encrypted files elements not found, skipping load');
        }
    } catch (error) {
        logError('Error loading encrypted files:', error);
    }
}

/**
 * Sets up the encrypt button functionality
 */
function setupEncryptButton(appApi, encryptFiles, loadEncryptedFiles) {
    const encryptButton = document.getElementById('encrypt-button');
    if (encryptButton) {
        log('Found encrypt button, setting up click handler');
        encryptButton.addEventListener('click', () => {
            log('Encrypt button clicked');
            encryptFiles(appApi)
                .then(() => {
                    // Reload the file list after encryption
                    loadEncryptedFilesIfElementExists(appApi, loadEncryptedFiles);
                })
                .catch(error => {
                    logError('Error in encrypt button handler:', error);
                    showToast(`Encryption failed: ${error.message || 'Unknown error'}`, 'error');
                });
        });
    } else {
        // Create a temporary encrypt button if one doesn't exist in the DOM
        log('Encrypt button not found in DOM, creating element and appending to header');
        try {
            const header = document.querySelector('.file-list-header');
            if (header) {
                const btnContainer = document.createElement('div');
                btnContainer.style.marginLeft = 'auto';
                
                const newButton = document.createElement('button');
                newButton.id = 'encrypt-button';
                newButton.className = 'btn btn-primary';
                newButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Encrypt Selected Files
                `;
                btnContainer.appendChild(newButton);
                header.appendChild(btnContainer);
                
                // Recursively call this function to set up the event listener
                setupEncryptButton(appApi, encryptFiles, loadEncryptedFiles);
            } else {
                logError('Could not find header element to append encrypt button');
            }
        } catch (err) {
            logError('Failed to create encrypt button dynamically:', err);
        }
    }
}

/**
 * Sets up the tab navigation
 */
function setupTabNavigation(appApi, loadEncryptedFiles) {
    log('Setting up tab navigation');
    
    // Try to find the sections and tabs based on both old and new UI structure
    const encryptionSection = document.getElementById('encryption-section');
    const keyManagementSection = document.getElementById('key-management-section');
    
    // Handle the case where sections don't exist in new UI
    if (!encryptionSection && !keyManagementSection) {
        log('Required sections not found - may be using new UI structure');
        return;
    }
    
    // Tab links - try both old and new selectors
    const encryptTab = document.querySelector('.sidebar-link.active') || document.querySelector('.nav-item.active');
    const keysTabLink = document.getElementById('keys-tab-link') || document.querySelector('a[href="key-management.html"]');
    
    if (!encryptTab || !keysTabLink) {
        logError('Tab links not found');
        return;
    }
    
    // Show encryption section by default if both sections exist
    if (encryptionSection && keyManagementSection) {
        encryptionSection.classList.remove('hidden');
        keyManagementSection.classList.add('hidden');
        
        // Handle encryption tab click
        encryptTab.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active states
            encryptTab.classList.add('active');
            keysTabLink.classList.remove('active');
            
            // Show/hide sections
            encryptionSection.classList.remove('hidden');
            keyManagementSection.classList.add('hidden');
            
            // Refresh file list
            loadEncryptedFilesIfElementExists(appApi, loadEncryptedFiles);
        });
        
        // Handle keys tab click
        keysTabLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active states
            encryptTab.classList.remove('active');
            keysTabLink.classList.add('active');
            
            // Show/hide sections
            encryptionSection.classList.add('hidden');
            keyManagementSection.classList.remove('hidden');
            
            // Update key info in the key management section
            updateKeyManagementInfo(appApi);
        });
    }
}

/**
 * Updates the key management section with current key information
 */
async function updateKeyManagementInfo(appApi) {
    log('Updating key management info');
    
    try {
        // Get key status
        const keyStatus = await appApi.checkKeyStatus();
        log('Key status:', keyStatus);
        
        // Update key indicators
        const keyInfoIndicator = document.getElementById('key-info-indicator');
        const keyInfoStatus = document.getElementById('key-info-status');
        const keyDetails = document.getElementById('key-details');
        const noKeyWarning = document.getElementById('no-key-warning');
        const currentKeyId = document.getElementById('current-key-id');
        const keyCreatedDate = document.getElementById('key-created-date');
        
        if (keyStatus && keyStatus.exists) {
            // Key exists
            if (keyInfoIndicator) {
                keyInfoIndicator.className = 'status-dot active';
            }
            if (keyInfoStatus) {
                keyInfoStatus.textContent = 'Active Key';
                keyInfoStatus.className = 'status-text active';
            }
            
            // Show key details
            if (keyDetails) keyDetails.style.display = 'grid';
            if (noKeyWarning) noKeyWarning.style.display = 'none';
            
            // Update key details
            if (currentKeyId) currentKeyId.textContent = keyStatus.keyId || 'Unknown';
            if (keyCreatedDate) {
                const dateStr = keyStatus.created ? new Date(keyStatus.created).toLocaleString() : 'Unknown';
                keyCreatedDate.textContent = dateStr;
            }
        } else {
            // No key
            if (keyInfoIndicator) {
                keyInfoIndicator.className = 'status-dot inactive';
            }
            if (keyInfoStatus) {
                keyInfoStatus.textContent = 'No Active Key';
                keyInfoStatus.className = 'status-text inactive';
            }
            
            // Show warning
            if (keyDetails) keyDetails.style.display = 'none';
            if (noKeyWarning) noKeyWarning.style.display = 'flex';
        }
    } catch (error) {
        logError('Error updating key management info:', error);
        showToast('Error checking key status', 'error');
    }
}

/**
 * Sets up key generation functionality
 */
function setupKeyGeneration(appApi) {
    log('Setting up key generation');
    
    // Multiple possible button selectors for different UI versions
    const generateKeyButtons = [
        document.getElementById('generate-key-btn'),
        document.getElementById('generate-key-button'),
        document.querySelector('button[id^="generate-key"]')
    ].filter(Boolean);
    
    log(`Found ${generateKeyButtons.length} generate key buttons`);
    
    generateKeyButtons.forEach(button => {
        button.addEventListener('click', async () => {
            log('Generate key button clicked');
            button.disabled = true;
            
            try {
                // Show loading state
                const originalText = button.innerHTML;
                button.innerHTML = 'Generating...';
                
                const result = await appApi.generateKey();
                log('Key generation result:', result);
                
                if (result && result.success) {
                    showToast('Key generated successfully!', 'success');
                    checkAndUpdateKeyStatus(appApi);
                } else {
                    showToast(`Failed to generate key: ${result ? result.error : 'Unknown error'}`, 'error');
                }
            } catch (error) {
                logError('Error generating key:', error);
                showToast(`Error generating key: ${error.message || 'Unknown error'}`, 'error');
            } finally {
                // Reset button state
                button.disabled = false;
                if (button.innerHTML === 'Generating...') {
                    button.innerHTML = originalText;
                }
            }
        });
    });
}

/**
 * Checks the key status and updates the UI
 */
function checkAndUpdateKeyStatus(appApi) {
    log('Checking key status');
    
    // Use the proper API method
    if (typeof appApi.checkKeyStatus === 'function') {
        appApi.checkKeyStatus()
            .then(result => {
                log('Key status checked:', result);
                const { exists, keyId } = result;
                updateKeyStatus(exists, keyId);
            })
            .catch(error => {
                logError('Error checking key status:', error);
                updateKeyStatus(false, undefined);
            });
    } else {
        logError('checkKeyStatus method not available in API');
        updateKeyStatus(false, undefined);
    }
}

/**
 * Updates the key status indicators in the UI
 * @param {boolean} exists - Whether a key exists
 * @param {string} keyId - The ID of the key (if it exists)
 */
function updateKeyStatus(exists, keyId) {
    log('Updating key status:', exists, keyId);
    
    // Get the no key warnings
    const noKeyWarning = document.getElementById('no-key-warning');
    const encryptButton = document.getElementById('encrypt-button');
    
    // Settings panel indicators (if present)
    const settingsKeyIndicator = document.getElementById('settings-key-indicator');
    const settingsKeyStatus = document.getElementById('settings-key-status');
    
    // Key info for key management page
    const keyInfoIndicator = document.getElementById('key-info-indicator');
    const keyInfoStatus = document.getElementById('key-info-status');
    
    if (exists) {
        // We have a key - hide warnings, enable encryption
        if (noKeyWarning) noKeyWarning.style.display = 'none';
        if (encryptButton) encryptButton.disabled = false;
        
        // Update settings indicators if they exist
        if (settingsKeyIndicator) settingsKeyIndicator.className = 'status-dot active';
        if (settingsKeyStatus) {
            settingsKeyStatus.textContent = 'Active';
            settingsKeyStatus.className = 'status-text active';
        }
        
        // Update key info indicators if they exist
        if (keyInfoIndicator) keyInfoIndicator.className = 'status-dot active';
        if (keyInfoStatus) {
            keyInfoStatus.textContent = 'Active Key';
            keyInfoStatus.className = 'status-text active';
        }
    } else {
        // No key - show warnings, disable encryption
        if (noKeyWarning) noKeyWarning.style.display = 'flex';
        if (encryptButton) encryptButton.disabled = true;
        
        // Update settings indicators if they exist
        if (settingsKeyIndicator) settingsKeyIndicator.className = 'status-dot inactive';
        if (settingsKeyStatus) {
            settingsKeyStatus.textContent = 'Not Set';
            settingsKeyStatus.className = 'status-text inactive';
        }
        
        // Update key info indicators if they exist
        if (keyInfoIndicator) keyInfoIndicator.className = 'status-dot inactive';
        if (keyInfoStatus) {
            keyInfoStatus.textContent = 'No Active Key';
            keyInfoStatus.className = 'status-text inactive';
        }
    }
}

/**
 * Sets up drag and drop functionality for file selection
 */
function setupDragAndDrop(appApi) {
    log('Setting up drag and drop');
    
    // Find all possible drop zones (multiple selectors for different UI versions)
    const dropArea = document.querySelector('.drop-area') || document.getElementById('drop-area') || 
                     document.getElementById('encryption-section');
    
    if (!dropArea) {
        log('Creating file input element');
        // If no drop area, just add a file input
        createFileInput(appApi);
        return;
    }
    
    log('Found drop area:', dropArea);
    
    // Create a file input element for the browse button
    createFileInput(appApi, dropArea);
    
    // Setup the event listeners for drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle the drop event
    dropArea.addEventListener('drop', event => {
        log('File dropped');
        const dt = event.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            handleFiles(files, appApi);
        }
    }, false);
    
    // Find browse button and add click handler
    const browseButton = document.getElementById('browse-button') || 
                         dropArea.querySelector('button:not([disabled])') || 
                         document.querySelector('button[data-action="browse"]');
    
    if (browseButton) {
        log('Found browse button, setting up click handler');
        browseButton.addEventListener('click', () => {
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.click();
            } else {
                logError('File input element not found');
            }
        });
    }
}

/**
 * Creates a file input element and sets up its event handlers
 */
function createFileInput(appApi, dropArea) {
    log('Creating file input element');
    
    // Create a file input element
    let fileInput = document.getElementById('file-input');
    
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.id = 'file-input';
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.style.display = 'none';
        fileInput.accept = '*.*';
        
        document.body.appendChild(fileInput);
        
        fileInput.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                log('Files selected via input:', event.target.files.length);
                handleFiles(event.target.files, appApi);
            }
        });
    }
}

/**
 * Prevents default actions for drag and drop events
 */
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * Highlights the drop area when a file is being dragged over it
 */
function highlight() {
    const dropArea = document.querySelector('.drop-area') || document.getElementById('drop-area');
    if (dropArea) dropArea.classList.add('active');
}

/**
 * Removes highlight from the drop area
 */
function unhighlight() {
    const dropArea = document.querySelector('.drop-area') || document.getElementById('drop-area');
    if (dropArea) dropArea.classList.remove('active');
}

/**
 * Handles the files that were selected or dropped
 */
async function handleFiles(files, appApi) {
    try {
        if (!files || files.length === 0) return;
        
        log(`Processing ${files.length} files via drag-and-drop or file selection`);
        
        // Show progress indicator if it exists
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
        }
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            log(`Processing file ${i+1}/${files.length}: ${file.name}`);
            
            try {
                // Convert File to path or process directly
                // For security reasons, need to save the file to a temp location first in Electron
                const result = await appApi.encryptFile(file.path || file, 'aes-256-gcm');
                
                if (result && result.success) {
                    log(`File encrypted successfully: ${file.name}`);
                    // Show success notification
                    showToast(`File encrypted: ${file.name}`, 'success');
                } else {
                    logError(`Failed to encrypt file: ${file.name}`, result ? result.error : 'Unknown error');
                    showToast(`Failed to encrypt ${file.name}: ${result ? result.error : 'Unknown error'}`, 'error');
                }
            } catch (fileError) {
                logError(`Error encrypting file: ${file.name}`, fileError);
                showToast(`Error encrypting ${file.name}: ${fileError.message || 'Unknown error'}`, 'error');
            }
            
            // Update progress if elements exist
            const progressBar = document.getElementById('progress-bar');
            const progressPercentage = document.getElementById('progress-percentage');
            const progressText = document.getElementById('progress-text');
            
            const percent = Math.round(((i + 1) / files.length) * 100);
            
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressPercentage) progressPercentage.textContent = `${percent}%`;
            if (progressText) progressText.textContent = `Processing ${file.name}...`;
        }

        // Hide progress indicator after completion
        if (progressContainer) {
            setTimeout(() => {
                progressContainer.classList.add('hidden');
            }, 1000);
        }
        
        // After processing, reload the file list to show the newly encrypted files
        try {
            log('Loading encrypted files after processing');
            // Try to import and use the loadEncryptedFiles function
            const { loadEncryptedFiles } = await import('./js/crypto/fileOperations.js');
            if (typeof loadEncryptedFiles === 'function') {
                await loadEncryptedFiles(appApi);
            }
        } catch (loadError) {
            logError('Error loading encrypted files after processing:', loadError);
        }
        
        showToast(`Successfully processed ${files.length} files`, 'success');
    } catch (error) {
        logError('Error handling files:', error);
        showToast(`Error processing files: ${error.message || 'Unknown error'}`, 'error');
        
        // Hide progress indicator on error
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) progressContainer.classList.add('hidden');
    }
}

/**
 * Shows a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of notification (success, error, info)
 */
function showToast(message, type = 'info') {
    log(`Toast notification: ${message} (${type})`);
    
    // Try to find existing toast container or create one
    let toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '1rem';
        toastContainer.style.right = '1rem';
        toastContainer.style.zIndex = '9999';
        toastContainer.style.display = 'flex';
        toastContainer.style.flexDirection = 'column';
        toastContainer.style.gap = '0.5rem';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'card';
    toast.style.padding = '0.75rem 1rem';
    toast.style.marginBottom = '0.5rem';
    toast.style.maxWidth = '300px';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(1rem)';
    toast.style.transition = 'all 0.3s ease';
    
    // Add border color based on type
    if (type === 'success') {
        toast.style.borderLeft = '4px solid var(--accent-success, #10b981)';
    } else if (type === 'error') {
        toast.style.borderLeft = '4px solid var(--accent-danger, #ef4444)';
    } else {
        toast.style.borderLeft = '4px solid var(--accent-blue, #3b82f6)';
    }
    
    // Add content
    toast.innerHTML = message;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(1rem)';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}