/**
 * Simple Renderer - Browser-compatible version
 */

console.log('Simple renderer starting...');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM ready, initializing app...');
    
    // Hide loading screen after 1 second
    setTimeout(function() {
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        if (loadingScreen && app) {
            loadingScreen.classList.add('hidden');
            app.classList.remove('hidden');
            console.log('App is now visible!');
        }
        
        // Initialize the app
        initApp();
    }, 1000);
});

function initApp() {
    console.log('Initializing application...');
    
    // Setup navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = item.getAttribute('data-section');
            if (section) {
                switchSection(section);
            }
        });
    });
    
    // Setup dashboard buttons
    const dashboardEncryptBtn = document.getElementById('dashboard-encrypt-btn');
    if (dashboardEncryptBtn) {
        dashboardEncryptBtn.addEventListener('click', function() {
            switchSection('encryption');
        });
    }
    
    const dashboardGenerateKeyBtn = document.getElementById('dashboard-generate-key-btn');
    if (dashboardGenerateKeyBtn) {
        dashboardGenerateKeyBtn.addEventListener('click', function() {
            showToast('Key generation feature coming soon!', 'info');
        });
    }
    
    const dashboardViewFilesBtn = document.getElementById('dashboard-view-files-btn');
    if (dashboardViewFilesBtn) {
        dashboardViewFilesBtn.addEventListener('click', function() {
            switchSection('files');
        });
    }
    
    const dashboardSettingsBtn = document.getElementById('dashboard-settings-btn');
    if (dashboardSettingsBtn) {
        dashboardSettingsBtn.addEventListener('click', function() {
            switchSection('settings');
        });
    }
    
    // Setup file operations
    const browseFilesBtn = document.getElementById('browse-files-btn');
    if (browseFilesBtn) {
        browseFilesBtn.addEventListener('click', function() {
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.click();
            }
        });
    }
    
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const files = Array.from(e.target.files);
            showToast('Selected ' + files.length + ' file(s) for encryption', 'success');
        });
    }
    
    // Setup drag and drop
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.classList.add('active');
        });
        
        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dropZone.classList.remove('active');
        });
        
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.classList.remove('active');
            const files = Array.from(e.dataTransfer.files);
            showToast('Dropped ' + files.length + ' file(s) for encryption', 'success');
        });
        
        dropZone.addEventListener('click', function() {
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.click();
            }
        });
    }
    
    // Setup key management
    const generateKeyBtn = document.getElementById('generate-key-btn');
    if (generateKeyBtn) {
        generateKeyBtn.addEventListener('click', function() {
            showToast('Generating encryption key...', 'info');
            setTimeout(function() {
                showToast('Encryption key generated successfully!', 'success');
                updateKeyStatus(true);
            }, 2000);
        });
    }
    
    const importKeyBtn = document.getElementById('import-key-btn');
    if (importKeyBtn) {
        importKeyBtn.addEventListener('click', function() {
            showToast('Key import feature coming soon!', 'info');
        });
    }
    
    // Setup other buttons
    const quickEncryptBtn = document.getElementById('quick-encrypt-btn');
    if (quickEncryptBtn) {
        quickEncryptBtn.addEventListener('click', function() {
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.click();
            }
        });
    }
    
    const refreshFilesBtn = document.getElementById('refresh-files-btn');
    if (refreshFilesBtn) {
        refreshFilesBtn.addEventListener('click', function() {
            showToast('Refreshing file list...', 'info');
            loadDemoFiles();
        });
    }
    
    console.log('Application initialized successfully!');
    
    // Load initial data
    updateKeyStatus(false);
    loadDemoFiles();
}

function switchSection(sectionName) {
    console.log('Switching to section:', sectionName);
    
    // Update navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function(item) {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === sectionName) {
            item.classList.add('active');
        }
    });
    
    // Update sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(function(section) {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
    }
    
    // Update header
    const titles = {
        dashboard: { title: 'Dashboard', subtitle: 'Secure file encryption and management' },
        encryption: { title: 'Encrypt Files', subtitle: 'Drag and drop files to encrypt them securely' },
        files: { title: 'Encrypted Files', subtitle: 'Manage your encrypted files' },
        keys: { title: 'Key Management', subtitle: 'Generate and manage encryption keys' },
        settings: { title: 'Settings', subtitle: 'Configure application preferences' }
    };
    
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    if (pageTitle && pageSubtitle && titles[sectionName]) {
        pageTitle.textContent = titles[sectionName].title;
        pageSubtitle.textContent = titles[sectionName].subtitle;
    }
    
    // Load section-specific data
    if (sectionName === 'files') {
        loadDemoFiles();
    } else if (sectionName === 'keys') {
        updateKeyInfo();
    }
}

function updateKeyStatus(hasKey) {
    const indicator = document.getElementById('key-indicator');
    const statusText = document.getElementById('key-status-text');
    const statusDetail = document.getElementById('key-status-detail');
    
    if (hasKey) {
        if (indicator) indicator.className = 'key-indicator active';
        if (statusText) statusText.textContent = 'Key Active';
        if (statusDetail) statusDetail.textContent = 'ID: demo-key-123';
    } else {
        if (indicator) indicator.className = 'key-indicator';
        if (statusText) statusText.textContent = 'No Key';
        if (statusDetail) statusDetail.textContent = 'Generate or import a key';
    }
    
    updateKeyInfo(hasKey);
}

function updateKeyInfo(hasKey) {
    const keyInfo = document.getElementById('key-info');
    if (!keyInfo) return;
    
    if (hasKey) {
        keyInfo.innerHTML = '<div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background-color: rgba(16, 185, 129, 0.1); border: 1px solid #059669; border-radius: 8px;"><div style="display: flex; align-items: center; gap: 12px;"><div style="width: 12px; height: 12px; background-color: #10b981; border-radius: 50%;"></div><div><p style="font-size: 14px; font-weight: 500; color: white;">Encryption Key Active</p><p style="font-size: 12px; color: #6ee7b7;">ID: demo-key-123</p></div></div><svg style="width: 20px; height: 20px; color: #10b981;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>';
    } else {
        keyInfo.innerHTML = '<div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid #dc2626; border-radius: 8px;"><div style="display: flex; align-items: center; gap: 12px;"><div style="width: 12px; height: 12px; background-color: #ef4444; border-radius: 50%;"></div><div><p style="font-size: 14px; font-weight: 500; color: white;">No Encryption Key</p><p style="font-size: 12px; color: #fca5a5;">Generate or import a key to start encrypting</p></div></div><svg style="width: 20px; height: 20px; color: #ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg></div>';
    }
}

function loadDemoFiles() {
    const filesContainer = document.getElementById('files-container');
    if (!filesContainer) return;
    
    filesContainer.innerHTML = '<div style="text-align: center; padding: 48px;"><svg style="width: 64px; height: 64px; color: #6b7280; margin: 0 auto 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><h3 style="font-size: 18px; font-weight: 500; color: #9ca3af; margin-bottom: 8px;">No encrypted files</h3><p style="color: #6b7280;">Start by encrypting some files to see them here</p></div>';
}

function showToast(message, type) {
    console.log('Toast:', type, '-', message);
    
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 12px 24px; border-radius: 8px; color: white; font-weight: 500; z-index: 1000; max-width: 400px; transform: translateX(100%); transition: transform 0.3s ease; background-color: ' + (type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#2563eb') + '; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(function() {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(function() {
        toast.style.transform = 'translateX(100%)';
        setTimeout(function() {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

console.log('Simple renderer loaded successfully!'); 