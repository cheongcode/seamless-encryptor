const crypto = require('crypto');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Return key storage directory
function getKeyStoragePath() {
  if (!app) return '';
  return path.join(app.getPath('userData'), 'keys');
}

// Ensure key storage directory exists
function ensureKeyStorageExists() {
  const storagePath = getKeyStoragePath();
  if (!storagePath) return;
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }
}

// Generate 32-byte master key
function generateMasterKey() {
  return crypto.randomBytes(32);
}

// Keep master key in memory for quick access
let masterKey = null;

// Load existing master key or create one
async function getMasterKey() {
  if (masterKey) return masterKey;
  
  try {
    ensureKeyStorageExists();
    const keyPath = path.join(getKeyStoragePath(), 'master.key');
    
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

// Persist provided master key and cache it
async function setMasterKey(keyBuffer) {
  try {
    if (!Buffer.isBuffer(keyBuffer) || keyBuffer.length !== 32) {
      throw new Error('Master key must be a 32-byte Buffer');
    }
    ensureKeyStorageExists();
    const keyPath = path.join(getKeyStoragePath(), 'master.key');
    await fs.promises.writeFile(keyPath, keyBuffer);
    masterKey = keyBuffer;
    return true;
  } catch (error) {
    console.error('Error setting master key:', error);
    throw error;
  }
}

module.exports = {
  generateMasterKey,
  getMasterKey,
  setMasterKey
}; 