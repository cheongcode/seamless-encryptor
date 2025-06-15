/**
 * Seamless Encryptor - Enterprise Renderer
 * Main application logic for the renderer process
 */

console.log('[Renderer] Starting renderer.js execution...');
console.log('[Renderer] JavaScript is loading successfully!');

// Global state
let appApi = null;
let selectedFiles = [];
let currentSection = 'dashboard';

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Renderer] DOM loaded, initializing app...');
    
    // Hide loading screen and show app
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        if (loadingScreen && app) {
            loadingScreen.classList.add('hidden');
            app.classList.remove('hidden');
            console.log('[Renderer] App is now visible!');
        }
        
        // Initialize the application
        initializeApp();
    }, 1000);
});

// Initialize application
function initializeApp() {
    console.log('[Renderer] Initializing application...');
    
    // Get API from preload script
    appApi = window.api || window.electronAPI;
    
    if (appApi) {
        console.log('[Renderer] API found:', Object.keys(appApi));
    } else {
        console.warn('[Renderer] No API found, running in demo mode');
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Update initial state
    updateKeyStatus();
    updateDashboardStats();
    
    console.log('[Renderer] Application initialized successfully!');
}

// Setup all event listeners
function setupEventListeners() {
    console.log('[Renderer] Setting up event listeners...');
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            if (section) {
                switchSection(section);
            }
        });
    });
    
    // Dashboard quick actions
    const dashboardEncryptBtn = document.getElementById('dashboard-encrypt-btn');
    if (dashboardEncryptBtn) {
        dashboardEncryptBtn.addEventListener('click', () => switchSection('encryption'));
    }
    
    const dashboardGenerateKeyBtn = document.getElementById('dashboard-generate-key-btn');
    if (dashboardGenerateKeyBtn) {
        dashboardGenerateKeyBtn.addEventListener('click', () => generateKey());
    }
    
    const dashboardViewFilesBtn = document.getElementById('dashboard-view-files-btn');
    if (dashboardViewFilesBtn) {
        dashboardViewFilesBtn.addEventListener('click', () => switchSection('files'));
    }
    
    const dashboardSettingsBtn = document.getElementById('dashboard-settings-btn');
    if (dashboardSettingsBtn) {
        dashboardSettingsBtn.addEventListener('click', () => switchSection('settings'));
    }
    
    // File operations
    const browseFilesBtn = document.getElementById('browse-files-btn');
    if (browseFilesBtn) {
        browseFilesBtn.addEventListener('click', () => openFileDialog());
    }
    
    // Also handle the file input for backward compatibility
    const fileInputBtn = document.getElementById('file-input-btn');
    if (fileInputBtn) {
        fileInputBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.click();
            }
        });
    }
    
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }
    
    // Drag and drop
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);
        dropZone.addEventListener('click', () => {
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.click();
            }
        });
    }
    
    // Key management
    const generateKeyBtn = document.getElementById('generate-key-btn');
    if (generateKeyBtn) {
        generateKeyBtn.addEventListener('click', () => generateKey());
    }
    
    const importKeyBtn = document.getElementById('import-key-btn');
    if (importKeyBtn) {
        importKeyBtn.addEventListener('click', () => importKey());
    }
    
    // File management
    const refreshFilesBtn = document.getElementById('refresh-files-btn');
    if (refreshFilesBtn) {
        refreshFilesBtn.addEventListener('click', () => loadEncryptedFiles());
    }
    
    // Encryption
    const encryptSelectedBtn = document.getElementById('encrypt-selected-btn');
    if (encryptSelectedBtn) {
        encryptSelectedBtn.addEventListener('click', () => encryptSelectedFiles());
    }
    
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', () => clearFileSelection());
    }
    
    // Quick encrypt
    const quickEncryptBtn = document.getElementById('quick-encrypt-btn');
    if (quickEncryptBtn) {
        quickEncryptBtn.addEventListener('click', () => quickEncrypt());
    }
    
    console.log('[Renderer] Event listeners setup complete!');
}

// Navigation system
function switchSection(sectionName) {
    console.log(`[Renderer] Switching to section: ${sectionName}`);
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        }
    });

    // Update sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });

    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
    }

    // Update header
    const titles = {
        dashboard: { title: 'Dashboard', subtitle: 'Secure file encryption and management' },
        encryption: { title: 'Encrypt Files', subtitle: 'Drag and drop files to encrypt them securely' },
        files: { title: 'Encrypted Files', subtitle: 'Manage your encrypted files' },
        keys: { title: 'Key Management', subtitle: 'Generate and manage encryption keys' },
        settings: { title: 'Settings', subtitle: 'Configure application preferences' }
    };

    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    if (pageTitle && pageSubtitle && titles[sectionName]) {
        pageTitle.textContent = titles[sectionName].title;
        pageSubtitle.textContent = titles[sectionName].subtitle;
    }

    currentSection = sectionName;

    // Load section-specific data
    if (sectionName === 'files') {
        loadEncryptedFiles();
    } else if (sectionName === 'keys') {
        updateKeyInfo();
    } else if (sectionName === 'dashboard') {
        updateDashboardStats();
    }
}

// Key management functions
async function updateKeyStatus() {
    console.log('[Renderer] Updating key status...');
    
    if (!appApi || !appApi.checkKeyStatus) {
        console.log('[Renderer] No key API available, showing demo status');
        return;
    }

    try {
        const keyStatus = await appApi.checkKeyStatus();
        const indicator = document.getElementById('key-indicator');
        const statusText = document.getElementById('key-status-text');
        const statusDetail = document.getElementById('key-status-detail');
        
        if (keyStatus && keyStatus.exists) {
            if (indicator) indicator.className = 'key-indicator active';
            if (statusText) statusText.textContent = 'Key Active';
            if (statusDetail) statusDetail.textContent = `ID: ${keyStatus.keyId || 'Unknown'}`;
        } else {
            if (indicator) indicator.className = 'key-indicator';
            if (statusText) statusText.textContent = 'No Key';
            if (statusDetail) statusDetail.textContent = 'Generate or import a key';
        }

        return keyStatus;
    } catch (error) {
        console.error('[Renderer] Error checking key status:', error);
        return null;
    }
}

async function updateKeyInfo() {
    console.log('[Renderer] Updating key info...');
    
    if (!appApi || !appApi.checkKeyStatus) return;

    try {
        const keyStatus = await appApi.checkKeyStatus();
        const keyInfo = document.getElementById('key-info');
        
        if (!keyInfo) return;

        if (keyStatus && keyStatus.exists) {
            keyInfo.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background-color: rgba(16, 185, 129, 0.1); border: 1px solid #059669; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 12px; height: 12px; background-color: #10b981; border-radius: 50%;"></div>
                        <div>
                            <p style="font-size: 14px; font-weight: 500; color: white;">Encryption Key Active</p>
                            <p style="font-size: 12px; color: #6ee7b7;">ID: ${keyStatus.keyId || 'Unknown'}</p>
                        </div>
                    </div>
                    <svg style="width: 20px; height: 20px; color: #10b981;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
            `;
            } else {
            keyInfo.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid #dc2626; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 12px; height: 12px; background-color: #ef4444; border-radius: 50%;"></div>
                        <div>
                            <p style="font-size: 14px; font-weight: 500; color: white;">No Encryption Key</p>
                            <p style="font-size: 12px; color: #fca5a5;">Generate or import a key to start encrypting</p>
                        </div>
                    </div>
                    <svg style="width: 20px; height: 20px; color: #ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                </div>
            `;
        }
    } catch (error) {
        console.error('[Renderer] Error updating key info:', error);
    }
}

async function generateKey() {
    console.log('[Renderer] Generating key...');
    
    if (!appApi || !appApi.generateKey) {
        showToast('Key generation not available - running in demo mode', 'warning');
                return;
            }
            
            try {
        showToast('Generating encryption key...', 'info');
                const result = await appApi.generateKey();
                
                if (result && result.success) {
            showToast('Encryption key generated successfully', 'success');
            await updateKeyStatus();
            await updateKeyInfo();
            await updateDashboardStats();
                } else {
            showToast(`Failed to generate key: ${result?.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
        console.error('[Renderer] Error generating key:', error);
        showToast(`Error generating key: ${error.message}`, 'error');
    }
}

async function importKey() {
    console.log('[Renderer] Importing key...');
    showToast('Key import feature coming soon', 'info');
}

// File operations
async function loadEncryptedFiles() {
    console.log('[Renderer] Loading encrypted files...');
    
    const filesContainer = document.getElementById('files-container');
    if (!filesContainer) return;

    if (!appApi || !appApi.getEncryptedFiles) {
        filesContainer.innerHTML = `
            <div style="text-align: center; padding: 48px;">
                <svg style="width: 64px; height: 64px; color: #6b7280; margin: 0 auto 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <h3 style="font-size: 18px; font-weight: 500; color: #9ca3af; margin-bottom: 8px;">Demo Mode</h3>
                <p style="color: #6b7280;">File operations will be available when connected to the backend</p>
            </div>
        `;
        return;
    }
    
    try {
        filesContainer.innerHTML = '<div style="text-center: padding: 32px; color: #9ca3af;">Loading files...</div>';

        const result = await appApi.getEncryptedFiles();
        let files = result;

        if (result && typeof result === 'object' && result.success === true && Array.isArray(result.files)) {
            files = result.files;
        }

        if (!Array.isArray(files) || files.length === 0) {
            filesContainer.innerHTML = `
                <div style="text-align: center; padding: 48px;">
                    <svg style="width: 64px; height: 64px; color: #6b7280; margin: 0 auto 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <h3 style="font-size: 18px; font-weight: 500; color: #9ca3af; margin-bottom: 8px;">No encrypted files</h3>
                    <p style="color: #6b7280;">Start by encrypting some files to see them here</p>
                </div>
            `;
            return;
        }

        filesContainer.innerHTML = '';
        files.forEach(file => {
            const fileCard = createFileCard(file);
            filesContainer.appendChild(fileCard);
        });

        } catch (error) {
        console.error('[Renderer] Error loading encrypted files:', error);
        showToast('Error loading files', 'error');
    }
}

function createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-item';
    
    const fileName = file.name || file.originalName || `${file.id}${file.extension || ''}`;
    const fileSize = formatFileSize(file.size || 0);
    const dateCreated = file.created ? new Date(file.created).toLocaleDateString() : 'Unknown';
    const algorithm = file.algorithm || 'Unknown';

    card.innerHTML = `
        <div class="file-info">
            <div class="file-icon">
                <svg style="width: 20px; height: 20px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
            <div>
                <h4 style="font-weight: 500; color: white;">${fileName}</h4>
                <p style="font-size: 14px; color: #9ca3af;">${fileSize} • ${dateCreated} • ${algorithm}</p>
            </div>
        </div>
        <div class="file-actions">
            <button class="file-btn green" title="Decrypt">
                <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path>
                </svg>
            </button>
            <button class="file-btn blue" title="Download">
                <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
            </button>
            <button class="file-btn red" title="Delete">
                <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            </button>
        </div>
    `;

    return card;
}

// File selection and drag/drop
function handleFileSelection(event) {
    const files = Array.from(event.target.files);
    addFilesToSelection(files);
}

function handleDragOver(event) {
    event.preventDefault();
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.classList.add('active');
    }
}

function handleDragLeave(event) {
    event.preventDefault();
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.classList.remove('active');
    }
}

function handleDrop(event) {
    event.preventDefault();
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.classList.remove('active');
    }
    
    const files = Array.from(event.dataTransfer.files);
    addFilesToSelection(files);
}

// File dialog functionality
async function openFileDialog() {
    try {
        if (appApi?.openFileDialog) {
            console.log('[RENDERER] Calling openFileDialog...');
            const result = await appApi.openFileDialog();
            console.log('[RENDERER] File dialog result:', result);
            console.log('[RENDERER] Result type:', typeof result);
            console.log('[RENDERER] Is array:', Array.isArray(result));
            
            if (result && Array.isArray(result) && result.length > 0) {
                console.log('[RENDERER] First item:', result[0]);
                console.log('[RENDERER] First item type:', typeof result[0]);
                
                let files;
                
                // Check if result contains file objects or just paths
                if (typeof result[0] === 'string') {
                    console.log('[RENDERER] Converting path strings to file objects');
                    // Convert path strings to file objects
                    files = result.map(path => ({
                        path: path,
                        name: path.split('/').pop() || path.split('\\').pop() || 'Unknown File',
                        size: 0 // Will be determined during encryption
                    }));
                } else {
                    console.log('[RENDERER] Using file objects as-is');
                    // Already file objects
                    files = result;
                }
                
                console.log('[RENDERER] Processed files for queue:', files);
                addFilesToSelection(files);
            } else {
                console.log('[RENDERER] No files selected or dialog was cancelled');
            }
        }
    } catch (error) {
        console.error('[RENDERER] Error opening file dialog:', error);
        showToast('Failed to open file dialog', 'error');
    }
}

function addFilesToSelection(files) {
    console.log(`[Renderer] Adding ${files.length} files to selection`);
    
    // Handle both File objects and our custom file objects
    const processedFiles = files.map(file => {
        if (file.path) {
            // Custom file object from dialog
            return file;
        } else {
            // Regular File object from drag/drop or input
            return {
                path: file.name, // For File objects, we use name as path
                name: file.name,
                size: file.size,
                file: file // Keep reference to original File object
            };
        }
    });
    
    selectedFiles = [...selectedFiles, ...processedFiles];
    updateSelectedFilesDisplay();
    showToast(`Added ${files.length} file(s) to selection`, 'success');
}

function updateSelectedFilesDisplay() {
    const selectedFilesContainer = document.getElementById('selected-files');
    const selectedFilesList = document.getElementById('selected-files-list');
    
    if (!selectedFilesContainer || !selectedFilesList) return;
    
    if (selectedFiles.length === 0) {
        selectedFilesContainer.classList.add('hidden');
        return;
    }
    
    selectedFilesContainer.classList.remove('hidden');
    selectedFilesList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-icon">
                    <svg style="width: 20px; height: 20px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                </div>
                <div>
                    <h4 style="font-weight: 500; color: white;">${file.name}</h4>
                    <p style="font-size: 14px; color: #9ca3af;">${formatFileSize(file.size)}</p>
                </div>
            </div>
            <button class="file-btn red" onclick="removeFileFromSelection(${index})" title="Remove">
                <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        `;
        selectedFilesList.appendChild(fileItem);
    });
}

function removeFileFromSelection(index) {
    selectedFiles.splice(index, 1);
    updateSelectedFilesDisplay();
}

function clearFileSelection() {
    selectedFiles = [];
    updateSelectedFilesDisplay();
}

async function encryptSelectedFiles() {
    console.log('[Renderer] Encrypting selected files...');
    
    if (selectedFiles.length === 0) {
        showToast('No files selected for encryption', 'warning');
        return;
    }
    
    if (!appApi || !appApi.encryptFile) {
        showToast('Encryption not available - running in demo mode', 'warning');
        return;
    }
    
    showToast('Starting encryption process...', 'info');
    
    let successCount = 0;
    const totalFiles = selectedFiles.length;
    
    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        console.log(`[Renderer] Encrypting file: ${file.path || file.name}`);
        
        try {
            // Use the file path for encryption
            const filePath = file.path || file.name;
            const encryptionMethod = 'aes-256-gcm'; // Default method
            
            const result = await appApi.encryptFile(filePath, encryptionMethod);
            console.log(`[Renderer] Encryption result for ${file.name}:`, result);
            
            if (result?.success) {
                successCount++;
                showToast(`Encrypted: ${file.name}`, 'success');
            } else {
                console.error(`[Renderer] Encryption failed for ${file.name}:`, result?.error);
                showToast(`Failed to encrypt: ${file.name}`, 'error');
            }
        } catch (error) {
            console.error(`[Renderer] Encryption error for ${file.name}:`, error);
            showToast(`Error encrypting: ${file.name}`, 'error');
        }
    }
    
    // Clear selection after encryption
    selectedFiles = [];
    updateSelectedFilesDisplay();
    
    // Show final result
    if (successCount === totalFiles) {
        showToast(`Successfully encrypted all ${successCount} files!`, 'success');
    } else {
        showToast(`Encrypted ${successCount}/${totalFiles} files`, 'warning');
    }
    
    // Refresh encrypted files list
    await loadEncryptedFiles();
    await updateDashboardStats();
}

async function quickEncrypt() {
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.click();
    }
}

// Dashboard stats
async function updateDashboardStats() {
    console.log('[Renderer] Updating dashboard stats...');
    
    const statsFiles = document.getElementById('stats-files');
    const statsSize = document.getElementById('stats-size');
    const statsSecurity = document.getElementById('stats-security');
    
    if (statsFiles) statsFiles.textContent = '0';
    if (statsSize) statsSize.textContent = '0 MB';
    if (statsSecurity) statsSecurity.textContent = 'High';
    
    if (!appApi || !appApi.getEncryptedFiles) return;
    
    try {
        const result = await appApi.getEncryptedFiles();
        let files = result;
        
        if (result && typeof result === 'object' && result.success === true && Array.isArray(result.files)) {
            files = result.files;
        }
        
        if (Array.isArray(files)) {
            const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
            
            if (statsFiles) statsFiles.textContent = files.length.toString();
            if (statsSize) statsSize.textContent = formatFileSize(totalSize);
        }
    } catch (error) {
        console.error('[Renderer] Error updating dashboard stats:', error);
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showToast(message, type = 'info') {
    console.log(`[Renderer] Toast: ${type.toUpperCase()} - ${message}`);
    
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        max-width: 400px;
        background-color: ${
            type === 'success' ? '#059669' :
            type === 'error' ? '#dc2626' :
            type === 'warning' ? '#d97706' :
            '#2563eb'
        };
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

// Make functions globally available for onclick handlers
window.removeFileFromSelection = removeFileFromSelection;

console.log('[Renderer] Renderer script loaded successfully!'); 