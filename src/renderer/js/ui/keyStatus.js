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
        // Main page elements
        keyIndicator: document.getElementById('key-indicator'),
        keyStatus: document.getElementById('key-status'),
        
        // Settings page elements
        settingsKeyIndicator: document.getElementById('settings-key-indicator'),
        settingsKeyStatus: document.getElementById('settings-key-status'),
        
        // Key management page elements
        keyInfoIndicator: document.getElementById('key-info-indicator'),
        keyInfoStatus: document.getElementById('key-info-status'),
        noKeyWarning: document.getElementById('no-key-warning'),
        keyDetails: document.getElementById('key-details'),
        currentKeyId: document.getElementById('current-key-id')
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
        
        // Key Management page indicator
        if (elements.keyInfoIndicator) {
            elements.keyInfoIndicator.className = 'status-dot active';
        }
        if (elements.keyInfoStatus) {
            elements.keyInfoStatus.className = 'status-text active';
            elements.keyInfoStatus.textContent = keyId ? `Key Active (ID: ${keyId})` : 'Key Active';
        }
        
        // Show key details & hide warning
        if (elements.keyDetails) {
            elements.keyDetails.style.display = 'grid';
        }
        if (elements.currentKeyId && keyId) {
            elements.currentKeyId.textContent = keyId;
        }
        if (elements.noKeyWarning) {
            elements.noKeyWarning.style.display = 'none';
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
        
        // Key Management page indicator
        if (elements.keyInfoIndicator) {
            elements.keyInfoIndicator.className = 'status-dot inactive';
        }
        if (elements.keyInfoStatus) {
            elements.keyInfoStatus.className = 'status-text inactive';
            elements.keyInfoStatus.textContent = 'No Key Available';
        }
        
        // Hide key details & show warning
        if (elements.keyDetails) {
            elements.keyDetails.style.display = 'none';
        }
        if (elements.noKeyWarning) {
            elements.noKeyWarning.style.display = 'flex';
        }
    }
}
