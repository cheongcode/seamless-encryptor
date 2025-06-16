// Seamless Encryptor - settings.js

// DOM Elements
const settingsForm = {
    autoDelete: document.getElementById('setting-auto-delete'),
    compress: document.getElementById('setting-compress'),
    notifications: document.getElementById('setting-notifications'),
    confirmActions: document.getElementById('setting-confirm-actions'),
    outputDirDisplay: document.getElementById('current-output-dir'),
    browseOutputDirBtn: document.getElementById('browse-output-dir'),
    clearAppDataBtn: document.getElementById('clear-app-data'),
    debugMode: document.getElementById('setting-debug-mode'),
    resetDefaultsBtn: document.getElementById('reset-defaults'),
    saveSettingsBtn: document.getElementById('save-settings'),
    gdriveAutoUpload: document.getElementById('setting-gdrive-auto-upload'),
    appVersionSpan: document.getElementById('app-version')
};

const DEFAULT_SETTINGS = {
    autoDelete: false,
    compress: true,
    notifications: true,
    confirmActions: true,
    outputDir: null,
    debugMode: false,
    gdriveConnected: false,
    gdriveUserEmail: null,
    gdriveAutoUpload: false
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Settings] DOMContentLoaded');
    await loadSettings();
    setupEventListeners();
    await loadAppVersion();
});

async function loadAppVersion() {
    if (window.api && typeof window.api.getAppVersion === 'function' && settingsForm.appVersionSpan) {
        try {
            const version = await window.api.getAppVersion();
            settingsForm.appVersionSpan.textContent = version || '1.0.0';
        } catch (error) {
            console.error('[Settings] Error fetching app version:', error);
            settingsForm.appVersionSpan.textContent = 'N/A';
        }
    }
}

async function loadSettings() {
    console.log('[Settings] Loading settings...');
    try {
        const currentSettings = await window.settingsApi?.getAppSettings();
        console.log('[Settings] Raw settings from main:', currentSettings);
        
        if (currentSettings) {
            updateForm(currentSettings);
            console.log('[Settings] Settings loaded and form updated:', currentSettings);
        } else {
            console.warn('[Settings] No settings returned from main. Applying defaults.');
            updateForm(DEFAULT_SETTINGS);
        }

        // Always ensure we have a valid output directory displayed
        if (!settingsForm.outputDirDisplay.textContent || 
            settingsForm.outputDirDisplay.textContent === 'Not set' || 
            settingsForm.outputDirDisplay.textContent === '~/Documents/Encrypted') {
            console.log('[Settings] Output directory not set, getting default...');
            const defaultPath = await window.settingsApi?.getDefaultOutputDir();
            console.log('[Settings] Default output directory:', defaultPath);
            if (defaultPath) {
                settingsForm.outputDirDisplay.textContent = defaultPath;
            }
        }
    } catch (error) {
        console.error('[Settings] Error loading settings:', error);
        updateForm(DEFAULT_SETTINGS);
    }
}

function updateForm(settings) {
    if (!settings) return;
    if (settingsForm.autoDelete) settingsForm.autoDelete.checked = settings.autoDelete;
    if (settingsForm.compress) settingsForm.compress.checked = settings.compress;
    if (settingsForm.notifications) settingsForm.notifications.checked = settings.notifications;
    if (settingsForm.confirmActions) settingsForm.confirmActions.checked = settings.confirmActions;
    if (settingsForm.outputDirDisplay) settingsForm.outputDirDisplay.textContent = settings.outputDir || 'Not set';
    if (settingsForm.debugMode) settingsForm.debugMode.checked = settings.debugMode;

    if (settingsForm.gdriveAutoUpload) {
        settingsForm.gdriveAutoUpload.checked = settings.gdriveAutoUpload || false;
        settingsForm.gdriveAutoUpload.disabled = !(settings.gdriveConnected || false);
    }
}

function setupEventListeners() {
    if (settingsForm.saveSettingsBtn) {
        settingsForm.saveSettingsBtn.addEventListener('click', handleSaveSettings);
    }
    if (settingsForm.resetDefaultsBtn) {
        settingsForm.resetDefaultsBtn.addEventListener('click', handleResetDefaults);
    }
    if (settingsForm.browseOutputDirBtn) {
        settingsForm.browseOutputDirBtn.addEventListener('click', handleBrowseOutputDir);
    }
    if (settingsForm.clearAppDataBtn) {
        settingsForm.clearAppDataBtn.addEventListener('click', handleClearAppData);
    }
}

async function handleSaveSettings() {
    console.log('[Settings] Save Changes button clicked');
    
    // Get the current output directory text - could be from display or input
    let outputDirValue = settingsForm.outputDirDisplay?.textContent;
    
    // Handle case where output directory might be in an input field instead
    const outputDirInput = document.getElementById('output-dir-input');
    if (outputDirInput && outputDirInput.value) {
        outputDirValue = outputDirInput.value;
    }
    
    // If still not found, check for any input with output dir
    if (!outputDirValue || outputDirValue === 'Not set') {
        const allInputs = document.querySelectorAll('input[type="text"], input[type="url"]');
        for (const input of allInputs) {
            if (input.placeholder && input.placeholder.includes('output') || 
                input.id && input.id.includes('output') ||
                input.name && input.name.includes('output')) {
                if (input.value) {
                    outputDirValue = input.value;
                    break;
                }
            }
        }
    }
    
    console.log('[Settings] Output directory value being saved:', outputDirValue);
    
    const newSettings = {
        autoDelete: settingsForm.autoDelete?.checked || false,
        compress: settingsForm.compress?.checked !== false, // Default to true
        notifications: settingsForm.notifications?.checked !== false, // Default to true
        confirmActions: settingsForm.confirmActions?.checked !== false, // Default to true
        outputDir: outputDirValue && outputDirValue !== 'Not set' ? outputDirValue : null,
        debugMode: settingsForm.debugMode?.checked || false,
        gdriveAutoUpload: settingsForm.gdriveAutoUpload?.checked || false
    };

    console.log('[Settings] Full settings object being saved:', newSettings);

    try {
        const success = await window.settingsApi?.setAppSettings(newSettings);
        console.log('[Settings] Save result:', success);
        
        if (success) {
            showToast('Settings saved successfully!', 'success');
        } else {
            showToast('Error: Could not save settings.', 'error');
        }
    } catch (error) {
        console.error('[Settings] Error saving settings:', error);
        showToast(`Error saving settings: ${error.message}`, 'error');
    }
}

async function handleResetDefaults() {
    console.log('[Settings] Reset to Defaults button clicked');
    if (!confirm('Are you sure you want to reset all settings to their default values?')) return;
    try {
        const success = await window.settingsApi?.resetAppSettings();
        if (success) {
            await loadSettings(); 
            showToast('Settings have been reset to defaults.', 'success');
        } else {
            showToast('Error: Could not reset settings.', 'error');
        }
    } catch (error) {
        showToast(`Error resetting settings: ${error.message}`, 'error');
    }
}

async function handleBrowseOutputDir() {
    console.log('[Settings] Browse Output Directory button clicked');
    
    // Disable button to prevent multiple clicks
    if (settingsForm.browseOutputDirBtn) {
        settingsForm.browseOutputDirBtn.disabled = true;
    }
    
    try {
        console.log('[Settings] Calling selectOutputDirectory...');
        const selectedPath = await window.settingsApi?.selectOutputDirectory();
        console.log('[Settings] Selected path result:', selectedPath);
        
        if (selectedPath && settingsForm.outputDirDisplay) {
            console.log('[Settings] Updating display with selected path:', selectedPath);
            settingsForm.outputDirDisplay.textContent = selectedPath;
            
            // Auto-save the setting when directory is selected
            console.log('[Settings] Auto-saving settings after directory selection...');
            await handleSaveSettings();
            showToast('Output directory updated successfully!', 'success');
        } else if (selectedPath === null) {
            console.log('[Settings] User cancelled directory selection');
            showToast('Directory selection cancelled', 'info');
        } else {
            console.warn('[Settings] No valid path selected, selectedPath:', selectedPath);
            showToast('No directory selected', 'warning');
        }
    } catch (error) {
        console.error('[Settings] Error selecting directory:', error);
        showToast(`Error selecting directory: ${error.message}`, 'error');
    } finally {
        // Re-enable button
        if (settingsForm.browseOutputDirBtn) {
            settingsForm.browseOutputDirBtn.disabled = false;
        }
    }
}

async function handleClearAppData() {
    console.log('[Settings] Clear App Data button clicked');
    if (!confirm('Are you sure you want to clear all application data? This cannot be undone.')) return;
    try {
        const success = await window.settingsApi?.clearAppData();
        if (success) {
            await loadSettings(); 
            showToast('Application data has been cleared. Please restart if needed.', 'success', 5000);
        } else {
            showToast('Error: Could not clear app data.', 'error');
        }
    } catch (error) {
        showToast(`Error clearing app data: ${error.message}`, 'error');
    }
}

function showToast(message, type = 'info', duration = 3000) {
    console.log(`[Toast-${type}] ${message} (duration: ${duration}ms)`);
    const toastId = 'settings-toast';
    let toastElement = document.getElementById(toastId);
    if (!toastElement) {
        toastElement = document.createElement('div');
        toastElement.id = toastId;
        Object.assign(toastElement.style, {
            position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            padding: '10px 20px', borderRadius: '5px', zIndex: '1000', transition: 'opacity 0.5s ease',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)', fontWeight: '500'
        });
        document.body.appendChild(toastElement);
    }
    toastElement.textContent = message;
    toastElement.style.opacity = '1';
    const colors = { success: {bg: '#4CAF50', text: 'white'}, error: {bg: '#f44336', text: 'white'}, warning: {bg: '#ff9800', text: 'black'}, info: {bg: '#2196F3', text: 'white'} };
    toastElement.style.backgroundColor = colors[type]?.bg || colors.info.bg;
    toastElement.style.color = colors[type]?.text || colors.info.text;
    setTimeout(() => { toastElement.style.opacity = '0'; }, duration);
}

console.log('[Settings] settings.js loaded'); 