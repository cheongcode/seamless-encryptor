// Enhanced Google Drive Interface - cloud.js

// State Management
let currentView = 'grid';
let currentFolderId = 'root';
let currentFolderName = 'My Drive';
let folderHistory = [];
let selectedFiles = new Set();
let isConnected = false;
let searchQuery = '';
let nextPageToken = null;

// DOM Elements
const elements = {
    // Connection
    connectBtn: document.getElementById('connect-gdrive'),
    disconnectBtn: document.getElementById('disconnect-gdrive'),
    connectionStatus: document.getElementById('connection-status'),
    statusIndicator: document.getElementById('status-indicator'),
    connectionText: document.getElementById('connection-text'),
    connectionSubtext: document.getElementById('connection-subtext'),
    
    // Auth
    authSection: document.getElementById('gdrive-auth-code-section'),
    authInput: document.getElementById('gdrive-auth-code'),
    authSubmit: document.getElementById('submit-gdrive-auth-code'),
    
    // Navigation
    breadcrumb: document.getElementById('gdrive-breadcrumb'),
    searchInput: document.getElementById('gdrive-search-input'),
    
    // Views
    gridViewBtn: document.getElementById('grid-view-btn'),
    listViewBtn: document.getElementById('list-view-btn'),
    gridContainer: document.getElementById('gdrive-grid'),
    listContainer: document.getElementById('gdrive-list'),
    listBody: document.getElementById('gdrive-list-body'),
    
    // Upload
    newUploadBtn: document.getElementById('new-upload-btn'),
    uploadArea: document.getElementById('gdrive-upload-area'),
    fileInput: document.getElementById('gdrive-file-input'),
    hiddenFileInput: document.getElementById('hidden-file-input'),
    
    // States
    loadingState: document.getElementById('gdrive-loading'),
    emptyState: document.getElementById('gdrive-empty'),
    
    // Context menu
    contextMenu: document.getElementById('gdrive-context-menu'),
    
    // Status
    statusInfo: document.getElementById('gdrive-status-info'),
    selectionInfo: document.getElementById('gdrive-selection-info'),
    
    // Sidebar
    sidebarItems: document.querySelectorAll('.sidebar-item')
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Cloud] Initializing Google Drive interface...');
    await initializeInterface();
    setupEventListeners();
    checkConnectionStatus();
});

// Initialize the interface
async function initializeInterface() {
    showLoading(true);
    updateStatusBar('Initializing...');
    
    // Hide file areas initially
    elements.gridContainer.style.display = 'none';
    elements.listContainer.style.display = 'none';
    elements.emptyState.style.display = 'none';
    
    showLoading(false);
    updateStatusBar('Ready - Connect to Google Drive to get started');
}

// Setup all event listeners
function setupEventListeners() {
    // Connection events
    elements.connectBtn?.addEventListener('click', handleConnect);
    elements.disconnectBtn?.addEventListener('click', handleDisconnect);
    elements.authSubmit?.addEventListener('click', handleAuthSubmit);
    
    // View toggle events
    elements.gridViewBtn?.addEventListener('click', () => switchView('grid'));
    elements.listViewBtn?.addEventListener('click', () => switchView('list'));
    
    // Upload events
    elements.newUploadBtn?.addEventListener('click', triggerFileSelect);
    elements.uploadArea?.addEventListener('click', triggerFileSelect);
    elements.fileInput?.addEventListener('change', handleFileUpload);
    elements.hiddenFileInput?.addEventListener('change', handleFileUpload);
    
    // Search events
    elements.searchInput?.addEventListener('input', debounce(handleSearch, 300));
    elements.searchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    // Drag and drop events
    setupDragAndDrop();
    
    // Context menu events
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Sidebar navigation
    elements.sidebarItems.forEach(item => {
        item.addEventListener('click', () => handleSidebarClick(item));
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Connection Management
async function handleConnect() {
    try {
        updateStatusBar('Connecting to Google Drive...');
        
        if (!window.cloudApi?.connectGDrive) {
            throw new Error('Cloud API not available');
        }
        
        const result = await window.cloudApi.connectGDrive();
        
        if (result?.success && result.authUrl) {
            // Open auth URL
            if (window.api?.openExternalUrl) {
                await window.api.openExternalUrl(result.authUrl);
            }
            
            // Show auth code input
            elements.authSection?.classList.remove('hidden');
            updateStatusBar('Waiting for authorization code...');
            showToast('Please complete authorization in your browser and enter the code below', 'info');
        } else if (result?.needsSetup) {
            // Show setup instructions
            showSetupInstructions(result.error);
            updateStatusBar('Google Drive setup required');
        } else {
            throw new Error(result?.error || 'Failed to get authorization URL');
        }
    } catch (error) {
        console.error('[Cloud] Connection error:', error);
        updateStatusBar('Connection failed');
        showToast(`Connection failed: ${error.message}`, 'error');
    }
}

async function handleAuthSubmit() {
    const authCode = elements.authInput?.value?.trim();
    
    if (!authCode) {
        showToast('Please enter the authorization code', 'warning');
        return;
    }
    
    try {
        updateStatusBar('Exchanging authorization code...');
        
        const result = await window.cloudApi.exchangeGDriveAuthCode(authCode);
        
        if (result?.success) {
            isConnected = true;
            updateConnectionStatus(true, result.email);
            elements.authSection?.classList.add('hidden');
            await loadFiles();
            showToast(`Connected to Google Drive as ${result.email}`, 'success');
        } else {
            throw new Error(result?.error || 'Failed to exchange authorization code');
        }
    } catch (error) {
        console.error('[Cloud] Auth error:', error);
        showToast(`Authorization failed: ${error.message}`, 'error');
    }
}

async function handleDisconnect() {
    try {
        updateStatusBar('Disconnecting...');
        
        if (window.cloudApi?.disconnectGDrive) {
            await window.cloudApi.disconnectGDrive();
        }
        
        isConnected = false;
        updateConnectionStatus(false);
        clearFileDisplay();
        resetNavigation();
        showToast('Disconnected from Google Drive', 'info');
    } catch (error) {
        console.error('[Cloud] Disconnect error:', error);
        showToast(`Disconnect failed: ${error.message}`, 'error');
    }
}

// Connection status management
function updateConnectionStatus(connected, email = null) {
    isConnected = connected;
    
    if (connected) {
        elements.connectionStatus?.classList.remove('disconnected');
        elements.connectionStatus?.classList.add('connected');
        elements.statusIndicator?.classList.add('connected');
        elements.connectBtn?.classList.add('hidden');
        elements.disconnectBtn?.classList.remove('hidden');
        
        if (elements.connectionText) {
            elements.connectionText.textContent = `Connected to Google Drive`;
        }
        if (elements.connectionSubtext && email) {
            elements.connectionSubtext.textContent = email;
        }
        
        updateStatusBar('Connected - Loading files...');
    } else {
        elements.connectionStatus?.classList.remove('connected');
        elements.connectionStatus?.classList.add('disconnected');
        elements.statusIndicator?.classList.remove('connected');
        elements.connectBtn?.classList.remove('hidden');
        elements.disconnectBtn?.classList.add('hidden');
        
        if (elements.connectionText) {
            elements.connectionText.textContent = 'Not connected to Google Drive';
        }
        if (elements.connectionSubtext) {
            elements.connectionSubtext.textContent = 'Connect to access your files';
        }
        
        updateStatusBar('Ready - Connect to Google Drive to get started');
    }
}

async function checkConnectionStatus() {
    try {
        if (!window.cloudApi?.getGDriveStatus) return;
        
        const status = await window.cloudApi.getGDriveStatus();
        
        if (status?.connected) {
            isConnected = true;
            updateConnectionStatus(true, status.email);
            await loadFiles();
        }
    } catch (error) {
        console.error('[Cloud] Status check error:', error);
    }
}

// File loading and display
async function loadFiles(folderId = currentFolderId, append = false) {
    if (!isConnected) return;
    
    try {
        showLoading(true);
        updateStatusBar('Loading files...');
        
        const params = {
            parentFolderId: folderId === 'root' ? null : folderId,
            pageToken: append ? nextPageToken : null
        };
        
        if (searchQuery) {
            params.q = searchQuery;
        }
        
        const result = await window.cloudApi.listGDriveFiles(params);
        
        if (result?.success) {
            nextPageToken = result.nextPageToken;
            
            if (!append) {
                clearFileDisplay();
                currentFolderId = folderId;
                updateBreadcrumb();
            }
            
            displayFiles(result.files, append);
            updateStatusBar(`${result.files.length} items`);
        } else {
            throw new Error(result?.error || 'Failed to load files');
        }
    } catch (error) {
        console.error('[Cloud] Load files error:', error);
        showToast(`Failed to load files: ${error.message}`, 'error');
        updateStatusBar('Error loading files');
        showEmptyState();
    } finally {
        showLoading(false);
    }
}

// File display functions
function displayFiles(files, append = false) {
    if (!files || files.length === 0) {
        if (!append) showEmptyState();
        return;
    }
    
    hideEmptyState();
    
    if (currentView === 'grid') {
        displayFilesGrid(files, append);
    } else {
        displayFilesList(files, append);
    }
    
    updateSelectionInfo();
}

function displayFilesGrid(files, append = false) {
    if (!append) {
        elements.gridContainer.innerHTML = '';
    }
    
    elements.gridContainer.style.display = 'grid';
    elements.listContainer.style.display = 'none';
    
    files.forEach(file => {
        const fileCard = createFileCard(file);
        elements.gridContainer.appendChild(fileCard);
    });
}

function displayFilesList(files, append = false) {
    if (!append) {
        elements.listBody.innerHTML = '';
    }
    
    elements.listContainer.style.display = 'block';
    elements.gridContainer.style.display = 'none';
    
    files.forEach(file => {
        const fileRow = createFileRow(file);
        elements.listBody.appendChild(fileRow);
    });
}

function createFileCard(file) {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    const isEncrypted = file.name.endsWith('.etcr');
    
    const card = document.createElement('div');
    card.className = 'gdrive-file-card';
    card.dataset.fileId = file.id;
    card.dataset.fileName = file.name;
    card.dataset.mimeType = file.mimeType;
    
    // Double-click for folders, single click for selection
    if (isFolder) {
        card.addEventListener('dblclick', () => navigateToFolder(file.id, file.name));
    }
    
    card.addEventListener('click', (e) => handleFileClick(e, file));
    card.addEventListener('contextmenu', (e) => showContextMenu(e, file));
    
    card.innerHTML = `
        <div class="gdrive-file-icon">
            <span class="material-icons">${getFileIcon(file)}</span>
        </div>
        <div class="gdrive-file-name" title="${file.name}">${file.name}</div>
        <div class="gdrive-file-meta">
            <span>${formatDate(file.modifiedTime)}</span>
            <span>${formatFileSize(file.size)}</span>
        </div>
        ${isEncrypted ? '<div class="gdrive-encryption-badge">ENCRYPTED</div>' : ''}
    `;
    
    return card;
}

function createFileRow(file) {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    const isEncrypted = file.name.endsWith('.etcr');
    
    const row = document.createElement('tr');
    row.dataset.fileId = file.id;
    row.dataset.fileName = file.name;
    row.dataset.mimeType = file.mimeType;
    
    if (isFolder) {
        row.addEventListener('dblclick', () => navigateToFolder(file.id, file.name));
    }
    
    row.addEventListener('click', (e) => handleFileClick(e, file));
    row.addEventListener('contextmenu', (e) => showContextMenu(e, file));
    
    row.innerHTML = `
        <td>
            <span class="material-icons">${getFileIcon(file)}</span>
        </td>
        <td>
            <div style="display: flex; align-items: center; gap: 8px;">
                ${file.name}
                ${isEncrypted ? '<span class="gdrive-encryption-badge">ENCRYPTED</span>' : ''}
            </div>
        </td>
        <td>${formatDate(file.modifiedTime)}</td>
        <td>${formatFileSize(file.size)}</td>
        <td>
            <span class="material-icons cursor-pointer hover:text-blue-400" onclick="showFileOptions(event, '${file.id}')">more_vert</span>
        </td>
    `;
    
    return row;
}

// Navigation functions
function navigateToFolder(folderId, folderName) {
    if (folderId === currentFolderId) return;
    
    // Add current folder to history
    folderHistory.push({
        id: currentFolderId,
        name: currentFolderName
    });
    
    currentFolderId = folderId;
    currentFolderName = folderName;
    selectedFiles.clear();
    
    loadFiles(folderId);
}

function navigateUp() {
    if (folderHistory.length === 0) return;
    
    const previousFolder = folderHistory.pop();
    currentFolderId = previousFolder.id;
    currentFolderName = previousFolder.name;
    selectedFiles.clear();
    
    loadFiles(currentFolderId);
}

function updateBreadcrumb() {
    if (!elements.breadcrumb) return;
    
    elements.breadcrumb.innerHTML = `
        <span class="material-icons">folder</span>
        <span class="gdrive-breadcrumb-item ${folderHistory.length === 0 ? 'current' : ''}" data-id="root" onclick="navigateToRoot()">My Drive</span>
    `;
    
    // Add folder history
    folderHistory.forEach((folder, index) => {
        elements.breadcrumb.innerHTML += `
            <span class="material-icons">chevron_right</span>
            <span class="gdrive-breadcrumb-item" data-id="${folder.id}" onclick="navigateToFolder('${folder.id}', '${folder.name}')">${folder.name}</span>
        `;
    });
    
    // Add current folder
    if (folderHistory.length > 0) {
        elements.breadcrumb.innerHTML += `
            <span class="material-icons">chevron_right</span>
            <span class="gdrive-breadcrumb-item current" data-id="${currentFolderId}">${currentFolderName}</span>
        `;
    }
}

function navigateToRoot() {
    currentFolderId = 'root';
    currentFolderName = 'My Drive';
    folderHistory = [];
    selectedFiles.clear();
    loadFiles('root');
}

// View switching
function switchView(view) {
    currentView = view;
    
    elements.gridViewBtn?.classList.toggle('active', view === 'grid');
    elements.listViewBtn?.classList.toggle('active', view === 'list');
    
    if (view === 'grid') {
        elements.gridContainer.style.display = 'grid';
        elements.listContainer.style.display = 'none';
    } else {
        elements.gridContainer.style.display = 'none';
        elements.listContainer.style.display = 'block';
    }
    
    updateStatusBar(`View: ${view} | ${elements.gridContainer.children.length + elements.listBody.children.length} items`);
}

// File operations
async function handleFileClick(event, file) {
    event.stopPropagation();
    
    const fileElement = event.currentTarget;
    const isSelected = selectedFiles.has(file.id);
    
    if (event.ctrlKey || event.metaKey) {
        // Multi-select
        if (isSelected) {
            selectedFiles.delete(file.id);
            fileElement.classList.remove('selected');
        } else {
            selectedFiles.add(file.id);
            fileElement.classList.add('selected');
        }
    } else {
        // Single select
        clearSelection();
        selectedFiles.add(file.id);
        fileElement.classList.add('selected');
    }
    
    updateSelectionInfo();
}

function clearSelection() {
    selectedFiles.clear();
    document.querySelectorAll('.gdrive-file-card, .gdrive-list-table tr').forEach(el => {
        el.classList.remove('selected');
    });
    updateSelectionInfo();
}

// Context menu
function showContextMenu(event, file) {
    event.preventDefault();
    event.stopPropagation();
    
    const menu = elements.contextMenu;
    if (!menu) return;
    
    // Update context menu based on file type
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    const isEncrypted = file.name.endsWith('.etcr');
    
    // Show/hide menu items based on file type
    const encryptItem = menu.querySelector('[data-action="encrypt"]');
    const decryptItem = menu.querySelector('[data-action="decrypt"]');
    
    if (encryptItem) encryptItem.style.display = isFolder ? 'none' : 'flex';
    if (decryptItem) decryptItem.style.display = isEncrypted ? 'flex' : 'none';
    
    // Position and show menu
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
    menu.style.display = 'block';
    
    // Store current file for actions
    menu.dataset.fileId = file.id;
    menu.dataset.fileName = file.name;
    menu.dataset.mimeType = file.mimeType;
    
    // Setup action handlers
    setupContextMenuActions();
}

function setupContextMenuActions() {
    const menu = elements.contextMenu;
    if (!menu) return;
    
    menu.querySelectorAll('.gdrive-context-item').forEach(item => {
        item.onclick = async (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            const fileId = menu.dataset.fileId;
            const fileName = menu.dataset.fileName;
            const mimeType = menu.dataset.mimeType;
            
            hideContextMenu();
            
            try {
                switch (action) {
                    case 'download':
                        await downloadFile(fileId, fileName);
                        break;
                    case 'encrypt':
                        await encryptAndUpload(fileId, fileName);
                        break;
                    case 'decrypt':
                        await decryptAndDownload(fileId, fileName);
                        break;
                    case 'rename':
                        await renameFile(fileId, fileName);
                        break;
                    case 'delete':
                        await deleteFile(fileId, fileName);
                        break;
                }
            } catch (error) {
                console.error(`[Cloud] ${action} error:`, error);
                showToast(`${action} failed: ${error.message}`, 'error');
            }
        };
    });
}

function hideContextMenu() {
    if (elements.contextMenu) {
        elements.contextMenu.style.display = 'none';
    }
}

// File operations implementation
async function downloadFile(fileId, fileName) {
    updateStatusBar(`Downloading ${fileName}...`);
    
    try {
        const result = await window.cloudApi.downloadGDriveFile({ fileId, fileName });
        
        if (result?.success) {
            showToast(`Downloaded ${fileName}`, 'success');
            updateStatusBar('Ready');
        } else {
            throw new Error(result?.error || 'Download failed');
        }
    } catch (error) {
        updateStatusBar('Ready');
        throw error;
    }
}

async function encryptAndUpload(fileId, fileName) {
    updateStatusBar(`Encrypting and uploading ${fileName}...`);
    
    try {
        // First download the file
        const downloadResult = await window.cloudApi.downloadGDriveFile({ fileId, fileName });
        
        if (!downloadResult?.success) {
            throw new Error('Failed to download file for encryption');
        }
        
        // Then encrypt it
        const encryptResult = await window.api.encryptFile(downloadResult.filePath, 'aes-256-gcm');
        
        if (!encryptResult?.success) {
            throw new Error('Failed to encrypt file');
        }
        
        // Upload to vault with password protection
        const password = await promptForPassword('Enter password for DEK backup (optional):');
        const uploadResult = await window.cloudApi.uploadToVault({
            fileId: encryptResult.fileId,
            fileName: fileName,
            password: password
        });
        
        if (uploadResult?.success) {
            showToast(`Encrypted and uploaded ${fileName}`, 'success');
            await loadFiles(); // Refresh file list
        } else {
            throw new Error(uploadResult?.error || 'Upload failed');
        }
        
        updateStatusBar('Ready');
    } catch (error) {
        updateStatusBar('Ready');
        throw error;
    }
}

async function decryptAndDownload(fileId, fileName) {
    updateStatusBar(`Decrypting and downloading ${fileName}...`);
    
    try {
        // Download and decrypt the .etcr file
        const result = await window.api.decryptFile({ fileId: fileId });
        
        if (result?.success) {
            showToast(`Decrypted and downloaded ${fileName}`, 'success');
            updateStatusBar('Ready');
        } else {
            throw new Error(result?.error || 'Decryption failed');
        }
    } catch (error) {
        updateStatusBar('Ready');
        throw error;
    }
}

// Utility functions
function getFileIcon(file) {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    const isEncrypted = file.name.endsWith('.etcr');
    
    if (isFolder) return 'folder';
    if (isEncrypted) return 'lock';
    
    // Determine icon based on mime type
    const mimeType = file.mimeType || '';
    
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video_file';
    if (mimeType.startsWith('audio/')) return 'audio_file';
    if (mimeType.includes('pdf')) return 'picture_as_pdf';
    if (mimeType.includes('document')) return 'description';
    if (mimeType.includes('spreadsheet')) return 'table_chart';
    if (mimeType.includes('presentation')) return 'slideshow';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive';
    
    return 'insert_drive_file';
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
}

function formatFileSize(size) {
    if (!size || size === '0') return '';
    
    const bytes = parseInt(size);
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// UI state management
function showLoading(show) {
    if (elements.loadingState) {
        elements.loadingState.style.display = show ? 'block' : 'none';
    }
}

function showEmptyState() {
    if (elements.emptyState) {
        elements.emptyState.style.display = 'block';
    }
    if (elements.gridContainer) {
        elements.gridContainer.style.display = 'none';
    }
    if (elements.listContainer) {
        elements.listContainer.style.display = 'none';
    }
}

function hideEmptyState() {
    if (elements.emptyState) {
        elements.emptyState.style.display = 'none';
    }
}

function clearFileDisplay() {
    if (elements.gridContainer) {
        elements.gridContainer.innerHTML = '';
    }
    if (elements.listBody) {
        elements.listBody.innerHTML = '';
    }
    selectedFiles.clear();
}

function resetNavigation() {
    currentFolderId = 'root';
    currentFolderName = 'My Drive';
    folderHistory = [];
    searchQuery = '';
    
    if (elements.searchInput) {
        elements.searchInput.value = '';
    }
    
    updateBreadcrumb();
}

function updateStatusBar(message) {
    if (elements.statusInfo) {
        elements.statusInfo.textContent = message;
    }
}

function updateSelectionInfo() {
    if (!elements.selectionInfo) return;
    
    const count = selectedFiles.size;
    if (count === 0) {
        elements.selectionInfo.textContent = '';
    } else if (count === 1) {
        elements.selectionInfo.textContent = '1 item selected';
    } else {
        elements.selectionInfo.textContent = `${count} items selected`;
    }
}

// Search functionality
function handleSearch() {
    searchQuery = elements.searchInput?.value?.trim() || '';
    updateStatusBar(searchQuery ? `Searching for "${searchQuery}"...` : 'Loading files...');
    loadFiles(currentFolderId);
}

// Upload functionality
function triggerFileSelect() {
    if (!isConnected) {
        showToast('Please connect to Google Drive first', 'warning');
        return;
    }
    
    elements.hiddenFileInput?.click();
}

async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    updateStatusBar('Preparing files for upload...');
    
    try {
        for (const file of files) {
            await uploadAndEncryptFile(file);
        }
        
        showToast(`Uploaded ${files.length} file(s)`, 'success');
        await loadFiles(); // Refresh file list
    } catch (error) {
        console.error('[Cloud] Upload error:', error);
        showToast(`Upload failed: ${error.message}`, 'error');
    } finally {
        updateStatusBar('Ready');
        event.target.value = ''; // Clear file input
    }
}

async function uploadAndEncryptFile(file) {
    updateStatusBar(`Encrypting ${file.name}...`);
    
    // Create temporary file path
    const tempPath = await saveFileTemporarily(file);
    
    try {
        // Encrypt the file
        const encryptResult = await window.api.encryptFile(tempPath, 'aes-256-gcm');
        
        if (!encryptResult?.success) {
            throw new Error('Failed to encrypt file');
        }
        
        // Get password for DEK backup (optional)
        const usePassword = await confirmPrompt('Create password-protected backup of encryption key?');
        let password = null;
        
        if (usePassword) {
            password = await promptForPassword('Enter password for key backup:');
        }
        
        // Upload to vault
        updateStatusBar(`Uploading ${file.name}...`);
        const uploadResult = await window.cloudApi.uploadToVault({
            fileId: encryptResult.fileId,
            fileName: file.name,
            password: password
        });
        
        if (!uploadResult?.success) {
            throw new Error(uploadResult?.error || 'Upload failed');
        }
        
    } finally {
        // Clean up temporary file
        try {
            await window.api.deleteFile(tempPath);
        } catch (cleanupError) {
            console.warn('[Cloud] Cleanup error:', cleanupError);
        }
    }
}

// Drag and drop functionality
function setupDragAndDrop() {
    const dropZones = [elements.uploadArea, elements.gridContainer, elements.listContainer];
    
    dropZones.forEach(zone => {
        if (!zone) return;
        
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });
        
        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
        });
        
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                handleFileDrop(files);
            }
        });
    });
}

async function handleFileDrop(files) {
    if (!isConnected) {
        showToast('Please connect to Google Drive first', 'warning');
        return;
    }
    
    updateStatusBar(`Processing ${files.length} dropped file(s)...`);
    
    try {
        for (const file of files) {
            await uploadAndEncryptFile(file);
        }
        
        showToast(`Uploaded ${files.length} file(s)`, 'success');
        await loadFiles(); // Refresh file list
    } catch (error) {
        console.error('[Cloud] Drop upload error:', error);
        showToast(`Upload failed: ${error.message}`, 'error');
    } finally {
        updateStatusBar('Ready');
    }
}

// Sidebar navigation
function handleSidebarClick(item) {
    // Remove active class from all items
    elements.sidebarItems.forEach(i => i.classList.remove('active'));
    
    // Add active class to clicked item
    item.classList.add('active');
    
    const type = item.dataset.type;
    
    switch (type) {
        case 'my-drive':
            navigateToRoot();
            break;
        case 'encrypted-vault':
            navigateToEncryptedVault();
            break;
        case 'shared':
            loadSharedFiles();
            break;
        case 'recent':
            loadRecentFiles();
            break;
    }
}

async function navigateToEncryptedVault() {
    try {
        updateStatusBar('Loading encrypted vault...');
        
        const vaultInfo = await window.cloudApi.getVaultInfo();
        
        if (vaultInfo?.success) {
            // Navigate to the user's vault folder
            navigateToFolder(vaultInfo.vaultInfo.folders.user, 'Encrypted Vault');
        } else {
            throw new Error(vaultInfo?.error || 'Failed to access vault');
        }
    } catch (error) {
        console.error('[Cloud] Vault navigation error:', error);
        showToast(`Failed to access vault: ${error.message}`, 'error');
    }
}

// Keyboard shortcuts
function handleKeyboardShortcuts(event) {
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'a':
                event.preventDefault();
                selectAll();
                break;
            case 'u':
                event.preventDefault();
                triggerFileSelect();
                break;
            case 'f':
                event.preventDefault();
                elements.searchInput?.focus();
                break;
        }
    }
    
    switch (event.key) {
        case 'Escape':
            clearSelection();
            hideContextMenu();
            break;
        case 'Delete':
            if (selectedFiles.size > 0) {
                deleteSelectedFiles();
            }
            break;
    }
}

function selectAll() {
    selectedFiles.clear();
    
    const fileElements = document.querySelectorAll('.gdrive-file-card, .gdrive-list-table tr[data-file-id]');
    fileElements.forEach(el => {
        const fileId = el.dataset.fileId;
        if (fileId) {
            selectedFiles.add(fileId);
            el.classList.add('selected');
        }
    });
    
    updateSelectionInfo();
}

// Helper functions
async function saveFileTemporarily(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = new Uint8Array(e.target.result);
                const tempPath = await window.api.saveTemporaryFile(file.name, buffer);
                resolve(tempPath);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

async function promptForPassword(message) {
    return new Promise((resolve) => {
        const password = prompt(message);
        resolve(password);
    });
}

async function confirmPrompt(message) {
    return confirm(message);
}

function showToast(message, type = 'info') {
    // Create and show toast notification
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-4 py-2 rounded-lg text-white z-50 ${
        type === 'success' ? 'bg-green-600' :
        type === 'error' ? 'bg-red-600' :
        type === 'warning' ? 'bg-yellow-600' :
        'bg-blue-600'
    }`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        document.body.removeChild(toast);
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Setup instructions for Google Drive API
function showSetupInstructions(error) {
    const isOAuthError = error.includes('OAuth') || error.includes('invalid_request') || error.includes('Access blocked');
    
    const setupHTML = `
        <div class="bg-red-900 border border-red-600 rounded-lg p-6 mx-6 mb-4">
            <div class="flex items-start gap-3">
                <span class="material-icons text-red-400 text-2xl">${isOAuthError ? 'security' : 'info'}</span>
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-red-200 mb-2">${isOAuthError ? 'OAuth Compliance Issue Detected' : 'Google Drive Setup Required'}</h3>
                    <p class="text-red-100 mb-4">${error}</p>
                    <div class="bg-red-800 rounded p-4 mb-4">
                        <h4 class="font-semibold text-red-200 mb-2">${isOAuthError ? 'OAuth Fix Required:' : 'Quick Setup Steps:'}</h4>
                        ${isOAuthError ? `
                        <ol class="list-decimal list-inside space-y-1 text-sm text-red-100">
                            <li>Configure OAuth consent screen in Google Cloud Console</li>
                            <li>Fill ALL required fields (app name, support email, privacy policy)</li>
                            <li>Add your email as a test user</li>
                            <li>Set proper scopes: drive.file, drive.readonly, userinfo.email</li>
                            <li>Create desktop OAuth credentials</li>
                            <li>Update .env file with real credentials</li>
                            <li>Restart application</li>
                        </ol>
                        ` : `
                        <ol class="list-decimal list-inside space-y-1 text-sm text-red-100">
                            <li>Go to <a href="#" onclick="window.api?.openExternalUrl('https://console.cloud.google.com/apis/credentials')" class="text-red-300 underline">Google Cloud Console</a></li>
                            <li>Create a new project or select existing</li>
                            <li>Enable Google Drive API</li>
                            <li>Configure OAuth consent screen (CRITICAL)</li>
                            <li>Create OAuth 2.0 credentials (Desktop application)</li>
                            <li>Copy Client ID and Client Secret to your .env file</li>
                            <li>Restart the application</li>
                        </ol>
                        `}
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <button onclick="window.api?.openExternalUrl('https://console.cloud.google.com/apis/consent')" 
                                class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm">
                            ${isOAuthError ? 'Fix OAuth Consent Screen' : 'Configure OAuth'}
                        </button>
                        <button onclick="window.api?.openExternalUrl('https://console.cloud.google.com/apis/credentials')" 
                                class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm">
                            Create Credentials
                        </button>
                        <button onclick="showDetailedSetupGuide()" 
                                class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">
                            ${isOAuthError ? 'View OAuth Guide' : 'View Setup Guide'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Insert setup instructions after connection status
    const connectionStatus = elements.connectionStatus;
    if (connectionStatus && connectionStatus.nextElementSibling) {
        // Remove existing setup instructions
        const existingInstructions = document.getElementById('google-setup-instructions');
        if (existingInstructions) {
            existingInstructions.remove();
        }
        
        const setupDiv = document.createElement('div');
        setupDiv.innerHTML = setupHTML;
        setupDiv.id = 'google-setup-instructions';
        connectionStatus.parentNode.insertBefore(setupDiv.firstElementChild, connectionStatus.nextElementSibling);
    }
}

// Show detailed setup guide
function showDetailedSetupGuide() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-white">OAuth 2.0 Setup Guide</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="text-gray-300 space-y-4">
                <div class="bg-yellow-900 border border-yellow-600 rounded p-4">
                    <h3 class="font-semibold text-yellow-200 mb-2">🚨 OAuth Compliance Required</h3>
                    <p class="text-yellow-100">Google now requires proper OAuth consent screen configuration. Follow these exact steps:</p>
                </div>
                
                <div class="space-y-3">
                    <h4 class="font-semibold text-blue-300">Step 1: Configure OAuth Consent Screen</h4>
                    <ol class="list-decimal list-inside space-y-2 text-sm ml-4">
                        <li>Go to <a href="#" onclick="window.api?.openExternalUrl('https://console.cloud.google.com/apis/consent')" class="text-blue-400 underline">OAuth Consent Screen</a></li>
                        <li>Choose "External" user type</li>
                        <li>Fill ALL required fields:
                            <ul class="list-disc list-inside ml-4 mt-1">
                                <li>App name: "Seamless Encryptor"</li>
                                <li>User support email: your-email@gmail.com</li>
                                <li>Developer contact: your-email@gmail.com</li>
                            </ul>
                        </li>
                        <li>Add scopes: drive.file, drive.readonly, userinfo.email</li>
                        <li>Add test users: your-email@gmail.com</li>
                    </ol>
                </div>
                
                <div class="space-y-3">
                    <h4 class="font-semibold text-green-300">Step 2: Create OAuth Credentials</h4>
                    <ol class="list-decimal list-inside space-y-2 text-sm ml-4">
                        <li>Go to <a href="#" onclick="window.api?.openExternalUrl('https://console.cloud.google.com/apis/credentials')" class="text-blue-400 underline">Credentials</a></li>
                        <li>Click "Create Credentials" → "OAuth client ID"</li>
                        <li>Choose "Desktop application"</li>
                        <li>Name: "Seamless Encryptor Desktop"</li>
                        <li>Copy Client ID and Client Secret</li>
                    </ol>
                </div>
                
                <div class="space-y-3">
                    <h4 class="font-semibold text-purple-300">Step 3: Update .env File</h4>
                    <div class="bg-gray-700 rounded p-3 font-mono text-sm">
                        <div>GOOGLE_CLIENT_ID=your_actual_client_id_here</div>
                        <div>GOOGLE_CLIENT_SECRET=your_actual_client_secret_here</div>
                        <div>DEVELOPER_EMAIL=your-email@gmail.com</div>
                    </div>
                </div>
                
                <div class="bg-green-900 border border-green-600 rounded p-4">
                    <h4 class="font-semibold text-green-200">✅ After Setup</h4>
                    <p class="text-green-100">Restart the application. You may see "This app hasn't been verified" - click "Advanced" → "Go to Seamless Encryptor (unsafe)" to proceed (normal during development).</p>
                </div>
            </div>
            
            <div class="flex justify-center gap-3 mt-6">
                <button onclick="window.api?.openExternalUrl('https://console.cloud.google.com/apis/consent')" 
                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                    Configure OAuth Consent
                </button>
                <button onclick="window.api?.openExternalUrl('./OAUTH_SETUP_GUIDE.md')" 
                        class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">
                    Full Documentation
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Show info about mixed source files
function showMixedSourceInfo(data) {
    const legacyCount = data.files.filter(f => f.source === 'legacy').length;
    const vaultCount = data.files.filter(f => f.source === 'vault').length;
    
    const infoHTML = `
        <div class="bg-blue-900 border border-blue-600 rounded-lg p-4 mx-6 mb-4" id="mixed-source-info">
            <div class="flex items-start gap-3">
                <span class="material-icons text-blue-400">info</span>
                <div class="flex-1">
                    <h4 class="font-semibold text-blue-200 mb-2">Files from Multiple Sources</h4>
                    <p class="text-blue-100 text-sm mb-3">
                        Showing ${legacyCount} files from your legacy folder and ${vaultCount} files from the new vault structure.
                    </p>
                    <div class="flex gap-2">
                        <button onclick="migrateFromLegacy()" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                            Migrate Legacy Files
                        </button>
                        <button onclick="this.closest('#mixed-source-info').remove()" class="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm">
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Insert after connection status
    const connectionStatus = elements.connectionStatus;
    if (connectionStatus) {
        const existingInfo = document.getElementById('mixed-source-info');
        if (existingInfo) existingInfo.remove();
        
        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = infoHTML;
        connectionStatus.parentNode.insertBefore(infoDiv.firstElementChild, connectionStatus.nextElementSibling);
    }
}

// Show info about legacy-only files
function showLegacyOnlyInfo(data) {
    const legacyCount = data.files.length;
    
    const infoHTML = `
        <div class="bg-yellow-900 border border-yellow-600 rounded-lg p-4 mx-6 mb-4" id="legacy-only-info">
            <div class="flex items-start gap-3">
                <span class="material-icons text-yellow-400">folder</span>
                <div class="flex-1">
                    <h4 class="font-semibold text-yellow-200 mb-2">Legacy Files Detected</h4>
                    <p class="text-yellow-100 text-sm mb-3">
                        Found ${legacyCount} files in your old "SeamlessEncryptor_Files" folder. 
                        These are your existing encrypted files - they work perfectly!
                    </p>
                    <div class="flex gap-2">
                        <button onclick="this.closest('#legacy-only-info').remove()" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                            Got it!
                        </button>
                        <button onclick="showLegacyInfo()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                            Learn More
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Insert after connection status
    const connectionStatus = elements.connectionStatus;
    if (connectionStatus) {
        const existingInfo = document.getElementById('legacy-only-info');
        if (existingInfo) existingInfo.remove();
        
        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = infoHTML;
        connectionStatus.parentNode.insertBefore(infoDiv.firstElementChild, connectionStatus.nextElementSibling);
    }
}

// Show detailed legacy info
function showLegacyInfo() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 max-w-2xl m-4">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-white">Legacy Files Information</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="text-gray-300 space-y-4">
                <div class="bg-green-900 border border-green-600 rounded p-4">
                    <h3 class="font-semibold text-green-200 mb-2">✅ Your Files Are Safe</h3>
                    <p class="text-green-100 text-sm">Your existing encrypted files are fully compatible and accessible. No migration is required.</p>
                </div>
                
                <div class="space-y-2">
                    <h4 class="font-semibold text-blue-300">What's Different:</h4>
                    <ul class="list-disc list-inside space-y-1 text-sm ml-4">
                        <li><strong>Legacy:</strong> Files stored in "SeamlessEncryptor_Files" folder</li>
                        <li><strong>New:</strong> Files organized in date-based vault structure</li>
                        <li><strong>Compatibility:</strong> Both formats work perfectly!</li>
                    </ul>
                </div>
                
                <div class="bg-blue-900 border border-blue-600 rounded p-4">
                    <h4 class="font-semibold text-blue-200">Recommended Action:</h4>
                    <p class="text-blue-100 text-sm">Continue using your existing files. New uploads will use the improved vault structure automatically.</p>
                </div>
            </div>
            
            <div class="flex justify-center mt-6">
                <button onclick="this.closest('.fixed').remove()" 
                        class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded">
                    Got it!
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Migrate files from legacy folder to new vault (placeholder)
async function migrateFromLegacy() {
    if (!confirm('This will move all files from your legacy folder to the new organized vault structure. Continue?')) {
        return;
    }
    
    showToast('Migration feature coming soon! For now, both folders are accessible.', 'info');
    // TODO: Implement actual migration logic
}

// Update the loadFiles function to show folder type notifications
const originalLoadFiles = loadFiles;
function loadFiles() {
    originalLoadFiles();
    
    // Clear any existing source info when loading
    const existingInfo = document.querySelector('#mixed-source-info, #legacy-only-info');
    if (existingInfo) existingInfo.remove();
}

// Export functions for global access
window.gdriveInterface = {
    navigateToFolder,
    navigateToRoot,
    navigateUp,
    loadFiles,
    switchView,
    clearSelection,
    selectAll
}; 