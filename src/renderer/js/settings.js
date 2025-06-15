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
        if (currentSettings) {
            updateForm(currentSettings);
            console.log('[Settings] Settings loaded:', currentSettings);
        } else {
            console.warn('[Settings] No settings returned from main. Applying defaults.');
            updateForm(DEFAULT_SETTINGS);
        }

        if (!settingsForm.outputDirDisplay.textContent || settingsForm.outputDirDisplay.textContent === 'Not set' || settingsForm.outputDirDisplay.textContent === '~/Documents/Encrypted') {
            const defaultPath = await window.settingsApi?.getDefaultOutputDir();
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
    const newSettings = {
        autoDelete: settingsForm.autoDelete?.checked,
        compress: settingsForm.compress?.checked,
        notifications: settingsForm.notifications?.checked,
        confirmActions: settingsForm.confirmActions?.checked,
        outputDir: settingsForm.outputDirDisplay?.textContent,
        debugMode: settingsForm.debugMode?.checked,
        gdriveAutoUpload: settingsForm.gdriveAutoUpload?.checked
    };

    try {
        const success = await window.settingsApi?.setAppSettings(newSettings);
        if (success) {
            showToast('Settings saved successfully!', 'success');
        } else {
            showToast('Error: Could not save settings.', 'error');
        }
    } catch (error) {
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
    try {
        const selectedPath = await window.settingsApi?.selectOutputDirectory();
        if (selectedPath && settingsForm.outputDirDisplay) {
            settingsForm.outputDirDisplay.textContent = selectedPath;
        }
    } catch (error) {
        showToast(`Error selecting directory: ${error.message}`, 'error');
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