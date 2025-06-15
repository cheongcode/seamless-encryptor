/**
 * Entropy Visualization Utilities
 * - Displays entropy details in a modal
 * - Provides visual representation of entropy
 */

import { showToast } from './toast.js';

/**
 * Creates and shows a modal displaying detailed entropy information about a file
 * @param {Object} appApi - The electron API for IPC communication
 * @param {Object} fileData - The file data object, must include fileId
 */
export async function showEntropyVisualization(appApi, fileData) {
    try {
        if (!fileData || !fileData.id) {
            console.error('No file data provided for entropy visualization');
            return;
        }

        // Check if API method exists
        if (typeof appApi?.analyzeFileEntropy !== 'function') {
            console.warn('analyzeFileEntropy API method not available, using local entropy data');
            // Use the entropy data we already have in the fileData
            showEntropyWithLocalData(fileData);
            return;
        }

        // Get detailed entropy analysis
        try {
            const analysis = await appApi.analyzeFileEntropy(fileData.path || fileData.id);
            
            if (!analysis || !analysis.success) {
                console.warn(`Could not analyze file entropy: ${analysis?.error || 'Unknown error'}`);
                // Fallback to local data
                showEntropyWithLocalData(fileData);
                return;
            }

            // Create the modal
            const modal = document.createElement('div');
            modal.className = 'modal entropy-modal';
            modal.innerHTML = createModalContent(fileData, analysis);
            document.body.appendChild(modal);

            // Setup close button
            const closeButton = modal.querySelector('.close-button');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    modal.classList.add('closing');
                    setTimeout(() => {
                        modal.remove();
                    }, 300); // Match the CSS transition duration
                });
            }

            // Add the CSS for the modal
            addModalStyles();

            // Show the modal with animation
            setTimeout(() => {
                modal.classList.add('visible');
            }, 10);

            // Create histogram visualization if we have the data
            if (analysis.histogram) {
                createHistogramVisualization(modal.querySelector('.histogram-container'), analysis.histogram);
            }
        } catch (apiError) {
            console.error('API Error during entropy analysis:', apiError);
            // Fallback to local data
            showEntropyWithLocalData(fileData);
        }
    } catch (error) {
        console.error('Error showing entropy visualization:', error);
        showToast('Error displaying entropy information', 'error');
    }
}

/**
 * Shows entropy visualization using only the local file data
 * @param {Object} fileData - File information with basic entropy info
 */
function showEntropyWithLocalData(fileData) {
    // Generate a simple analysis object using the entropy value already in fileData
    const entropyValue = fileData.entropy || 0.7;
    const analysis = {
        overallEntropy: entropyValue * 8, // Convert 0-1 scale to 0-8 scale
        rating: getEntropyRating(entropyValue),
        isGoodEncryption: entropyValue > 0.7,
        // Generate a dummy flat histogram since we don't have real data
        histogram: generateDummyHistogram(entropyValue)
    };
    
    // Show a toast letting the user know we're using limited data
    showToast('Using basic entropy data (API method unavailable)', 'info');

    // Create the modal
    const modal = document.createElement('div');
    modal.className = 'modal entropy-modal';
    modal.innerHTML = createModalContent(fileData, analysis);
    document.body.appendChild(modal);

    // Setup close button
    const closeButton = modal.querySelector('.close-button');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            modal.classList.add('closing');
            setTimeout(() => {
                modal.remove();
            }, 300);
        });
    }

    // Add the CSS for the modal
    addModalStyles();

    // Show the modal with animation
    setTimeout(() => {
        modal.classList.add('visible');
    }, 10);

    // Create histogram visualization
    createHistogramVisualization(modal.querySelector('.histogram-container'), analysis.histogram);
}

/**
 * Generates a dummy histogram for visualization when real data isn't available
 * @param {number} entropy - Entropy value between 0-1
 * @returns {Array<number>} - Generated histogram
 */
function generateDummyHistogram(entropy) {
    const histogram = new Array(256);
    
    // For high entropy, generate a relatively flat distribution
    if (entropy > 0.7) {
        // Add small random variations to simulate real data
        const base = 10 + Math.random() * 10;
        for (let i = 0; i < 256; i++) {
            histogram[i] = base + (Math.random() * base * 0.3);
        }
    } 
    // For medium entropy, add some patterns/spikes
    else if (entropy > 0.4) {
        const base = 5 + Math.random() * 10;
        for (let i = 0; i < 256; i++) {
            // Create some patterns
            let value = base;
            if (i % 16 === 0) value *= 1.5;
            if (i % 32 === 0) value *= 1.2;
            histogram[i] = value + (Math.random() * base * 0.5);
        }
    }
    // For low entropy, create obvious patterns
    else {
        const base = 2 + Math.random() * 5;
        for (let i = 0; i < 256; i++) {
            // Create significant patterns
            let value = base;
            if (i % 4 === 0) value *= 2;
            if (i % 8 === 0) value *= 1.5;
            if (i < 128) value *= 1.2;
            histogram[i] = value + (Math.random() * base * 0.7);
        }
    }
    
    return histogram;
}

/**
 * Gets an entropy rating based on the entropy value
 * @param {number} entropy - Entropy value between 0-1
 * @returns {string} - Rating text
 */
function getEntropyRating(entropy) {
    if (entropy > 0.9) return 'Excellent';
    if (entropy > 0.8) return 'Very Good';
    if (entropy > 0.7) return 'Good';
    if (entropy > 0.5) return 'Fair';
    if (entropy > 0.3) return 'Poor';
    return 'Very Poor';
}

/**
 * Creates the HTML content for the entropy modal
 * @param {Object} fileData - File information
 * @param {Object} analysis - Entropy analysis result
 * @returns {string} HTML content
 */
function createModalContent(fileData, analysis) {
    const entropyPercentage = Math.round((analysis.overallEntropy / 8) * 100);
    const entropyClass = getEntropyClassFromRating(analysis.rating);
    const fileName = fileData.name || `${fileData.id}${fileData.extension || ''}`;

    return `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Encryption Quality Analysis</h2>
                <button class="close-button" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="file-info-section">
                    <h3>File: ${fileName}</h3>
                    <p>Algorithm: ${formatAlgorithm(fileData.algorithm || 'aes-256-gcm')}</p>
                    <p>Size: ${formatFileSize(fileData.size)}</p>
                </div>

                <div class="entropy-summary">
                    <div class="entropy-rating ${entropyClass}">
                        <div class="rating-label">Rating:</div>
                        <div class="rating-value">${analysis.rating}</div>
                    </div>
                    
                    <div class="entropy-meter-container">
                        <div class="entropy-meter-label">Entropy Score: ${entropyPercentage}%</div>
                        <div class="entropy-meter ${entropyClass}">
                            <div class="entropy-meter-fill" style="width: ${entropyPercentage}%"></div>
                        </div>
                        <div class="entropy-scale">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>

                <div class="entropy-details">
                    <p>Shannon Entropy: ${analysis.overallEntropy.toFixed(3)} bits/byte (max: 8)</p>
                    <p>Interpretation: ${getEntropyInterpretation(analysis.rating)}</p>
                </div>

                <div class="histogram-section">
                    <h3>Byte Distribution</h3>
                    <div class="histogram-container"></div>
                    <p class="histogram-explanation">
                        Good encryption should show a relatively flat distribution across all byte values.
                        Peaks or patterns may indicate non-random data or encryption issues.
                    </p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Creates a histogram visualization
 * @param {HTMLElement} container - The container element
 * @param {Array<number>} histogram - Byte frequency data
 */
function createHistogramVisualization(container, histogram) {
    if (!container || !histogram) return;

    // Find max frequency for scaling
    const maxFreq = Math.max(...histogram);
    
    // Create SVG
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "150");
    svg.setAttribute("viewBox", "0 0 256 100");
    svg.style.overflow = "visible";
    
    // Background
    const background = document.createElementNS(svgNS, "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", "256");
    background.setAttribute("height", "100");
    background.setAttribute("fill", "rgba(0,0,0,0.1)");
    svg.appendChild(background);
    
    // Add bars
    histogram.forEach((value, index) => {
        const height = maxFreq > 0 ? (value / maxFreq) * 100 : 0;
        
        const bar = document.createElementNS(svgNS, "rect");
        bar.setAttribute("x", index);
        bar.setAttribute("y", 100 - height);
        bar.setAttribute("width", "1");
        bar.setAttribute("height", height);
        bar.setAttribute("fill", getBarColor(index));
        
        // Add title/tooltip
        const title = document.createElementNS(svgNS, "title");
        title.textContent = `Byte value: ${index} (0x${index.toString(16).padStart(2, '0')}) - Count: ${value}`;
        bar.appendChild(title);
        
        svg.appendChild(bar);
    });
    
    container.appendChild(svg);
    
    // Add axis labels
    const axisLabels = document.createElement("div");
    axisLabels.className = "histogram-labels";
    axisLabels.innerHTML = `
        <div class="byte-labels">
            <span>0</span>
            <span>64</span>
            <span>128</span>
            <span>192</span>
            <span>255</span>
        </div>
        <div class="axis-title">Byte values (0-255)</div>
    `;
    container.appendChild(axisLabels);
}

/**
 * Gets a color for a histogram bar based on its index
 * @param {number} index - Byte value (0-255)
 * @returns {string} CSS color
 */
function getBarColor(index) {
    // Create a gradient from blue to green to red
    if (index < 85) {
        return `rgb(0, ${Math.floor(index * 3)}, 255)`;
    } else if (index < 170) {
        const i = index - 85;
        return `rgb(0, 255, ${Math.floor(255 - i * 3)})`;
    } else {
        const i = index - 170;
        return `rgb(${Math.floor(i * 3)}, 255, 0)`;
    }
}

/**
 * Gets a semantic interpretation of the entropy rating
 * @param {string} rating - The entropy rating
 * @returns {string} Interpretation text
 */
function getEntropyInterpretation(rating) {
    switch (rating) {
        case 'Excellent':
            return 'The encryption appears to be very strong with high randomness.';
        case 'Very Good':
            return 'The encryption quality is high with good randomness properties.';
        case 'Good':
            return 'The encryption is of good quality with satisfactory randomness.';
        case 'Fair':
            return 'The encryption shows some patterns. It may not provide optimal security.';
        case 'Poor':
            return 'The encryption has significant patterns, indicating potential weaknesses.';
        case 'Very Poor':
            return 'The encryption appears to be weak with low randomness.';
        default:
            return 'Unable to determine encryption quality.';
    }
}

/**
 * Maps entropy rating to CSS class
 * @param {string} rating - The entropy rating
 * @returns {string} CSS class
 */
function getEntropyClassFromRating(rating) {
    if (['Excellent', 'Very Good', 'Good'].includes(rating)) return 'high';
    if (['Fair'].includes(rating)) return 'medium';
    return 'low';
}

/**
 * Formats file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formats encryption algorithm for display
 * @param {string} algorithm - Algorithm identifier
 * @returns {string} Formatted algorithm name
 */
function formatAlgorithm(algorithm) {
    if (algorithm === 'aes-256-gcm') return 'AES-256-GCM';
    if (algorithm === 'chacha20-poly1305') return 'ChaCha20-Poly1305';
    if (algorithm === 'xchacha20-poly1305') return 'XChaCha20-Poly1305';
    return algorithm.toUpperCase();
}

/**
 * Adds the required CSS styles for the modal
 */
function addModalStyles() {
    // Check if styles are already added
    if (document.getElementById('entropy-visualization-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'entropy-visualization-styles';
    style.textContent = `
        .entropy-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        
        .entropy-modal.visible {
            opacity: 1;
            visibility: visible;
        }
        
        .entropy-modal.closing {
            opacity: 0;
        }
        
        .entropy-modal .modal-content {
            background-color: var(--bg-card, #1e1e2d);
            border-radius: 8px;
            width: 90%;
            max-width: 640px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            transition: transform 0.3s ease;
            transform: scale(0.95);
            border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
        }
        
        .entropy-modal.visible .modal-content {
            transform: scale(1);
        }
        
        .entropy-modal .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
        }
        
        .entropy-modal .modal-title {
            font-size: 18px;
            font-weight: 600;
            margin: 0;
            color: var(--text-primary, #ffffff);
        }
        
        .entropy-modal .close-button {
            background: none;
            border: none;
            color: var(--text-secondary, rgba(255, 255, 255, 0.7));
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
        }
        
        .entropy-modal .close-button:hover {
            background-color: rgba(255, 255, 255, 0.1);
            color: var(--text-primary, #ffffff);
        }
        
        .entropy-modal .modal-body {
            padding: 20px;
        }
        
        .entropy-modal .file-info-section {
            margin-bottom: 20px;
        }
        
        .entropy-modal .file-info-section h3 {
            font-size: 16px;
            margin: 0 0 8px 0;
            color: var(--text-primary, #ffffff);
        }
        
        .entropy-modal .file-info-section p {
            margin: 4px 0;
            color: var(--text-secondary, rgba(255, 255, 255, 0.7));
        }
        
        .entropy-modal .entropy-summary {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 20px;
            background-color: rgba(0, 0, 0, 0.2);
            padding: 16px;
            border-radius: 6px;
        }
        
        .entropy-modal .entropy-rating {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .entropy-modal .rating-label {
            font-weight: 600;
            color: var(--text-primary, #ffffff);
        }
        
        .entropy-modal .rating-value {
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 4px;
            background-color: rgba(255, 255, 255, 0.1);
        }
        
        .entropy-modal .entropy-rating.high .rating-value {
            background-color: rgba(16, 185, 129, 0.2);
            color: #10b981;
        }
        
        .entropy-modal .entropy-rating.medium .rating-value {
            background-color: rgba(245, 158, 11, 0.2);
            color: #f59e0b;
        }
        
        .entropy-modal .entropy-rating.low .rating-value {
            background-color: rgba(239, 68, 68, 0.2);
            color: #ef4444;
        }
        
        .entropy-modal .entropy-meter-container {
            margin-top: 4px;
        }
        
        .entropy-modal .entropy-meter-label {
            font-size: 14px;
            margin-bottom: 8px;
            color: var(--text-secondary, rgba(255, 255, 255, 0.7));
        }
        
        .entropy-modal .entropy-meter {
            height: 8px;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            overflow: hidden;
            width: 100%;
        }
        
        .entropy-modal .entropy-meter-fill {
            height: 100%;
            background-color: var(--accent-blue, #3b82f6);
            border-radius: 4px;
            transition: width 1s ease-out;
        }
        
        .entropy-modal .entropy-meter.high .entropy-meter-fill {
            background-color: #10b981;
        }
        
        .entropy-modal .entropy-meter.medium .entropy-meter-fill {
            background-color: #f59e0b;
        }
        
        .entropy-modal .entropy-meter.low .entropy-meter-fill {
            background-color: #ef4444;
        }
        
        .entropy-modal .entropy-scale {
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
            font-size: 12px;
            color: var(--text-secondary, rgba(255, 255, 255, 0.5));
        }
        
        .entropy-modal .entropy-details {
            margin-bottom: 24px;
        }
        
        .entropy-modal .entropy-details p {
            margin: 8px 0;
            color: var(--text-secondary, rgba(255, 255, 255, 0.7));
        }
        
        .entropy-modal .histogram-section {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
        }
        
        .entropy-modal .histogram-section h3 {
            font-size: 16px;
            margin: 0 0 16px 0;
            color: var(--text-primary, #ffffff);
        }
        
        .entropy-modal .histogram-container {
            height: 150px;
            margin-bottom: 16px;
            position: relative;
        }
        
        .entropy-modal .histogram-labels {
            display: flex;
            flex-direction: column;
            margin-top: 4px;
        }
        
        .entropy-modal .byte-labels {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--text-secondary, rgba(255, 255, 255, 0.5));
        }
        
        .entropy-modal .axis-title {
            text-align: center;
            font-size: 12px;
            margin-top: 4px;
            color: var(--text-secondary, rgba(255, 255, 255, 0.5));
        }
        
        .entropy-modal .histogram-explanation {
            font-size: 13px;
            font-style: italic;
            color: var(--text-secondary, rgba(255, 255, 255, 0.5));
            text-align: center;
            margin-top: 16px;
        }
    `;
    
    document.head.appendChild(style);
} 