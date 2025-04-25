const crypto = require('crypto');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Key storage path
const KEY_STORAGE_PATH = app ? path.join(app.getPath('userData'), 'keys') : '';

/**
 * Make sure we have a place to store keys
 */
function ensureKeyStorageExists() {
  if (!KEY_STORAGE_PATH) return;
  
  if (!fs.existsSync(KEY_STORAGE_PATH)) {
    fs.mkdirSync(KEY_STORAGE_PATH, { recursive: true });
  }
}

/**
 * Create a new master encryption key
 */
function generateMasterKey() {
  return crypto.randomBytes(32);
}

// Keep master key in memory for quick access
let masterKey = null;

/**
 * Get or create master key
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
 * Save an encrypted file key
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
 * Retrieve an encrypted file key
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
 * Delete a file key
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