/**
 * Entropy Analyzer Module
 * - Calculates Shannon entropy of data
 * - Provides utilities for evaluating encryption quality
 */

/**
 * Calculate Shannon entropy of a Buffer or Uint8Array
 * Entropy is a measure of randomness (higher is better for encrypted data)
 * @param {Buffer|Uint8Array} data - The data to analyze
 * @returns {number} - Entropy value between 0-8 (8 is perfect randomness)
 */
function calculateEntropy(data) {
  if (!data || data.length === 0) {
    return 0;
  }
  
  // Create a frequency table for each byte value (0-255)
  const frequencies = new Array(256).fill(0);
  const dataLength = data.length;
  
  // Count occurrences of each byte value
  for (let i = 0; i < dataLength; i++) {
    frequencies[data[i]]++;
  }
  
  // Calculate Shannon entropy
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const probability = frequencies[i] / dataLength;
      entropy -= probability * (Math.log(probability) / Math.log(2));
    }
  }
  
  return entropy;
}

/**
 * Analyze entropy of a Buffer in chunks
 * Returns overall entropy and chunk-by-chunk breakdown
 * @param {Buffer} buffer - The data to analyze
 * @param {number} chunkSize - Size of each chunk in bytes
 * @returns {Object} - Analysis results
 */
function analyzeEntropyInChunks(buffer, chunkSize = 4096) {
  if (!buffer || buffer.length === 0) {
    return {
      overallEntropy: 0,
      chunkEntropies: [],
      rating: 'N/A',
      isGoodEncryption: false
    };
  }
  
  const chunkEntropies = [];
  let totalBytes = 0;
  let entropySum = 0;
  
  // Process the buffer in chunks
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, buffer.length);
    const chunk = buffer.slice(i, end);
    const chunkEntropy = calculateEntropy(chunk);
    
    chunkEntropies.push({
      startByte: i,
      endByte: end - 1,
      entropy: chunkEntropy
    });
    
    entropySum += chunkEntropy * chunk.length;
    totalBytes += chunk.length;
  }
  
  // Calculate weighted average entropy
  const overallEntropy = entropySum / totalBytes;
  
  // Rate the encryption quality
  let rating, isGoodEncryption;
  if (overallEntropy > 7.9) {
    rating = 'Excellent';
    isGoodEncryption = true;
  } else if (overallEntropy > 7.5) {
    rating = 'Very Good';
    isGoodEncryption = true;
  } else if (overallEntropy > 7.0) {
    rating = 'Good';
    isGoodEncryption = true;
  } else if (overallEntropy > 6.5) {
    rating = 'Fair';
    isGoodEncryption = false;
  } else if (overallEntropy > 5.5) {
    rating = 'Poor';
    isGoodEncryption = false;
  } else {
    rating = 'Very Poor';
    isGoodEncryption = false;
  }
  
  return {
    overallEntropy,
    chunkEntropies,
    rating,
    isGoodEncryption
  };
}

/**
 * Generate histogram data for entropy visualization
 * @param {Buffer} data - The data to analyze
 * @param {number} maxSampleSize - Maximum number of bytes to sample for performance
 * @returns {Array<number>} - Frequency counts for each byte value (0-255)
 */
function generateHistogram(data, maxSampleSize = 100000) {
  if (!data || data.length === 0) {
    return new Array(256).fill(0);
  }
  
  const histogram = new Array(256).fill(0);
  
  // Determine if we need to sample
  const useFullData = data.length <= maxSampleSize;
  const sampleInterval = useFullData ? 1 : Math.max(1, Math.floor(data.length / maxSampleSize));
  
  // Count byte frequencies
  if (useFullData) {
    // Use all data
    for (let i = 0; i < data.length; i++) {
      histogram[data[i]]++;
    }
  } else {
    // Sample data
    for (let i = 0; i < data.length; i += sampleInterval) {
      histogram[data[i]]++;
    }
  }
  
  return histogram;
}

/**
 * Analyze a specific file for entropy
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzeFileEntropy(filePath) {
  try {
    const fs = require('fs').promises;
    const buffer = await fs.readFile(filePath);
    const analysis = analyzeEntropyInChunks(buffer);
    const histogram = generateHistogram(buffer);
    
    return {
      success: true,
      filePath,
      fileSize: buffer.length,
      ...analysis,
      histogram
    };
  } catch (error) {
    console.error('Error analyzing file:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  calculateEntropy,
  analyzeEntropyInChunks,
  generateHistogram,
  analyzeFileEntropy
};
