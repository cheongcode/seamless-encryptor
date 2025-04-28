/**
 * Key management functions
 */
import { showToast } from '../utils/toast.js';
import { updateKeyStatus } from '../ui/keyStatus.js';

/**
 * Generates a new encryption key
 * @param {Object} appApi - The electron API for IPC communication
 * @param {HTMLElement} buttonElement - The button element that triggered the generation
 */
export async function generateKey(appApi, buttonElement) {
    console.log('[keyManagement.js] Generating new key...');
    try {
        if (!appApi || !appApi.generateKey) {
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
        const result = await appApi.generateKey();
        console.log('[keyManagement.js] Key generation result:', result);
        
        // Update UI based on result
        if (result && result.success) {
            updateKeyStatus(true, result.keyId);
            showToast('New encryption key generated successfully!', 'success');
        } else {
            updateKeyStatus(false);
            showToast(`Failed to generate key: ${result?.error || 'Unknown error'}`, 'error');
            console.error('[keyManagement.js] Key generation error:', result?.error);
        }
    } catch (error) {
        console.error('[keyManagement.js] Error generating key:', error);
        showToast(`Error generating key: ${error.message}`, 'error');
        updateKeyStatus(false);
    } finally {
        // Reset button state if provided
        if (buttonElement) {
            buttonElement.disabled = false;
            
            // Use the appropriate icon based on the button's role
            if (buttonElement.id === 'generate-key-button' || buttonElement.id === 'warning-generate-key') {
                buttonElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 mr-2"><path fill-rule="evenodd" d="M10 1.5a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1.5zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" /></svg> Generate New Key';
            } else if (buttonElement.id === 'generate-key-link') {
                buttonElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M10.5 3.75a6 6 0 00-5.98 6.496A5.25 5.25 0 006.75 20.25h10.5a5.25 5.25 0 005.25-5.25c0-2.76-2.124-5.008-4.824-5.23a6 6 0 00-7.176-6.02zM12 11.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V12a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" /></svg> Generate Key';
            } else {
                // Default fallback
                buttonElement.textContent = 'Generate Key';
            }
        }
    }
}

/**
 * Checks if an encryption key exists
 * @param {Object} appApi - The electron API for IPC communication
 */
export async function checkEncryptionKey(appApi) {
    try {
        console.log('[keyManagement.js] Checking if encryption key exists...');
        
        if (!appApi) {
            console.error('[keyManagement.js] API not available');
            updateKeyStatus(false);
            return false;
        }
        
        // Use getKeyStatus if available, otherwise fall back to testIPC
        if (appApi.getKeyStatus) {
            const result = await appApi.getKeyStatus();
            console.log('[keyManagement.js] Key status result:', result);
            updateKeyStatus(result.exists, result.keyId);
            return result.exists;
        } else {
            // Fallback if no direct method available
            const result = await appApi.testIPC();
            console.log('[keyManagement.js] Test IPC result:', result);
            
            // For now, assume no key exists
            // This should be updated with actual key detection logic
            updateKeyStatus(false);
            return false;
        }
    } catch (error) {
        console.error('[keyManagement.js] Error checking encryption key:', error);
        updateKeyStatus(false);
        return false;
    }
}
