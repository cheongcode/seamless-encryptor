/**
 * UI event handlers and interactions
 */
import { showToast } from '../utils/toast.js';
import { updateKeyStatus } from './keyStatus.js';
import { generateKey } from '../crypto/keyManagement.js';
import { encryptFiles } from '../crypto/fileOperations.js';

// Helper function to show confirmation respecting user settings
async function showConfirmationIfEnabled(message, defaultAction = false) {
    const confirmActionsEnabled = document.getElementById('confirm-actions')?.checked;
    
    if (confirmActionsEnabled !== false) { // Show confirmation by default or if setting is enabled
        return confirm(message);
    } else {
        // Log the action when confirmation is bypassed
        console.log('[SETTINGS] Confirmation bypassed for action:', message);
        return defaultAction; // Use defaultAction when confirmations are disabled
    }
}

/**
 * Sets up all UI event listeners
 * @param {Object} api - The electron API for IPC communication
 */
export function setupEventListeners(api) {
    console.log('[events.js] Setting up event listeners');
    
    // Encrypt button
    const encryptButton = document.getElementById('encrypt-button');
    if (encryptButton) {
        encryptButton.addEventListener('click', () => {
            console.log('[events.js] Encrypt button clicked');
            encryptFiles(api);
        });
        console.log('[events.js] Added click listener to encrypt button');
    }
    
    // Generate key button
    const generateKeyButton = document.getElementById('generate-key-button');
    if (generateKeyButton) {
        generateKeyButton.addEventListener('click', () => generateKey(api, generateKeyButton));
        console.log('[events.js] Added click listener to generate key button');
    }
    
    // Secondary generate key buttons
    const warningGenerateKeyButton = document.getElementById('warning-generate-key');
    if (warningGenerateKeyButton) {
        warningGenerateKeyButton.addEventListener('click', () => generateKey(api, warningGenerateKeyButton));
    }
    
    const generateKeyLink = document.getElementById('generate-key-link');
    if (generateKeyLink) {
        generateKeyLink.addEventListener('click', () => generateKey(api, generateKeyLink));
    }
    
    // Settings toggle
    const settingsToggle = document.getElementById('settings-toggle');
    if (settingsToggle) {
        settingsToggle.addEventListener('click', toggleSettings);
    }
    
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Sidebar overlay
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleMobileMenu);
    }
    
    // Start encryption CTA
    const startEncryptionCta = document.getElementById('start-encryption-cta');
    if (startEncryptionCta) {
        startEncryptionCta.addEventListener('click', () => {
            const encryptBtn = document.getElementById('encrypt-button');
            if (encryptBtn) encryptBtn.click();
        });
    }
    
    // File actions (decrypt, download, delete)
    document.addEventListener('click', (event) => {
        handleFileActions(event, api);
    });
}

/**
 * Toggles the settings panel visibility
 */
export function toggleSettings() {
    const settingsPanel = document.getElementById('settings-panel');
    if (!settingsPanel) return;
    
    if (settingsPanel.classList.contains('hidden')) {
        settingsPanel.classList.remove('hidden');
    } else {
        settingsPanel.classList.add('hidden');
    }
}

/**
 * Toggles the mobile sidebar visibility
 */
export function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !sidebarOverlay) return;
    
    const isVisible = !sidebar.classList.contains('hidden');
    
    if (isVisible) {
        sidebar.classList.add('hidden');
        sidebarOverlay.classList.add('invisible');
        sidebarOverlay.classList.add('opacity-0');
    } else {
        sidebar.classList.remove('hidden');
        sidebarOverlay.classList.remove('invisible');
        sidebarOverlay.classList.remove('opacity-0');
    }
}

/**
 * Handles file card action button clicks (decrypt, download, delete)
 * @param {Event} event - The click event
 * @param {Object} api - The electron API for IPC communication
 */
async function handleFileActions(event, api) {
    // Import these functions only when needed (lazy loading)
    import('../crypto/fileOperations.js').then(({ decryptFile, downloadEncryptedFile, deleteEncryptedFile }) => {
        // Find target with its class
        const decryptButton = event.target.closest('.decrypt-button');
        if (decryptButton) {
            const fileCard = decryptButton.closest('.file-card');
            if (fileCard && fileCard.dataset.fileId) {
                decryptFile(api, fileCard.dataset.fileId);
            }
            return;
        }
        
        const downloadEncryptedButton = event.target.closest('.download-encrypted-button');
        if (downloadEncryptedButton) {
            const fileCard = downloadEncryptedButton.closest('.file-card');
            if (fileCard && fileCard.dataset.fileId) {
                downloadEncryptedFile(api, fileCard.dataset.fileId);
            }
            return;
        }
        
        const deleteButton = event.target.closest('.delete-button');
        if (deleteButton) {
            const fileCard = deleteButton.closest('.file-card');
            if (fileCard && fileCard.dataset.fileId) {
                const shouldDelete = await showConfirmationIfEnabled('Are you sure you want to delete this encrypted file?', false);
                if (shouldDelete) {
                    deleteEncryptedFile(api, fileCard.dataset.fileId);
                }
            }
            return;
        }
    });
}

/**
 * Shows encryption algorithm information based on selected method
 */
export function updateAlgorithmInfo() {
    const algorithmInfo = document.getElementById('algorithm-info');
    const encryptionMethod = document.getElementById('encryption-method');
    if (!algorithmInfo || !encryptionMethod) return;
    
    const method = encryptionMethod.value;
    let info = '';
    
    switch (method) {
        case 'aes-256-gcm':
            info = 'AES-256-GCM: High-performance, industry-standard encryption.';
            break;
        case 'chacha20-poly1305':
            info = 'ChaCha20-Poly1305: Faster than AES on platforms without hardware acceleration.';
            break;
        case 'xchacha20-poly1305':
            info = 'XChaCha20-Poly1305: Extended nonce version of ChaCha20, more resistant to nonce misuse.';
            break;
        default:
            info = 'Select an encryption algorithm.';
    }
    
    algorithmInfo.textContent = info;
}
