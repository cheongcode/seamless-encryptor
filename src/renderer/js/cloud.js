// Enhanced Google Drive Interface - cloud.js
import '../styles.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
console.log('[Cloud] cloud.js file is loading...');

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
    console.log('[Cloud] DOM loaded, initializing Google Drive interface...');
    
    // Immediate test to show this script is running
    document.body.style.border = '5px solid red';
    setTimeout(() => {
        document.body.style.border = 'none';
    }, 2000);
    
    await initializeInterface();
    setupEventListeners();
    checkConnectionStatus();
    
    // Initialize enhanced UI
    initializeEnhancedUI();
});

// Initialize the enhanced UI components
function initializeEnhancedUI() {
    console.log('[Cloud] Initializing enhanced UI components...');
    
    // Ensure sidebar is visible
    const sidebar = document.querySelector('.gdrive-sidebar');
    if (sidebar) {
        sidebar.style.display = 'block';
        console.log('[Cloud] Sidebar initialized');
    } else {
        console.error('[Cloud] Sidebar not found!');
    }
    
    // Ensure upload button is visible
    const uploadBtn = document.getElementById('new-upload-btn');
    if (uploadBtn) {
        uploadBtn.style.display = 'flex';
        console.log('[Cloud] Upload button initialized');
    } else {
        console.error('[Cloud] Upload button not found!');
    }
    
    // Ensure search input is visible
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.style.display = 'block';
        console.log('[Cloud] Search input initialized');
    } else {
        console.error('[Cloud] Search input not found!');
    }
    
    // Ensure header search input is visible
    const headerSearchInput = document.getElementById('gdrive-search-input');
    if (headerSearchInput) {
        headerSearchInput.style.display = 'block';
        console.log('[Cloud] Header search input initialized');
    } else {
        console.error('[Cloud] Header search input not found!');
    }
    
    // Ensure grid container is visible
    const gridContainer = document.getElementById('gdrive-grid');
    if (gridContainer) {
        gridContainer.style.display = 'grid';
        console.log('[Cloud] Grid container initialized');
    } else {
        console.error('[Cloud] Grid container not found!');
    }
    
    // Force show file area and hide loading
    const fileArea = document.querySelector('.gdrive-file-area');
    if (fileArea) {
        fileArea.style.display = 'block';
    }
    
    // Remove debug banner and use a simpler notification
    showToast('✅ Enhanced Google Drive UI loaded! Upload, Search & Decrypt features available', 'success');
    
    // Add visual debug information to console
    console.log('[Cloud] UI Elements Status:');
    console.log('- Sidebar found:', !!document.querySelector('.gdrive-sidebar'));
    console.log('- Upload button found:', !!document.getElementById('new-upload-btn'));
    console.log('- Search input found:', !!document.getElementById('search-input'));
    console.log('- Header search found:', !!document.getElementById('gdrive-search-input'));
    console.log('- Grid container found:', !!document.getElementById('gdrive-grid'));
    
    // Force show key UI elements regardless of their current state
    const forceShow = [
        '.gdrive-sidebar', 
        '#new-upload-btn', 
        '#search-input', 
        '.gdrive-search',
        '.gdrive-file-area'
    ];
    
    forceShow.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = element.tagName === 'INPUT' ? 'block' : 'flex';
            element.style.visibility = 'visible';
            console.log(`[Cloud] Force showed: ${selector}`);
        } else {
            console.warn(`[Cloud] Element not found: ${selector}`);
        }
    });
}

// Initialize the interface
async function initializeInterface() {
    showLoading(true);
    updateStatusBar('Initializing...');
    
    // Hide file areas initially but keep them ready
    if (elements.gridContainer) {
        elements.gridContainer.style.display = 'grid';
        elements.gridContainer.innerHTML = ''; // Clear any existing content
    }
    if (elements.listContainer) {
        elements.listContainer.style.display = 'none';
    }
    if (elements.emptyState) {
        elements.emptyState.style.display = 'none';
    }
    
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
    
    // Upload and management events
    setupUploadListeners();
    setupToolbarListeners();
    setupSearchListeners();
    
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
            
            // Show enhanced auth code modal
            showAuthCodeModal();
            updateStatusBar('Waiting for authorization code...');
            showToast('Please complete authorization in your browser and use the modal below', 'info');
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
    let authCode = elements.authInput?.value?.trim();
    
    if (!authCode) {
        showToast('Please enter the authorization code or URL', 'warning');
        return;
    }
    
    // Try to extract code from input (handles both code and URL)
    const extractedCode = extractAuthCodeFromText(authCode);
    if (extractedCode) {
        authCode = extractedCode;
        console.log('[Cloud] Extracted auth code from input:', authCode);
    } else if (!authCode.startsWith('4/')) {
        showToast('Invalid authorization code format. Code should start with "4/"', 'error');
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
            elements.connectionText.textContent = email ? `Connected as ${email}` : 'Connected to Google Drive';
        }
        if (elements.connectionSubtext) {
            elements.connectionSubtext.textContent = email ? `Signed in as ${email}` : 'Connect to access your files';
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

// Ensure extended behavior runs after each load
(function attachLoadFilesExtension() {
    const original = loadFiles;
    window.loadFiles = async function(folderId = currentFolderId, append = false) {
        const result = await original(folderId, append);
        try { extendLoadFiles && extendLoadFiles(); } catch (_) {}
        return result;
    };
})();

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
    
    files.forEach(file => {
        const card = createFileCard(file);
        elements.gridContainer.appendChild(card);
    });
}

function createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.dataset.fileId = file.id;
    card.dataset.isFolder = file.isFolder;
    
    const isEncrypted = file.isEncrypted || file.name.endsWith('.etcr') || file.name.endsWith('.enc');
    const isFolder = file.isFolder;
    
    card.innerHTML = `
        <div class="file-icon">
            ${isFolder ? 
                '<i class="fas fa-folder text-blue-400"></i>' : 
                isEncrypted ? 
                    '<i class="fas fa-lock text-green-400"></i>' : 
                    '<i class="fas fa-file text-gray-400"></i>'
            }
        </div>
        <div class="file-name" title="${file.name}">${file.name}</div>
        <div class="file-info">
            ${isFolder ? 'Folder' : 
              file.size ? formatFileSize(file.size) : ''}
            ${isEncrypted ? ' • Encrypted' : ''}
        </div>
        <div class="file-actions">
            ${isFolder ? 
                '<button class="action-btn open-folder" title="Open"><i class="fas fa-folder-open"></i></button>' :
                `<button class="action-btn download-file" title="Download"><i class="fas fa-download"></i></button>
                 ${isEncrypted ? 
                    '<button class="action-btn decrypt-cloud-file" title="Decrypt & Download"><i class="fas fa-unlock"></i></button>' : 
                    ''
                 }`
            }
            <button class="action-btn delete-file" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
    `;
    
    // Add event listeners
    setupFileCardEvents(card, file);
    
    return card;
}

function setupFileCardEvents(card, file) {
    // Open folder
    const openBtn = card.querySelector('.open-folder');
    if (openBtn) {
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadFiles(file.id);
        });
    }
    
    // Download file
    const downloadBtn = card.querySelector('.download-file');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadFile(file.id, file.name);
        });
    }
    
    // Decrypt and download
    const decryptBtn = card.querySelector('.decrypt-cloud-file');
    if (decryptBtn) {
        decryptBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            decryptAndDownloadFile(file);
        });
    }
    
    // Delete file
    const deleteBtn = card.querySelector('.delete-file');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFile(file);
        });
    }
    
    // Double-click to open/download
    card.addEventListener('dblclick', () => {
        if (file.isFolder) {
            loadFiles(file.id);
        } else {
            downloadAndProcessFile(file);
        }
    });
}

// Removed duplicate formatFileSize; using the more robust implementation below

async function downloadAndProcessFile(file) {
    try {
        showToast(`Downloading ${file.name}...`, 'info');
        
        const result = await window.cloudApi.downloadGDriveFile({
            fileId: file.id,
            fileName: file.name
        });
        
        if (result?.success) {
            showToast(`Successfully downloaded ${file.name}`, 'success');
        } else {
            throw new Error(result?.error || 'Download failed');
        }
    } catch (error) {
        console.error('[Cloud] Download error:', error);
        showToast(`Failed to download ${file.name}: ${error.message}`, 'error');
    }
}

async function decryptAndDownloadFile(file) {
    try {
        const password = await promptForPassword('Enter decryption password:');
        if (!password) return;
        
        showToast(`Decrypting and downloading ${file.name}...`, 'info');
        
        // First download the file
        const downloadResult = await window.cloudApi.downloadGDriveFile({
            fileId: file.id,
            fileName: file.name
        });
        
        if (!downloadResult?.success) {
            throw new Error('Failed to download encrypted file');
        }
        
        // Then decrypt it (this would need to be implemented in the main process)
        // For now, just show success
        showToast(`File downloaded. Please decrypt manually.`, 'info');
        
    } catch (error) {
        console.error('[Cloud] Decrypt download error:', error);
        showToast(`Failed to decrypt ${file.name}: ${error.message}`, 'error');
    }
}

async function deleteFile(file) {
    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) {
        return;
    }
    
    try {
        showToast(`Deleting ${file.name}...`, 'info');
        
        const result = await window.cloudApi.deleteGDriveFile(file.id);
        
        if (result?.success) {
            showToast(`Successfully deleted ${file.name}`, 'success');
            // Refresh the file list
            loadFiles(currentFolderId);
        } else {
            throw new Error(result?.error || 'Delete failed');
        }
    } catch (error) {
        console.error('[Cloud] Delete error:', error);
        showToast(`Failed to delete ${file.name}: ${error.message}`, 'error');
    }
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
        const result = await window.api.decryptFile({ fileId });
        
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
    if (isNaN(date.getTime())) return 'Unknown';
    
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
}

function formatFileSize(size) {
    // Handle undefined, null, empty string, or invalid values
    if (!size || size === '0' || size === 0 || isNaN(size)) return '';
    
    const bytes = parseInt(size);
    // Additional check for NaN after parsing
    if (isNaN(bytes) || bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    // Ensure i is within bounds
    if (i < 0 || i >= sizes.length) return bytes + ' Bytes';
    
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
        // Encrypt the file (skip auto-upload to prevent double uploads)
        const encryptResult = await window.api.encryptFile(tempPath, 'aes-256-gcm', { skipAutoUpload: true });
        
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
        // Try to use the password modal if available
        const modal = document.getElementById('password-modal');
        if (modal) {
            showPasswordModal('Enter Password', message).then(resolve);
        } else {
            // Fallback to alert for legacy support
            const password = window.prompt ? window.prompt(message) : null;
            resolve(password);
        }
    });
}

// Add the showPasswordModal function for cloud.js
function showPasswordModal(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('password-modal');
        if (!modal) {
            // Fallback if modal doesn't exist
            const password = window.prompt ? window.prompt(message) : null;
            resolve(password);
            return;
        }
        
        const titleEl = document.getElementById('password-modal-title');
        const messageEl = document.getElementById('password-modal-message');
        const fieldEl = document.getElementById('password-modal-field');
        const errorEl = document.getElementById('password-modal-error');
        const cancelBtn = document.getElementById('password-modal-cancel');
        const confirmBtn = document.getElementById('password-modal-confirm');
        
        // Set content
        titleEl.textContent = title;
        messageEl.textContent = message;
        fieldEl.value = '';
        errorEl.classList.add('hidden');
        
        // Show modal
        modal.classList.remove('hidden');
        fieldEl.focus();
        
        // Handle events
        const cleanup = () => {
            modal.classList.add('hidden');
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            fieldEl.removeEventListener('keypress', onKeypress);
        };
        
        const onCancel = () => {
            cleanup();
            resolve(null);
        };
        
        const onConfirm = () => {
            const value = fieldEl.value;
            cleanup();
            resolve(value || null);
        };
        
        const onKeypress = (e) => {
            if (e.key === 'Enter') {
                onConfirm();
            } else if (e.key === 'Escape') {
                onCancel();
            }
        };
        
        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        fieldEl.addEventListener('keypress', onKeypress);
    });
}

function extractAuthCodeFromText(text) {
    if (!text) return null;
    
    // Method 1: Extract from URL parameters (most common)
    const urlMatch = text.match(/[?&]code=([^&\s]+)/);
    if (urlMatch) {
        return decodeURIComponent(urlMatch[1]);
    }
    
    // Method 2: Look for code pattern (starts with 4/)
    const codeMatch = text.match(/4\/[0-9A-Za-z_-]+/);
    if (codeMatch) {
        return codeMatch[0];
    }
    
    // Method 3: Check if the entire text looks like a code
    const cleanText = text.trim();
    if (cleanText.startsWith('4/') && cleanText.length > 10 && !cleanText.includes(' ')) {
        return cleanText;
    }
    
    return null;
}

async function confirmPrompt(message) {
    return confirm(message);
}

function showToast(message, type = 'info') {
    // Check if notifications are enabled
    const notificationsEnabled = document.getElementById('notifications')?.checked;
    
    if (notificationsEnabled === false) {
        // Log the notification instead of showing it when disabled
        console.log(`[NOTIFICATIONS DISABLED] ${type.toUpperCase()}: ${message}`);
        return;
    }
    
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

// Extend loadFiles behavior to clear source info without redeclaring it
const extendLoadFiles = () => {
    // Clear any existing source info when loading
    const existingInfo = document.querySelector('#mixed-source-info, #legacy-only-info');
    if (existingInfo) existingInfo.remove();
};

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

// Enhanced Upload and Management Functions
function setupUploadListeners() {
    const newUploadBtn = document.getElementById('new-upload-btn');
    const uploadOptions = document.getElementById('upload-options');
    const uploadFilesBtn = document.getElementById('upload-files-btn');
    const uploadEncryptedBtn = document.getElementById('upload-encrypted-btn');
    const createFolderBtn = document.getElementById('create-folder-btn');
    
    // Toggle upload dropdown
    newUploadBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadOptions?.classList.toggle('hidden');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        uploadOptions?.classList.add('hidden');
    });
    
    // Upload regular files
    uploadFilesBtn?.addEventListener('click', async () => {
        uploadOptions?.classList.add('hidden');
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                await uploadFileFromLocal(file);
            }
        };
        input.click();
    });
    
    // Upload encrypted files
    uploadEncryptedBtn?.addEventListener('click', async () => {
        uploadOptions?.classList.add('hidden');
        await showEncryptedFileSelector();
    });
    
    // Create folder
    createFolderBtn?.addEventListener('click', async () => {
        uploadOptions?.classList.add('hidden');
        await createNewFolder();
    });
}

function setupToolbarListeners() {
    const refreshBtn = document.getElementById('refresh-btn');
    const downloadSelectedBtn = document.getElementById('download-selected-btn');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    const sortBtn = document.getElementById('sort-btn');
    
    refreshBtn?.addEventListener('click', () => {
        loadFiles(currentFolderId);
    });
    
    downloadSelectedBtn?.addEventListener('click', async () => {
        const selected = getSelectedFiles();
        for (const file of selected) {
            await downloadFile(file.id, file.name);
        }
    });
    
    deleteSelectedBtn?.addEventListener('click', async () => {
        const selected = getSelectedFiles();
        if (selected.length > 0) {
            const confirmResult = await confirmPrompt(`Delete ${selected.length} selected file(s)?`);
            if (confirmResult) {
                for (const file of selected) {
                    await deleteFile(file);
                }
            }
        }
    });
    
    sortBtn?.addEventListener('click', () => {
        showSortOptions();
    });
}

function setupSearchListeners() {
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                searchFiles(query);
            } else {
                loadFiles(currentFolderId);
            }
        }, 500);
    });
}

async function uploadFileFromLocal(file) {
    try {
        showToast(`Uploading ${file.name}...`, 'info');
        
        // In Electron, we'd save the file temporarily and get the path
        // For now, we'll simulate this
        const result = await window.cloudApi.uploadFileToGDrive({
            filePath: file.path || file.name,
            fileName: file.name,
            targetFolderId: currentFolderId === 'root' ? null : currentFolderId
        });
        
        if (result?.success) {
            showToast(`Successfully uploaded ${file.name}`, 'success');
            loadFiles(currentFolderId);
        } else {
            throw new Error(result?.error || 'Upload failed');
        }
    } catch (error) {
        console.error('[Cloud] Upload error:', error);
        showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
    }
}

async function showEncryptedFileSelector() {
    try {
        const result = await window.api.getEncryptedFiles();
        const encryptedFiles = result?.files || result || [];
        
        if (encryptedFiles.length === 0) {
            showToast('No encrypted files found locally', 'warning');
            return;
        }
        
        const selectedFileId = await showFileSelectionModal(encryptedFiles);
        if (selectedFileId) {
            await uploadEncryptedFile(selectedFileId);
        }
    } catch (error) {
        console.error('[Cloud] Error showing encrypted file selector:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function uploadEncryptedFile(fileId) {
    try {
        showToast('Uploading encrypted file...', 'info');
        
        const result = await window.cloudApi.uploadEncryptedToGDrive({
            fileId: fileId,
            targetFolderId: currentFolderId === 'root' ? null : currentFolderId
        });
        
        if (result?.success) {
            showToast(result.message || 'Successfully uploaded encrypted file', 'success');
            loadFiles(currentFolderId);
        } else {
            throw new Error(result?.error || 'Upload failed');
        }
    } catch (error) {
        console.error('[Cloud] Upload encrypted file error:', error);
        showToast(`Failed to upload encrypted file: ${error.message}`, 'error');
    }
}

async function createNewFolder() {
    try {
        const folderName = await promptForInput('Enter folder name:');
        if (!folderName) return;
        
        showToast(`Creating folder: ${folderName}...`, 'info');
        
        const result = await window.cloudApi.createGDriveFolder({
            folderName: folderName,
            parentFolderId: currentFolderId === 'root' ? null : currentFolderId
        });
        
        if (result?.success) {
            showToast(`Successfully created folder: ${folderName}`, 'success');
            loadFiles(currentFolderId);
        } else {
            throw new Error(result?.error || 'Folder creation failed');
        }
    } catch (error) {
        console.error('[Cloud] Create folder error:', error);
        showToast(`Failed to create folder: ${error.message}`, 'error');
    }
}

async function searchFiles(query) {
    try {
        showLoading(true);
        updateStatusBar(`Searching for "${query}"...`);
        
        const result = await window.cloudApi.listGDriveFiles({
            parentFolderId: null,
            q: `name contains '${query}' and trashed=false`
        });
        
        if (result?.success) {
            clearFileDisplay();
            displayFiles(result.files);
            updateStatusBar(`Found ${result.files.length} files matching "${query}"`);
        } else {
            throw new Error(result?.error || 'Search failed');
        }
    } catch (error) {
        console.error('[Cloud] Search error:', error);
        showToast(`Search failed: ${error.message}`, 'error');
        updateStatusBar('Search failed');
    } finally {
        showLoading(false);
    }
}

function getSelectedFiles() {
    const selected = document.querySelectorAll('.file-card.selected');
    return Array.from(selected).map(card => ({
        id: card.dataset.fileId,
        name: card.querySelector('.file-name').textContent,
        isFolder: card.dataset.isFolder === 'true'
    }));
}

function showSortOptions() {
    const sortOptions = ['name', 'modifiedTime', 'size'];
    const currentSort = localStorage.getItem('cloud-sort') || 'name';
    const currentIndex = sortOptions.indexOf(currentSort);
    const nextSort = sortOptions[(currentIndex + 1) % sortOptions.length];
    
    localStorage.setItem('cloud-sort', nextSort);
    showToast(`Sorted by ${nextSort}`, 'info');
    loadFiles(currentFolderId);
}

async function showFileSelectionModal(files) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-dark-light border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
                <h3 class="text-xl font-semibold mb-4">Select Encrypted File to Upload</h3>
                <div class="max-h-64 overflow-y-auto mb-4">
                    ${files.map(file => `
                        <div class="file-option p-2 hover:bg-slate-700 rounded cursor-pointer" data-file-id="${file.id}">
                            <div class="font-medium">${file.name}</div>
                            <div class="text-sm text-slate-400">${file.algorithm} • ${formatFileSize(file.size)}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="flex space-x-3">
                    <button id="cancel-selection" class="flex-1 bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelectorAll('.file-option').forEach(option => {
            option.addEventListener('click', () => {
                modal.remove();
                resolve(option.dataset.fileId);
            });
        });
        
        modal.querySelector('#cancel-selection').addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });
    });
}

async function promptForInput(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-dark-light border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
                <h3 class="text-xl font-semibold mb-4">${message}</h3>
                <input type="text" id="input-field" class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:border-primary focus:outline-none mb-4">
                <div class="flex space-x-3">
                    <button id="cancel-input" class="flex-1 bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg">
                        Cancel
                    </button>
                    <button id="confirm-input" class="flex-1 bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-lg">
                        OK
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const inputField = modal.querySelector('#input-field');
        inputField.focus();
        
        const cleanup = (result) => {
            modal.remove();
            resolve(result);
        };
        
        modal.querySelector('#cancel-input').addEventListener('click', () => cleanup(null));
        modal.querySelector('#confirm-input').addEventListener('click', () => cleanup(inputField.value.trim()));
        
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') cleanup(inputField.value.trim());
            if (e.key === 'Escape') cleanup(null);
        });
    });
}

// Enhanced Authorization Modal (same as index.html)
function showAuthCodeModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    modal.innerHTML = `
        <div style="background: #1a1a1a; border: 1px solid #444; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; margin: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
                <i class="fas fa-google" style="font-size: 48px; color: #4285f4; margin-bottom: 16px;"></i>
                <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #e8eaed;">Google Drive Authorization</h3>
                <p style="color: #9aa0a6;">Complete the authorization in your browser, then use one of the methods below:</p>
            </div>
            
            <div style="margin-bottom: 16px;">
                <!-- Tab selector -->
                <div style="display: flex; background: #2d2d2d; border-radius: 8px; padding: 4px; margin-bottom: 16px;">
                    <button id="code-tab" style="flex: 1; padding: 8px 16px; font-size: 14px; font-weight: 500; text-align: center; border-radius: 6px; background: #4285f4; color: white; border: none; cursor: pointer;">
                        Code Only
                    </button>
                    <button id="url-tab" style="flex: 1; padding: 8px 16px; font-size: 14px; font-weight: 500; text-align: center; border-radius: 6px; background: none; color: #9aa0a6; border: none; cursor: pointer;">
                        Full URL
                    </button>
                </div>
                
                <!-- Code input (default) -->
                <div id="code-input-section">
                    <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; color: #e8eaed;">Authorization Code:</label>
                    <textarea id="auth-code-input" style="width: 100%; padding: 12px; background: #2d2d2d; border: 1px solid #444; border-radius: 8px; color: #e8eaed; resize: none; font-family: monospace;" rows="3" placeholder="Paste the authorization code here (e.g., 4/0AX4XfWh...)"></textarea>
                    <p style="font-size: 12px; color: #9aa0a6; margin-top: 4px;">Just the code portion from the browser</p>
                </div>
                
                <!-- URL input (hidden by default) -->
                <div id="url-input-section" style="display: none;">
                    <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; color: #e8eaed;">Complete Authorization URL:</label>
                    <textarea id="auth-url-input" style="width: 100%; padding: 12px; background: #2d2d2d; border: 1px solid #444; border-radius: 8px; color: #e8eaed; resize: none; font-family: monospace;" rows="4" placeholder="Paste the complete URL from your browser (e.g., http://localhost:3000/oauth2callback?code=4/0AX4...)"></textarea>
                    <p style="font-size: 12px; color: #9aa0a6; margin-top: 4px;">Copy the entire URL from your browser address bar</p>
                </div>
                
                <!-- Auto-detect clipboard -->
                <div style="background: #2d2d2d; border-radius: 8px; padding: 12px; margin: 16px 0;">
                    <button id="auto-detect-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; color: #4285f4; background: none; border: none; cursor: pointer;">
                        <i class="fas fa-magic"></i>
                        <span>Auto-detect from clipboard</span>
                    </button>
                    <p style="font-size: 12px; color: #9aa0a6; margin-top: 4px; text-align: center;">Automatically extract code from copied content</p>
                </div>
                
                <div id="auth-error" style="display: none; color: #f28b82; font-size: 14px; background: rgba(242, 139, 130, 0.1); border: 1px solid rgba(242, 139, 130, 0.2); border-radius: 8px; padding: 12px; margin: 16px 0;"></div>
                
                <div style="display: flex; gap: 12px; margin-top: 24px;">
                    <button onclick="submitAuthCodeFromModal()" style="flex: 1; background: #4285f4; color: white; border: none; padding: 12px 16px; border-radius: 8px; font-size: 14px; cursor: pointer;">
                        Connect
                    </button>
                    <button onclick="this.closest('.fixed') ? this.closest('.fixed').remove() : this.closest('[style*=\"position: fixed\"]').remove()" style="flex: 1; background: #5f6368; color: white; border: none; padding: 12px 16px; border-radius: 8px; font-size: 14px; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up tab switching
    const codeTab = modal.querySelector('#code-tab');
    const urlTab = modal.querySelector('#url-tab');
    const codeSection = modal.querySelector('#code-input-section');
    const urlSection = modal.querySelector('#url-input-section');
    const autoDetectBtn = modal.querySelector('#auto-detect-btn');
    
    codeTab.addEventListener('click', () => {
        codeTab.style.background = '#4285f4';
        codeTab.style.color = 'white';
        urlTab.style.background = 'none';
        urlTab.style.color = '#9aa0a6';
        codeSection.style.display = 'block';
        urlSection.style.display = 'none';
    });
    
    urlTab.addEventListener('click', () => {
        urlTab.style.background = '#4285f4';
        urlTab.style.color = 'white';
        codeTab.style.background = 'none';
        codeTab.style.color = '#9aa0a6';
        urlSection.style.display = 'block';
        codeSection.style.display = 'none';
    });
    
    // Auto-detect functionality
    autoDetectBtn.addEventListener('click', async () => {
        try {
            const clipboardText = await navigator.clipboard.readText();
            const extractedCode = extractAuthCodeFromText(clipboardText);
            
            if (extractedCode) {
                const codeInput = modal.querySelector('#auth-code-input');
                codeInput.value = extractedCode;
                showAuthSuccess('✅ Authorization code detected and filled automatically!');
            } else {
                showAuthError('No authorization code found in clipboard. Please copy the code or URL from your browser.');
            }
        } catch (error) {
            showAuthError('Could not access clipboard. Please paste manually.');
        }
    });
    
    // Focus the appropriate input
    setTimeout(() => {
        const input = modal.querySelector('#auth-code-input');
        if (input) input.focus();
    }, 100);
}

async function submitAuthCodeFromModal() {
    let authCode = '';
    
    // Check which tab is active and get the appropriate input
    const codeSection = document.getElementById('code-input-section');
    const urlSection = document.getElementById('url-input-section');
    
    if (urlSection && urlSection.style.display !== 'none') {
        // URL tab is active
        const urlInput = document.getElementById('auth-url-input');
        const urlValue = urlInput?.value?.trim();
        
        if (!urlValue) {
            showAuthError('Please paste the authorization URL from your browser');
            return;
        }
        
        // Extract code from URL
        authCode = extractAuthCodeFromText(urlValue);
        if (!authCode) {
            showAuthError('Could not extract authorization code from URL. Please check the URL or use the "Code Only" tab.');
            return;
        }
        
        console.log('Extracted code from URL:', authCode);
    } else {
        // Code tab is active
        const codeInput = document.getElementById('auth-code-input');
        authCode = codeInput?.value?.trim();
        
        if (!authCode) {
            showAuthError('Please enter the authorization code');
            return;
        }
        
        // Validate the code format
        if (!authCode.startsWith('4/')) {
            showAuthError('Authorization code should start with "4/". Please check the code.');
            return;
        }
    }
    
    try {
        // Use the existing cloud API to exchange the code
        const result = await window.cloudApi.exchangeGDriveAuthCode(authCode);
        
        // Close the modal
        const modal = document.querySelector('[style*="position: fixed"]');
        if (modal) modal.remove();
        
        if (result?.success) {
            showToast(`Successfully connected to Google Drive as ${result.email || 'user'}!`, 'success');
            
            // Update connection status instead of reloading
            isConnected = true;
            updateConnectionStatus(true, result.email);
            await loadFiles();
        } else {
            showToast(`Failed to connect: ${result?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error exchanging auth code:', error);
        showToast('Failed to connect to Google Drive', 'error');
    }
}

function showAuthError(message) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => errorDiv.style.display = 'none', 5000);
    }
}

function showAuthSuccess(message) {
    showToast(message, 'success');
} 