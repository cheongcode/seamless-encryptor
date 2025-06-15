/**
 * Toast notification utility
 * Provides visual feedback to users for actions
 */

// Store active toasts to prevent duplicates
let activeToasts = new Set();

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast ('success', 'error', 'warning', 'info')
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 4000) {
    // Prevent duplicates within a short timeframe
    const toastId = `${message}-${type}`;
    if (activeToasts.has(toastId)) return;
    activeToasts.add(toastId);
    
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.style.minWidth = '250px';
    toast.style.margin = '10px 0';
    toast.style.padding = '14px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.animation = 'slide-in 0.2s ease-out forwards';
    toast.style.transition = 'all 0.3s ease';
    toast.style.cursor = 'pointer';
    toast.style.fontSize = '0.9rem';
    
    // Set color based on type
    switch (type) {
        case 'success':
            toast.style.backgroundColor = 'var(--accent-success, #4ade80)';
            toast.style.color = '#fff';
            break;
        case 'error':
            toast.style.backgroundColor = 'var(--accent-danger, #e64a4a)';
            toast.style.color = '#fff';
            break;
        case 'warning':
            toast.style.backgroundColor = 'var(--accent-warning, #e6a43e)';
            toast.style.color = '#fff';
            break;
        default: // info
            toast.style.backgroundColor = 'var(--accent-blue, #3e8ae6)';
            toast.style.color = '#fff';
    }
    
    // Add icon based on type
    let icon = '';
    switch (type) {
        case 'success':
            icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 10px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
            break;
        case 'error':
            icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 10px;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
            break;
        case 'warning':
            icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 10px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
            break;
        default: // info
            icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 10px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }
    
    toast.innerHTML = icon + message;
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.marginLeft = 'auto';
    closeBtn.style.fontSize = '1.2rem';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        removeToast(toast, toastId);
    };
    toast.appendChild(closeBtn);
    
    // Add CSS for animations
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slide-in {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes fade-out {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Click to dismiss
    toast.onclick = () => removeToast(toast, toastId);
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        if (document.body.contains(toast)) {
            removeToast(toast, toastId);
        }
    }, duration);
}

/**
 * Remove a toast with animation
 * @param {HTMLElement} toast - The toast element
 * @param {string} toastId - The toast ID for tracking
 */
function removeToast(toast, toastId) {
    toast.style.animation = 'fade-out 0.2s ease-out forwards';
    
    // Remove from DOM after animation
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
        activeToasts.delete(toastId);
        
        // Remove container if empty
        const container = document.getElementById('toast-container');
        if (container && container.children.length === 0) {
            document.body.removeChild(container);
        }
    }, 200);
}
