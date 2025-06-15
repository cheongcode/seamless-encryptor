// Seamless Encryptor - cloud.js

// DOM Elements for Google Drive
const gdriveStatus = document.getElementById('gdrive-status');
const connectGdriveBtn = document.getElementById('connect-gdrive');
const disconnectGdriveBtn = document.getElementById('disconnect-gdrive');
const gdriveAuthCodeSection = document.getElementById('gdrive-auth-code-section');
const gdriveAuthCodeInput = document.getElementById('gdrive-auth-code');
const submitGdriveAuthCodeBtn = document.getElementById('submit-gdrive-auth-code');

const gdriveBrowserSection = document.getElementById('gdrive-browser-section');
const gdriveRefreshFilesBtn = document.getElementById('gdrive-refresh-files');
const gdriveFileListBody = document.getElementById('gdrive-file-list-body');
const gdriveCurrentPathDiv = document.getElementById('gdrive-current-path');
const gdriveUpFolderBtn = document.getElementById('gdrive-up-folder');
const gdriveLoadMoreBtn = document.getElementById('gdrive-load-more');

// Version display element in footer
const appVersionSpan = document.getElementById('app-version');

// Placeholder for Upload functionality elements
const gdriveFileUploadInput = document.getElementById('gdrive-file-upload-input');
const gdriveSelectFilesButton = document.getElementById('gdrive-select-files-button');
const gdriveUploadQueueDiv = document.getElementById('gdrive-upload-queue');

// GDrive State Variables
let gdriveCurrentFolderId = null;
let gdriveCurrentFolderName = 'My Drive'; // Default, will be updated
let gdriveNextPageToken = null;
let gdriveFolderHistory = []; // To store {id, name} for "Up" functionality

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[CloudPage] DOMContentLoaded');
    loadAndDisplayGDriveStatus(); // Load GDrive status when page loads
    setupEventListeners();
    loadAppVersion();
});

async function loadAppVersion() {
    if (window.api && typeof window.api.getAppVersion === 'function' && appVersionSpan) {
        try {
            const version = await window.api.getAppVersion();
            appVersionSpan.textContent = version || '1.0.0';
        } catch (error) {
            console.error('[CloudPage] Error fetching app version:', error);
            appVersionSpan.textContent = 'N/A';
        }
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    if (connectGdriveBtn) {
        connectGdriveBtn.addEventListener('click', handleConnectGDrive);
    }
    if (disconnectGdriveBtn) {
        disconnectGdriveBtn.addEventListener('click', handleDisconnectGDrive);
    }
    if (submitGdriveAuthCodeBtn) {
        submitGdriveAuthCodeBtn.addEventListener('click', handleSubmitGDriveAuthCode);
    }
    if (gdriveRefreshFilesBtn) {
        gdriveRefreshFilesBtn.addEventListener('click', () => {
            if (gdriveBrowserSection.classList.contains('hidden')){
                showToast('Connect to Google Drive first to refresh files.', 'info');
                return;
            }
            gdriveNextPageToken = null; // Reset page token for a full refresh
            fetchAndDisplayGDriveFiles(gdriveCurrentFolderId); // Pass current folder or null for root/default
        });
    }
    if (gdriveUpFolderBtn) {
        gdriveUpFolderBtn.addEventListener('click', () => {
            if (gdriveFolderHistory.length > 0) {
                const previousFolder = gdriveFolderHistory.pop();
                gdriveCurrentFolderId = previousFolder.id;
                gdriveCurrentFolderName = previousFolder.name;
                gdriveNextPageToken = null;
                fetchAndDisplayGDriveFiles(gdriveCurrentFolderId);
            } else {
                 gdriveUpFolderBtn.disabled = true;
            }
        });
    }
    if (gdriveLoadMoreBtn) {
        gdriveLoadMoreBtn.addEventListener('click', () => {
            if (gdriveNextPageToken) {
                fetchAndDisplayGDriveFiles(gdriveCurrentFolderId, gdriveNextPageToken, true);
            }
        });
    }
    // Placeholder for Upload button listener
    if (gdriveSelectFilesButton) {
        gdriveSelectFilesButton.addEventListener('click', () => {
            if (!gdriveCurrentFolderId) {
                showToast('Please connect to Google Drive and navigate to a folder first.', 'warning');
                return;
            }
            gdriveFileUploadInput.click(); // Open file dialog
        });
    }
    if (gdriveFileUploadInput) {
        gdriveFileUploadInput.addEventListener('change', handleFileUploadSelection);
    }
}

// --- Google Drive Specific Functions (Copied and adapted from settings.js) ---

// Function to update GDrive UI elements based on connection status
function updateGDriveStatusUI(status) {
    if (!gdriveStatus || !connectGdriveBtn || !disconnectGdriveBtn || !gdriveAuthCodeSection || !gdriveBrowserSection) {
        console.warn('[CloudPage] GDrive UI elements not found, cannot update status UI.');
        return;
    }

    const isConnected = status.connected && status.email;

    connectGdriveBtn.disabled = status.connecting;
    disconnectGdriveBtn.disabled = status.connecting;
    
    if (status.connecting) {
        gdriveStatus.textContent = 'Status: Connecting...';
        gdriveAuthCodeSection.classList.add('hidden');
        gdriveBrowserSection.classList.add('hidden');
    } else if (status.awaitingCode) {
        gdriveStatus.textContent = 'Status: Awaiting authorization code. Check your browser.';
        connectGdriveBtn.classList.add('hidden');
        disconnectGdriveBtn.classList.add('hidden');
        gdriveAuthCodeSection.classList.remove('hidden');
        gdriveBrowserSection.classList.add('hidden');
    } else if (isConnected) {
        gdriveStatus.innerHTML = `Status: Connected (<span class="font-medium text-green-400">${status.email}</span>)`;
        connectGdriveBtn.classList.add('hidden');
        disconnectGdriveBtn.classList.remove('hidden');
        gdriveAuthCodeSection.classList.add('hidden');
        gdriveBrowserSection.classList.remove('hidden');
        
        if (gdriveCurrentFolderId === null && gdriveFolderHistory.length === 0) {
             console.log("[CloudPage] GDrive connected, initiating file list fetch.");
             fetchAndDisplayGDriveFiles(); // Load files for the root/app folder initially
        }
    } else { // Not connected or error
        gdriveStatus.textContent = `Status: Not Connected${status.error ? (' - ' + status.error) : ''}`;
        if (status.error && !status.error.includes("Failed to get status")) { 
            console.error("[CloudPage] GDrive connection error:", status.error);
            showToast(`GDrive Error: ${status.error}`, 'error');
        }
        connectGdriveBtn.classList.remove('hidden');
        disconnectGdriveBtn.classList.add('hidden');
        gdriveAuthCodeSection.classList.add('hidden');
        gdriveBrowserSection.classList.add('hidden'); 
        gdriveCurrentFolderId = null; 
        gdriveNextPageToken = null;
        gdriveFolderHistory = [];
        if (gdriveFileListBody) gdriveFileListBody.innerHTML = '<p class="text-gray-500 p-2">Connect to Google Drive to browse files.</p>';
        if (gdriveCurrentPathDiv) gdriveCurrentPathDiv.textContent = 'Path: /';
        if (gdriveUpFolderBtn) gdriveUpFolderBtn.disabled = true;
        if (gdriveLoadMoreBtn) gdriveLoadMoreBtn.classList.add('hidden');
    }
}

// Load and display current GDrive status
async function loadAndDisplayGDriveStatus() {
    if (!window.cloudApi) {
        console.warn('[CloudPage] cloudApi not available. Cannot load GDrive status.');
        updateGDriveStatusUI({ connected: false, error: 'Initialization error' });
        return;
    }
    try {
        updateGDriveStatusUI({ connecting: true });
        const status = await window.cloudApi.getGDriveStatus();
        if (status.success) {
            updateGDriveStatusUI({ connected: status.connected, email: status.email });
        } else {
            updateGDriveStatusUI({ connected: false, error: status.error || 'Failed to get status' });
        }
    } catch (error) {
        console.error('[CloudPage] Error loading GDrive status:', error);
        updateGDriveStatusUI({ connected: false, error: error.message });
    }
}

async function handleConnectGDrive() {
    console.log('[CloudPage] Connect to Google Drive button clicked');
    if (!window.cloudApi || !window.api) {
        console.error("[CloudPage] handleConnectGDrive: cloudApi or api missing."); 
        return;
    }
    try {
        updateGDriveStatusUI({ connecting: true });
        const result = await window.cloudApi.connectGDrive(); 
        if (result.success && result.authUrl) {
            const openResult = await window.api.openExternalUrl(result.authUrl); 
            if (openResult && openResult.success){
                updateGDriveStatusUI({ awaitingCode: true });
                showToast('Please authorize in your browser and paste the code below.', 'info', 5000);
            } else {
                showToast(`Error: Could not open authentication URL. Reason: ${openResult?.error || 'Unknown'}.`, 'error', 7000);
                updateGDriveStatusUI({ connected: false, error: 'Failed to open auth URL' });
            }
        } else {
            showToast(`Error: Could not get GDrive authentication URL. Reason: ${result.error || 'Unknown'}.`, 'error', 7000);
            updateGDriveStatusUI({ connected: false, error: result.error });
        }
    } catch (error) {
        console.error('[CloudPage] Error connecting to Google Drive:', error);
        showToast(`Error connecting to Google Drive: ${error.message}`, 'error', 7000);
        updateGDriveStatusUI({ connected: false, error: error.message });
    }
}

async function handleDisconnectGDrive() {
    console.log('[CloudPage] Disconnect Google Drive button clicked');
    if (!confirm('Are you sure you want to disconnect from Google Drive?')) return;
    
    updateGDriveStatusUI({ connecting: true }); 
    try {
        const result = await window.cloudApi?.disconnectGDrive();
        if (result.success) {
            showToast('Successfully disconnected from Google Drive.', 'success');
        } else {
            showToast(`Failed to disconnect: ${result.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        showToast(`Error disconnecting GDrive: ${error.message}`, 'error');
    }
    await loadAndDisplayGDriveStatus(); // This will update UI to 'not connected' state
}

async function handleSubmitGDriveAuthCode() {
    if (!window.cloudApi || !gdriveAuthCodeInput) {
        console.error("[CloudPage] handleSubmitGDriveAuthCode: cloudApi or auth code input missing.");
        return;
    }
    const authCode = gdriveAuthCodeInput.value.trim();
    if (!authCode) {
        showToast('Please enter the authorization code.', 'warning');
        return;
    }
    console.log("[CloudPage] Submitting GDrive Auth Code:", authCode.substring(0, 20) + "...");
    updateGDriveStatusUI({ connecting: true });
    try {
        const result = await window.cloudApi.exchangeGDriveAuthCode(authCode);
        if (result.success && result.email) {
            showToast(`Successfully connected to Google Drive as ${result.email}!`, 'success');
            gdriveAuthCodeInput.value = ''; 
            gdriveFolderHistory = []; 
            gdriveCurrentFolderId = null; 
            gdriveCurrentFolderName = 'My Drive'; 
        } else {
            showToast(`GDrive connection failed: ${result.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('[CloudPage] Error submitting GDrive auth code:', error);
        showToast(`GDrive connection error: ${error.message}`, 'error');
    }
    await loadAndDisplayGDriveStatus(); 
}

async function fetchAndDisplayGDriveFiles(folderIdToLoad = gdriveCurrentFolderId, pageToken = null, append = false) {
    if (!window.cloudApi || !gdriveFileListBody || !gdriveBrowserSection || gdriveBrowserSection.classList.contains('hidden')) {
        console.warn("[CloudPage] GDrive file fetch skipped: API/UI not ready or browser hidden.");
        if (gdriveFileListBody) {
            gdriveFileListBody.innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-center text-gray-500">Connect to Google Drive to browse files.</td></tr>`;
        }
        return;
    }
    console.log(`[CloudPage] Fetching GDrive files for folder: ${folderIdToLoad || 'default (app folder/root)'}, pageToken: ${pageToken}, append: ${append}`);
    
    if (!append) {
        gdriveFileListBody.innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-center text-gray-400">Loading files...</td></tr>`;
    } else {
        // Remove previous "Load More" button if it was added as a row, or just let it be if it was a separate button.
        // For now, assuming Load More button is separate and not part of the table body rows.
        const loadingMoreRow = document.createElement('tr');
        loadingMoreRow.innerHTML = `<td colspan="4" class="px-4 py-3 text-center text-gray-400">Loading more...</td>`;
        loadingMoreRow.id = 'gdrive-loading-more-row'; // ID to remove it later
        gdriveFileListBody.appendChild(loadingMoreRow);
    }

    try {
        const result = await window.cloudApi.listGDriveFiles({ parentFolderId: folderIdToLoad, pageToken: pageToken });
        if (result.success) {
            gdriveNextPageToken = result.nextPageToken;

            if (result.currentFolderId && (gdriveCurrentFolderId !== result.currentFolderId || folderIdToLoad === null)) {
                gdriveCurrentFolderId = result.currentFolderId;
                if (result.currentFolderName && (gdriveFolderHistory.length === 0 || !folderIdToLoad)) {
                    gdriveCurrentFolderName = result.currentFolderName;
                } else if (gdriveFolderHistory.length === 0 && !folderIdToLoad) {
                    gdriveCurrentFolderName = (gdriveCurrentFolderId === 'root') ? 'My Drive' : 'App Folder'; 
                }
            }

            renderGDriveFiles(result.files, append);
            gdriveLoadMoreBtn.classList.toggle('hidden', !gdriveNextPageToken);
            updateGDrivePathDisplay(); 
        } else {
            gdriveFileListBody.innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-center text-red-400">Error loading files: ${result.error || 'Unknown error'}</td></tr>`;
            gdriveLoadMoreBtn.classList.add('hidden');
        }
    } catch (error) {
        console.error('[CloudPage] Error fetching GDrive files:', error);
        gdriveFileListBody.innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-center text-red-400">Client-side error fetching files: ${error.message}</td></tr>`;
        gdriveLoadMoreBtn.classList.add('hidden');
    }
    gdriveUpFolderBtn.disabled = gdriveFolderHistory.length === 0;
}

function renderGDriveFiles(files, append = false) {
    if (!gdriveFileListBody) return;

    // Remove placeholder/loading rows before adding new content
    const loadingMoreRow = document.getElementById('gdrive-loading-more-row');
    if (loadingMoreRow) loadingMoreRow.remove();

    if (!append) {
        gdriveFileListBody.innerHTML = ''; // Clear previous items if not appending
    }

    // Remove initial "Connect to Google Drive..." or "No files..." message if we are about to render actual files
    if (files && files.length > 0 && !append) {
        const initialMessageRow = gdriveFileListBody.querySelector('tr td[colspan="4"]');
        if (initialMessageRow) initialMessageRow.parentElement.remove();
    }
    
    if (!files || files.length === 0) {
        if (!append && gdriveFileListBody.children.length === 0) { // Only show if table is truly empty
            gdriveFileListBody.innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-center text-gray-500">No files or folders found.</td></tr>`;
        }
        return;
    }

    files.forEach(file => {
        const row = document.createElement('tr');
        row.dataset.id = file.id;
        row.dataset.name = file.name;
        row.dataset.mimeType = file.mimeType;
        row.className = 'border-b border-gray-750'; // Theme-consistent border

        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        if (isFolder) {
            row.classList.add('hover:bg-gray-700', 'cursor-pointer');
            row.addEventListener('click', () => navigateToGDriveFolder(file.id, file.name));
        }

        // Icon cell
        const iconCell = row.insertCell();
        iconCell.className = 'px-4 py-2 w-10';
        const iconImg = document.createElement('img');
        const localIconPath = isFolder ? '../assets/icons/folder.svg' : '../assets/icons/file.svg';
        iconImg.src = file.iconLink || localIconPath;
        iconImg.alt = isFolder ? 'Folder' : 'File';
        iconImg.className = 'w-5 h-5 object-contain'; // Slightly larger, object-contain is better
        let localIconUsed = !file.iconLink;
        iconImg.onerror = () => {
            if (!localIconUsed) {
                iconImg.src = localIconPath; 
                localIconUsed = true;
            } else {
                iconImg.alt = isFolder ? 'F_err' : 'f_err'; // Shorter error alt
            }
        };
        iconCell.appendChild(iconImg);

        // Name cell
        const nameCell = row.insertCell();
        nameCell.className = 'px-4 py-2 truncate';
        nameCell.textContent = file.name;
        if (!isFolder) {
             nameCell.title = file.name; // Show full name on hover for truncated file names
        }

        // Modified Date cell
        const modifiedCell = row.insertCell();
        modifiedCell.className = 'px-4 py-2 whitespace-nowrap';
        modifiedCell.textContent = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'N/A';

        // Size cell
        const sizeCell = row.insertCell();
        sizeCell.className = 'px-4 py-2 whitespace-nowrap';
        if (isFolder) {
            sizeCell.textContent = '--';
        } else {
            sizeCell.textContent = file.size ? (parseInt(file.size, 10) / 1024).toFixed(1) + ' KB' : 'N/A';
        }
        
        // General title for the row for files (folders have click action)
        if (!isFolder) {
             row.title = `File: ${file.name}\nSize: ${sizeCell.textContent}\nModified: ${modifiedCell.textContent}`;
        }

        gdriveFileListBody.appendChild(row);
    });
}

function navigateToGDriveFolder(folderId, folderName) {
    console.log(`[CloudPage] Navigating to GDrive folder: ${folderName} (${folderId})`);
    if (gdriveCurrentFolderId !== folderId) { 
        gdriveFolderHistory.push({ id: gdriveCurrentFolderId, name: gdriveCurrentFolderName });
    }
    gdriveCurrentFolderId = folderId;
    gdriveCurrentFolderName = folderName;
    gdriveNextPageToken = null; 
    fetchAndDisplayGDriveFiles(folderId);
}

function updateGDrivePathDisplay() {
    if (!gdriveCurrentPathDiv) return;
    let pathSegments = gdriveFolderHistory.map(f => f.name || (f.id === 'root' ? 'My Drive' : 'App Folder'));
    if (gdriveCurrentFolderName && (gdriveFolderHistory.length === 0 || gdriveFolderHistory[gdriveFolderHistory.length - 1]?.name !== gdriveCurrentFolderName)) {
        pathSegments.push(gdriveCurrentFolderName);
    }
    if (pathSegments.length === 0 && gdriveCurrentFolderId === 'root') pathSegments.push('My Drive');
    if (pathSegments.length === 0 && gdriveCurrentFolderId && gdriveCurrentFolderId !== 'root') pathSegments.push('App Folder');
    if (pathSegments.length === 0) pathSegments.push('My Drive');

    const pathString = pathSegments.join(' / ');
    gdriveCurrentPathDiv.textContent = `Path: /${pathString}`;
    gdriveCurrentPathDiv.title = `Path: /${pathString}`;
}

// --- File Upload Placeholder Functions ---
function handleFileUploadSelection(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log(`[CloudPage] Selected ${files.length} file(s) for upload:`);
    Array.from(files).forEach(file => {
        console.log(` - ${file.name} (size: ${file.size} bytes, type: ${file.type})`);
        // Add to visual queue
        addFileToUploadQueue(file);
    });
    // TODO: Implement actual upload process, perhaps one by one or in parallel
    // For each file:
    // 1. Read file data (if not too large, else stream)
    // 2. Encrypt file data using window.api.encryptFile (or a new specific API method)
    // 3. Upload encrypted data to gdriveCurrentFolderId using a new window.cloudApi.uploadFileToGDrive method
    // Update queue item with progress/status

    // Clear the input for next selection
    gdriveFileUploadInput.value = '';
}

function addFileToUploadQueue(file) {
    if (!gdriveUploadQueueDiv) return;
    const queueItem = document.createElement('div');
    queueItem.className = 'p-2 bg-gray-700 rounded flex justify-between items-center';
    queueItem.innerHTML = `
        <span class="truncate">${file.name}</span>
        <span class="text-xs text-gray-400">Pending...</span>
    `;
    // TODO: Add progress bar, cancel button, etc.
    gdriveUploadQueueDiv.appendChild(queueItem);
    // For now, simulate upload completion
    setTimeout(() => {
        queueItem.innerHTML = `
            <span class="truncate text-green-400">${file.name} (uploaded - simulated)</span>
            <span class="text-xs text-green-400">Complete</span>
        `;
    }, 2000 + Math.random() * 3000);
}

// --- Utility Functions (e.g., showToast) ---
function showToast(message, type = 'info', duration = 3000) {
    console.log(`[Toast-${type}] ${message} (duration: ${duration}ms)`);
    const toastId = 'cloud-toast'; 
    let toastElement = document.getElementById(toastId);
    if (!toastElement) {
        toastElement = document.createElement('div');
        toastElement.id = toastId;
        Object.assign(toastElement.style, {
            position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            padding: '10px 20px', borderRadius: '5px', zIndex: '1001', transition: 'opacity 0.5s ease',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)', fontWeight: '500'
        });
        document.body.appendChild(toastElement);
    }

    toastElement.textContent = message;
    toastElement.style.opacity = '1';

    const colors = {
        success: { bg: '#4CAF50', text: 'white' },
        error:   { bg: '#f44336', text: 'white' },
        warning: { bg: '#ff9800', text: 'black' },
        info:    { bg: '#2196F3', text: 'white' }
    };
    toastElement.style.backgroundColor = colors[type]?.bg || colors.info.bg;
    toastElement.style.color = colors[type]?.text || colors.info.text;

    setTimeout(() => { toastElement.style.opacity = '0'; }, duration);
}

console.log('[CloudPage] cloud.js loaded'); 