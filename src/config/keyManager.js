const crypto = require('crypto');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Key storage path
const KEY_STORAGE_PATH = app ? path.join(app.getPath('userData'), 'keys') : '';

/**
 * Ensure the key storage directory exists
 */
function ensureKeyStorageExists() {
  if (!KEY_STORAGE_PATH) return;
  
  if (!fs.existsSync(KEY_STORAGE_PATH)) {
    fs.mkdirSync(KEY_STORAGE_PATH, { recursive: true });
  }
}

/**
 * Generate a master key
 * @returns {Buffer} 32-byte random key
 */
function generateMasterKey() {
  return crypto.randomBytes(32);
}

// In-memory master key
let masterKey = null;

/**
 * Get the master key, creating it if it doesn't exist
 * @returns {Promise<Buffer>} The master key
 */
async function getMasterKey() {
  if (masterKey) return masterKey;
  
  try {
    ensureKeyStorageExists();
    const keyPath = path.join(KEY_STORAGE_PATH, 'master.key');
    
    if (fs.existsSync(keyPath)) {
      masterKey = await fs.promises.readFile(keyPath);
    } else {
      masterKey = generateMasterKey();
      await fs.promises.writeFile(keyPath, masterKey);
    }
    
    return masterKey;
  } catch (error) {
    console.error('Error getting master key:', error);
    throw error;
  }
}

/**
 * Store an encrypted file key
 * @param {string} fileId - Unique file identifier
 * @param {Object} encryptedKey - Encrypted key data
 */
function storeFileKey(fileId, encryptedKey) {
  try {
    ensureKeyStorageExists();
    const keyPath = path.join(KEY_STORAGE_PATH, `${fileId}.key`);
    fs.writeFileSync(keyPath, JSON.stringify(encryptedKey));
  } catch (error) {
    console.error('Error storing file key:', error);
    throw error;
  }
}

/**
 * Get an encrypted file key
 * @param {string} fileId - Unique file identifier
 * @returns {Object|null} Encrypted key data or null if not found
 */
function getFileKey(fileId) {
  try {
    ensureKeyStorageExists();
    const keyPath = path.join(KEY_STORAGE_PATH, `${fileId}.key`);
    
    if (fs.existsSync(keyPath)) {
      const data = fs.readFileSync(keyPath, 'utf8');
      return JSON.parse(data);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting file key:', error);
    return null;
  }
}

/**
 * Remove a file key
 * @param {string} fileId - Unique file identifier
 * @returns {boolean} True if successful, false otherwise
 */
function removeFileKey(fileId) {
  try {
    ensureKeyStorageExists();
    const keyPath = path.join(KEY_STORAGE_PATH, `${fileId}.key`);
    
    if (fs.existsSync(keyPath)) {
      fs.unlinkSync(keyPath);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error removing file key:', error);
    return false;
  }
}

module.exports = {
  generateMasterKey,
  getMasterKey,
  storeFileKey,
  getFileKey,
  removeFileKey
}; 