/**
 * Formatting utility functions
 */

/**
 * Formats a file size in bytes to a human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size (e.g., "2.5 MB")
 */
export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Returns a CSS class based on entropy value
 * @param {number} entropy - Entropy value between 0 and 1
 * @returns {string} CSS class name
 */
export function getEntropyClass(entropy) {
    if (entropy < 0.3) return 'entropy-low';
    if (entropy < 0.7) return 'entropy-medium';
    return 'entropy-high';
}

/**
 * Formats a date to a localized string
 * @param {Date|number|string} date - Date object, timestamp, or date string
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
    if (!date) return 'Unknown';
    try {
        return new Date(date).toLocaleString();
    } catch (e) {
        console.error('[format.js] Error formatting date:', e);
        return 'Invalid date';
    }
}
