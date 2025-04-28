/**
 * Key status UI management
 */

/**
 * Updates all key status indicators in the UI
 * @param {boolean} isAvailable - Whether a key is available
 * @param {string|null} keyId - Optional key ID to display
 */
export function updateKeyStatus(isAvailable, keyId = null) {
    console.log('[keyStatus.js] Updating key status:', isAvailable, keyId);
    
    // Find all key status elements
    const elements = {
        keyIndicator: document.getElementById('key-indicator'),
        keyStatus: document.getElementById('key-status'),
        settingsKeyIndicator: document.getElementById('settings-key-indicator'),
        settingsKeyStatus: document.getElementById('settings-key-status'),
        noKeyWarning: document.getElementById('no-key-warning')
    };
    
    if (isAvailable) {
        // Main indicator
        if (elements.keyIndicator) {
            elements.keyIndicator.className = 'inline-block w-2 h-2 rounded-full mr-2 bg-success';
        }
        if (elements.keyStatus) {
            elements.keyStatus.className = 'text-success text-sm';
            elements.keyStatus.textContent = keyId ? `Active (${keyId})` : 'Active';
        }
        
        // Settings indicator
        if (elements.settingsKeyIndicator) {
            elements.settingsKeyIndicator.className = 'inline-block w-2 h-2 rounded-full mr-2 bg-success';
        }
        if (elements.settingsKeyStatus) {
            elements.settingsKeyStatus.className = 'text-success text-sm';
            elements.settingsKeyStatus.textContent = keyId ? `Active (${keyId})` : 'Active';
        }
        
        // Hide warning
        if (elements.noKeyWarning) {
            elements.noKeyWarning.classList.add('hidden');
        }
    } else {
        // Main indicator
        if (elements.keyIndicator) {
            elements.keyIndicator.className = 'inline-block w-2 h-2 rounded-full mr-2 bg-danger';
        }
        if (elements.keyStatus) {
            elements.keyStatus.className = 'text-danger text-sm';
            elements.keyStatus.textContent = 'Not Set';
        }
        
        // Settings indicator
        if (elements.settingsKeyIndicator) {
            elements.settingsKeyIndicator.className = 'inline-block w-2 h-2 rounded-full mr-2 bg-danger';
        }
        if (elements.settingsKeyStatus) {
            elements.settingsKeyStatus.className = 'text-danger text-sm';
            elements.settingsKeyStatus.textContent = 'Not Set';
        }
        
        // Show warning
        if (elements.noKeyWarning) {
            elements.noKeyWarning.classList.remove('hidden');
        }
    }
}
