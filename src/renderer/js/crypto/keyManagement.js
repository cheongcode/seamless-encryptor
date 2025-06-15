/**
 * Key management functions
 */
import { showToast } from '../utils/toast.js';
import { updateKeyStatus } from '../ui/keyStatus.js';

// Debug logger
const debug = (message, ...args) => {
    console.log(`[keyManagement.js] ${message}`, ...args);
};

// Initialize key management
let isInitialized = false;

/**
 * Get the API object - attempts multiple ways to get it
 * @returns {Object|null} The API object or null if not available
 */
function getApiObject() {
    debug('Accessing API object...');
    // Try all possible API locations
    const api = window.api || window.appApi || (window.electron && window.electron.api);
    
    if (!api) {
        debug('ERROR: API not found! Check preload script.');
        console.error('API not available in window.api or window.appApi or window.electron.api');
        return null;
    }
    
    // Debug all available methods
    if (api) {
        debug('API methods available:', Object.keys(api));
    }
    
    return api;
}

/**
 * Initializes UI components
 */
function initializeUI() {
    if (isInitialized) return;
    
    debug('Initializing Key Management UI');
    const api = getApiObject();
    if (!api) {
        debug('ERROR: API object is null - cannot initialize UI');
        return;
    }
    
    try {
        // Check which API methods are available
        debug('Available API methods:', Object.keys(api));
        debug('checkKeyStatus method available?', !!api.checkKeyStatus);
        
        // Check for key status first
        debug('Checking initial key status...');
        // Make sure we use the right method name
        if (api.checkKeyStatus) {
            checkEncryptionKey(api)
                .then(exists => debug('Initial key check result:', exists))
                .catch(err => debug('Error during initial key check:', err));
        } else {
            debug('No checkKeyStatus method found - falling back');
            // If there's no checkKeyStatus, try alternative
            updateKeyStatus(false, null);
            if (api.testIPC) {
                api.testIPC()
                    .then(result => debug('testIPC check completed:', result))
                    .catch(err => debug('testIPC check error:', err));
            }
        }
        
        // Set up button handlers
        wireUpButtons(api);
        
        // Set up entropy meter
        setupEntropyMeter();
        
        isInitialized = true;
        debug('Key Management UI initialized successfully');
    } catch (err) {
        debug('Error initializing key management UI:', err);
        console.error('Error initializing key management UI:', err);
    }
}

/**
 * Calculates password entropy
 * @param {string} password - The password to calculate entropy for
 * @returns {number} The estimated entropy in bits
 */
function calculateEntropy(password) {
    if (!password || password.length === 0) return 0;
    
    const length = password.length;
    
    // Check character sets used
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    
    // Calculate character set size
    let charSetSize = 0;
    if (hasLower) charSetSize += 26;
    if (hasUpper) charSetSize += 26;
    if (hasDigit) charSetSize += 10;
    if (hasSpecial) charSetSize += 33; // Approximate for special chars
    
    // If we couldn't detect character set, assume ASCII printable
    if (charSetSize === 0) charSetSize = 95;
    
    // Shannon entropy formula: L * log2(C)
    // where L is password length, C is character set size
    const entropy = length * Math.log2(charSetSize);
    
    return Math.round(entropy);
}

/**
 * Updates the entropy meter UI
 * @param {string} password - The password to check
 */
function updateEntropyMeter(password) {
    const entropyBits = calculateEntropy(password);
    const entropyFill = document.getElementById('entropy-fill');
    const entropyStatus = document.getElementById('entropy-status');
    
    if (!entropyFill || !entropyStatus) return;
    
    // Calculate percentage (max 256 bits, which is very strong)
    let percentage = Math.min(100, (entropyBits / 128) * 100);
    
    // Set the width based on percentage
    entropyFill.style.width = `${percentage}%`;
    
    // Set color based on strength
    let color, strength;
    if (entropyBits < 40) {
        color = 'var(--accent-danger)';
        strength = 'Very Weak';
    } else if (entropyBits < 60) {
        color = 'var(--accent-warning)';
        strength = 'Weak';
    } else if (entropyBits < 80) {
        color = '#f59e0b'; // Amber
        strength = 'Moderate';
    } else if (entropyBits < 100) {
        color = '#10b981'; // Emerald
        strength = 'Strong';
    } else {
        color = 'var(--accent-success)';
        strength = 'Very Strong';
    }
    
    entropyFill.style.backgroundColor = color;
    entropyStatus.textContent = `Strength: ${strength} (${entropyBits} bits)`;
    
    // Update button state based on entropy
    const createKeyBtn = document.getElementById('create-custom-key-btn');
    if (createKeyBtn) {
        createKeyBtn.disabled = entropyBits < 60; // Disable if too weak
    }
}

/**
 * Sets up entropy meter
 */
function setupEntropyMeter() {
    const customKeyInput = document.getElementById('custom-key-input');
    if (customKeyInput) {
        debug('Setting up entropy meter');
        customKeyInput.addEventListener('input', (e) => {
            updateEntropyMeter(e.target.value);
        });
        
        // Initial check if there's a value
        if (customKeyInput.value) {
            updateEntropyMeter(customKeyInput.value);
        }
    }
}

/**
 * Wires up button click handlers
 * @param {Object} api - The API object
 */
function wireUpButtons(api) {
    if (!api) {
        debug('Cannot wire up buttons: API is null');
        return;
    }
    
    debug('Setting up button handlers');
    
    // Generate Key button
    const genKeyBtn = document.getElementById('generate-key-btn');
    if (genKeyBtn) {
        debug('Found generate key button:', genKeyBtn.id);
        genKeyBtn.addEventListener('click', () => {
            debug('Generate key button clicked');
            generateKey(api, genKeyBtn);
        });
    } else {
        debug('Generate key button not found!');
    }
    
    // Import Key button
    const importKeyBtn = document.getElementById('import-key-btn');
    if (importKeyBtn) {
        debug('Found import key button:', importKeyBtn.id);
        importKeyBtn.addEventListener('click', () => {
            debug('Import key button clicked');
            importKey(api, importKeyBtn);
        });
    } else {
        debug('Import key button not found!');
    }
    
    // Create Custom Key button
    const createKeyBtn = document.getElementById('create-custom-key-btn');
    if (createKeyBtn) {
        debug('Found create custom key button:', createKeyBtn.id);
        createKeyBtn.addEventListener('click', () => {
            debug('Create custom key button clicked');
            createCustomKey(api, createKeyBtn);
        });
    } else {
        debug('Create custom key button not found!');
    }
}

/**
 * Updates UI based on key status
 * @param {boolean} exists - Whether a key exists
 * @param {string} keyId - The key ID if it exists
 */
function updateUIForKeyStatus(exists, keyId) {
    const noKeyWarning = document.getElementById('no-key-warning');
    const keyDetails = document.getElementById('key-details');
    const currentKeyId = document.getElementById('current-key-id');
    
    debug(`Updating UI for key status: exists=${exists}, keyId=${keyId}`);
    
    if (noKeyWarning) {
        noKeyWarning.style.display = exists ? 'none' : 'flex';
    }
    
    if (keyDetails) {
        keyDetails.style.display = exists ? 'grid' : 'none';
    }
    
    if (currentKeyId && keyId) {
        currentKeyId.textContent = keyId;
    }
    
    // Disable generation if we already have a key
    const genKeyBtn = document.getElementById('generate-key-btn');
    if (genKeyBtn) {
        // We don't disable it, we just change its purpose
        // If there's already a key, it can still generate a new one
    }
}

/**
 * Generates a new encryption key
 * @param {Object} appApi - The electron API for IPC communication
 * @param {HTMLElement} buttonElement - The button element that triggered the generation
 */
export async function generateKey(appApi, buttonElement) {
    debug('Generating new key...');
    try {
        if (!appApi || !appApi.generateKey) {
            debug('API not available or missing generateKey method');
            showToast('API not available', 'error');
            return;
        }
        
        // Show loading state on button if provided
        if (buttonElement) {
            const originalContent = buttonElement.innerHTML;
            buttonElement.disabled = true;
            buttonElement.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Generating...';
            
            // Reset after 10 seconds in case of hanging
            const timeout = setTimeout(() => {
                if (buttonElement.disabled) {
                    buttonElement.disabled = false;
                    buttonElement.innerHTML = originalContent;
                }
            }, 10000);
        }
        
        // Generate the key
        debug('Calling appApi.generateKey()...');
        const result = await appApi.generateKey();
        debug('Key generation result:', result);
        
        // Update UI based on result
        if (result && result.success) {
            debug('Key generation successful:', result);
            updateKeyStatus(true, result.keyId);
            updateUIForKeyStatus(true, result.keyId);
            showToast('New encryption key generated successfully!', 'success');
        } else {
            debug('Key generation failed:', result);
            updateKeyStatus(false);
            updateUIForKeyStatus(false, null);
            showToast(`Failed to generate key: ${result?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        debug('Error generating key:', error);
        showToast(`Error generating key: ${error.message}`, 'error');
        updateKeyStatus(false);
        updateUIForKeyStatus(false, null);
    } finally {
        // Reset button state if provided
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><circle cx="8" cy="15" r="4"></circle><line x1="10.85" y1="12.15" x2="19" y2="4"></line><line x1="18" y1="5" x2="20" y2="7"></line><line x1="15" y1="8" x2="17" y2="10"></line></svg> Generate New Key';
        }
    }
}

/**
 * Checks if an encryption key exists
 * @param {Object} appApi - The electron API for IPC communication
 * @returns {Promise<boolean>} Whether a key exists
 */
export async function checkEncryptionKey(appApi) {
    try {
        debug('Checking if encryption key exists...');
        
        if (!appApi) {
            debug('API not available');
            updateKeyStatus(false);
            updateUIForKeyStatus(false, null);
            return false;
        }
        
        debug('API method names for key check:', Object.keys(appApi).filter(k => k.toLowerCase().includes('key')));
        
        // Use checkKeyStatus if available
        if (appApi.checkKeyStatus) {
            debug('Calling appApi.checkKeyStatus()...');
            const result = await appApi.checkKeyStatus();
            debug('Key status result:', result);
            
            if (result && result.exists) {
                debug('Key exists with ID:', result.keyId);
                updateKeyStatus(true, result.keyId);
                updateUIForKeyStatus(true, result.keyId);
                return true;
            } else {
                debug('No key exists');
                updateKeyStatus(false);
                updateUIForKeyStatus(false, null);
                return false;
            }
        } else {
            // Fallback method
            debug('checkKeyStatus not available, using fallback');
            updateKeyStatus(false);
            updateUIForKeyStatus(false, null);
            return false;
        }
    } catch (error) {
        debug('Error checking encryption key:', error);
        updateKeyStatus(false);
        updateUIForKeyStatus(false, null);
        return false;
    }
}

/**
 * Imports an encryption key from user input
 * @param {Object} appApi - The electron API for IPC communication
 * @param {HTMLElement} buttonElement - The button element that triggered the import
 */
export async function importKey(appApi, buttonElement) {
    debug('Importing key...');
    try {
        if (!appApi || !appApi.importKey) {
            debug('API not available or missing importKey method');
            showToast('API not available', 'error');
            return;
        }
        
        // Create a more user-friendly import UI instead of plain prompt
        const keyData = await createImportKeyDialog();
        if (!keyData) {
            debug('User cancelled key import');
            return;
        }
        
        debug('Validating key format...');
        const cleanedKey = keyData.replace(/\s+/g, ''); // Remove whitespace
        
        if (!/^[0-9a-fA-F]{64}$/.test(cleanedKey)) {
            debug('Invalid key format:', cleanedKey.length, 'chars');
            showToast('Invalid key format. Must be 64 hex characters (0-9, A-F).', 'error');
            return;
        }
        
        // Show loading state on button
        if (buttonElement) {
            buttonElement.disabled = true;
            const originalContent = buttonElement.innerHTML;
            buttonElement.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Importing...';
        }
        
        // Import the key
        debug('Calling appApi.importKey() with cleaned key:', cleanedKey.substring(0, 8) + '...');
        const result = await appApi.importKey(cleanedKey);
        debug('Key import result:', result);
        
        // Update UI based on result
        if (result && result.success) {
            debug('Key import successful:', result);
            updateKeyStatus(true, result.keyId);
            updateUIForKeyStatus(true, result.keyId);
            showToast('Key imported successfully!', 'success');
        } else {
            debug('Key import failed:', result);
            updateKeyStatus(false);
            updateUIForKeyStatus(false, null);
            showToast(`Failed to import key: ${result?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        debug('Error importing key:', error);
        showToast(`Error importing key: ${error.message}`, 'error');
        updateKeyStatus(false);
        updateUIForKeyStatus(false, null);
    } finally {
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Import Key';
        }
    }
}

/**
 * Creates a dialog for key import with validation
 * @returns {Promise<string|null>} The key data or null if cancelled
 */
function createImportKeyDialog() {
    return new Promise((resolve) => {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
        overlay.style.zIndex = '1000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        
        // Create modal content
        const modal = document.createElement('div');
        modal.style.backgroundColor = 'var(--bg-card, #1e232d)';
        modal.style.borderRadius = '8px';
        modal.style.padding = '20px';
        modal.style.width = '500px';
        modal.style.maxWidth = '90%';
        modal.style.border = '1px solid var(--border-color, rgba(255, 255, 255, 0.1))';
        modal.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        
        // Create title
        const title = document.createElement('h3');
        title.textContent = 'Import Encryption Key';
        title.style.fontSize = '1.2rem';
        title.style.marginBottom = '15px';
        title.style.fontWeight = '500';
        
        // Create description
        const desc = document.createElement('p');
        desc.textContent = 'Paste your 64-character hex key (0-9, A-F)';
        desc.style.fontSize = '0.9rem';
        desc.style.marginBottom = '15px';
        desc.style.color = 'var(--text-secondary, rgba(255, 255, 255, 0.6))';
        
        // Create input
        const input = document.createElement('textarea');
        input.placeholder = 'Paste your key here...';
        input.style.width = '100%';
        input.style.padding = '10px';
        input.style.height = '100px';
        input.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        input.style.border = '1px solid var(--border-color, rgba(255, 255, 255, 0.1))';
        input.style.borderRadius = '4px';
        input.style.color = 'var(--text-primary, rgba(255, 255, 255, 0.9))';
        input.style.fontSize = '0.9rem';
        input.style.fontFamily = 'monospace';
        input.style.resize = 'none';
        input.style.marginBottom = '15px';
        
        // Create validation message
        const validation = document.createElement('p');
        validation.style.fontSize = '0.85rem';
        validation.style.marginBottom = '15px';
        validation.style.color = 'var(--accent-danger, #e64a4a)';
        validation.style.display = 'none';
        
        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '10px';
        
        // Create cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.padding = '8px 16px';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        cancelBtn.style.color = 'var(--text-primary, rgba(255, 255, 255, 0.9))';
        cancelBtn.style.border = 'none';
        cancelBtn.style.cursor = 'pointer';
        
        // Create import button
        const importBtn = document.createElement('button');
        importBtn.textContent = 'Import';
        importBtn.style.padding = '8px 16px';
        importBtn.style.borderRadius = '6px';
        importBtn.style.backgroundColor = 'var(--accent-blue, #3e8ae6)';
        importBtn.style.color = 'white';
        importBtn.style.border = 'none';
        importBtn.style.cursor = 'pointer';
        importBtn.disabled = true;
        importBtn.style.opacity = '0.5';
        
        // Add input validation
        input.addEventListener('input', () => {
            const value = input.value.replace(/\s+/g, '');
            
            if (value.length === 0) {
                validation.style.display = 'none';
                importBtn.disabled = true;
                importBtn.style.opacity = '0.5';
                return;
            }
            
            if (!/^[0-9a-fA-F]+$/.test(value)) {
                validation.textContent = 'Key must contain only hexadecimal characters (0-9, A-F)';
                validation.style.display = 'block';
                importBtn.disabled = true;
                importBtn.style.opacity = '0.5';
                return;
            }
            
            if (value.length !== 64) {
                validation.textContent = `Key must be exactly 64 characters (current: ${value.length})`;
                validation.style.display = 'block';
                importBtn.disabled = true;
                importBtn.style.opacity = '0.5';
                return;
            }
            
            validation.style.display = 'none';
            importBtn.disabled = false;
            importBtn.style.opacity = '1';
        });
        
        // Handle button clicks
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null);
        });
        
        importBtn.addEventListener('click', () => {
            const value = input.value.replace(/\s+/g, '');
            document.body.removeChild(overlay);
            resolve(value);
        });
        
        // Close on escape key
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                resolve(null);
            }
        });
        
        // Assemble modal
        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(importBtn);
        
        modal.appendChild(title);
        modal.appendChild(desc);
        modal.appendChild(input);
        modal.appendChild(validation);
        modal.appendChild(buttonContainer);
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Focus the input
        setTimeout(() => input.focus(), 50);
    });
}

/**
 * Creates a custom key from a passphrase
 * @param {Object} appApi - The electron API for IPC communication
 * @param {HTMLElement} buttonElement - The button element that triggered the creation
 */
export async function createCustomKey(appApi, buttonElement) {
    debug('Creating custom key...');
    try {
        if (!appApi || !appApi.createCustomKey) {
            debug('API not available or missing createCustomKey method');
            showToast('API not available', 'error');
            return;
        }
        
        // Get passphrase from input
        const passInput = document.getElementById('custom-key-input');
        const passphrase = passInput ? passInput.value : '';
        
        if (!passphrase || calculateEntropy(passphrase) < 60) {
            debug('Passphrase too weak');
            showToast('Enter a stronger passphrase (mix of uppercase, lowercase, numbers, and symbols)', 'error');
            return;
        }
        
        // Show loading state
        if (buttonElement) buttonElement.disabled = true;
        
        // Create the custom key
        debug('Calling appApi.createCustomKey()...');
        const result = await appApi.createCustomKey(passphrase, passphrase);
        debug('Custom key creation result:', result);
        
        // Update UI based on result
        if (result && result.success) {
            debug('Custom key creation successful:', result);
            updateKeyStatus(true, result.keyId);
            updateUIForKeyStatus(true, result.keyId);
            showToast('Custom key created successfully!', 'success');
            
            // Clear the input field
            if (passInput) passInput.value = '';
            updateEntropyMeter('');
        } else {
            debug('Custom key creation failed:', result);
            updateKeyStatus(false);
            updateUIForKeyStatus(false, null);
            showToast(`Failed to create custom key: ${result?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        debug('Error creating custom key:', error);
        showToast(`Error creating custom key: ${error.message}`, 'error');
        updateKeyStatus(false);
        updateUIForKeyStatus(false, null);
    } finally {
        if (buttonElement) buttonElement.disabled = false;
    }
}

// Immediately-invoked function to set up when script loads
(function() {
    debug('Key management script loaded');
    
    // Set up when DOM is ready (works whether this script is loaded before or after DOM is ready)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initializeUI());
    } else {
        // DOM already loaded
        initializeUI();
    }
    
    // Backup check to initialize 1 second after load (in case of timing issues)
    setTimeout(() => {
        if (!isInitialized) {
            debug('Initializing via backup timeout');
            initializeUI();
        }
    }, 1000);
})();
