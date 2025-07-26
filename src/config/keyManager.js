const crypto = require('crypto');
const keytar = require('keytar');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const ElectronStore = require('electron-store');

const APP_NAME = 'seamless-encryptor';
const KEY_SERVICE = 'seamless-encryptor-keys';
const MASTER_KEY_ACCOUNT = 'master';

// Store for non-sensitive settings
const store = new ElectronStore({
  name: 'key-settings',
  encryptionKey: 'seamless-encryptor-config' // Simple encryption for settings
});

/**
 * Key Management Module
 * Handles secure storage and retrieval of encryption keys
 */
module.exports = {
  /**
   * Initialize the key manager
   * @returns {Promise<void>}
   */
  init: async () => {
    // Check if we have a master key
    const hasMasterKey = await keytar.getPassword(KEY_SERVICE, MASTER_KEY_ACCOUNT);
    
    if (!hasMasterKey) {
      // Generate a new master key
      const masterKey = crypto.randomBytes(32);
      await keytar.setPassword(KEY_SERVICE, MASTER_KEY_ACCOUNT, masterKey.toString('hex'));
      
      // Store salt for derived keys
      const salt = crypto.randomBytes(16);
      store.set('masterSalt', salt.toString('hex'));
    }
  },
  
  /**
   * Generate a new encryption key
   * @returns {Promise<Buffer>} The generated key
   */
  generateKey: async () => {
    return crypto.randomBytes(32);
  },
  
  /**
   * Get the master encryption key
   * @returns {Promise<Buffer>} The master key
   */
  getMasterKey: async () => {
    const masterKeyHex = await keytar.getPassword(KEY_SERVICE, MASTER_KEY_ACCOUNT);
    if (!masterKeyHex) {
      throw new Error('Master key not found. Application may need to be initialized.');
    }
    return Buffer.from(masterKeyHex, 'hex');
  },
  
  /**
   * Derive a key from a password
   * @param {string} password The password to derive a key from
   * @returns {Promise<Buffer>} The derived key
   */
  deriveKeyFromPassword: async (password) => {
    // Get the salt
    const saltHex = store.get('masterSalt');
    if (!saltHex) {
      throw new Error('Salt not found. Application may need to be initialized.');
    }
    
    const salt = Buffer.from(saltHex, 'hex');
    
    // Derive key using PBKDF2
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  },
  
  /**
   * Save a key for a specific file
   * @param {string} fileId The file ID to associate with the key
   * @param {Buffer} key The encryption key to save
   * @returns {Promise<void>}
   */
  saveKeyForFile: async (fileId, key) => {
    const masterKey = await module.exports.getMasterKey();
    
    // Encrypt the file key with the master key
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(key),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Save the encrypted key
    const keyData = {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encryptedKey: encrypted.toString('hex')
    };
    
    store.set(`fileKeys.${fileId}`, keyData);
  },
  
  /**
   * Get a key for a specific file
   * @param {string} fileId The file ID to get the key for
   * @returns {Promise<Buffer>} The decrypted key
   */
  getKeyForFile: async (fileId) => {
    const masterKey = await module.exports.getMasterKey();
    
    // Get the encrypted key data
    const keyData = store.get(`fileKeys.${fileId}`);
    if (!keyData) {
      throw new Error(`No key found for file ID: ${fileId}`);
    }
    
    // Decrypt the file key
    const iv = Buffer.from(keyData.iv, 'hex');
    const authTag = Buffer.from(keyData.authTag, 'hex');
    const encryptedKey = Buffer.from(keyData.encryptedKey, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encryptedKey),
      decipher.final()
    ]);
  },
  
  /**
   * Delete a key for a specific file
   * @param {string} fileId The file ID to delete the key for
   * @returns {Promise<boolean>} True if the key was deleted, false if it didn't exist
   */
  deleteKeyForFile: async (fileId) => {
    if (store.has(`fileKeys.${fileId}`)) {
      store.delete(`fileKeys.${fileId}`);
      return true;
    }
    return false;
  },
  
  /**
   * Change the master password
   * @param {string} oldPassword The current password
   * @param {string} newPassword The new password
   * @returns {Promise<boolean>} True if successful
   */
  changeMasterPassword: async (oldPassword, newPassword) => {
    // Verify old password
    const oldKey = await module.exports.deriveKeyFromPassword(oldPassword);
    const masterKey = await module.exports.getMasterKey();
    
    // Compare keys
    if (!crypto.timingSafeEqual(oldKey, masterKey)) {
      return false;
    }
    
    // Generate new master key from new password
    const newKey = await module.exports.deriveKeyFromPassword(newPassword);
    
    // Update the master key
    await keytar.setPassword(KEY_SERVICE, MASTER_KEY_ACCOUNT, newKey.toString('hex'));
    
    return true;
  },

  /**
   * Create password-protected DEK backup for cloud storage
   * @param {string} password User-supplied password (never stored)
   * @param {Buffer} dek The DEK to encrypt and backup
   * @returns {Promise<Buffer>} Encrypted DEK data for cloud upload
   */
  createPasswordProtectedDEKBackup: async (password, dek) => {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (!Buffer.isBuffer(dek) || dek.length !== 32) {
      throw new Error('DEK must be a 32-byte buffer');
    }
    
    // Generate salt for key derivation
    const salt = crypto.randomBytes(32);
    
    // Derive key using Argon2id-like approach with PBKDF2 (100,000 iterations for security)
    const derivedKey = await new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
    
    // Encrypt DEK using AES-256-GCM
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(dek),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Create header with metadata
    const header = {
      version: 1,
      algorithm: 'aes-256-gcm',
      kdf: 'pbkdf2',
      iterations: 100000,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      timestamp: new Date().toISOString()
    };
    
    // Combine header and encrypted data
    const headerJson = JSON.stringify(header);
    const headerLength = Buffer.alloc(4);
    headerLength.writeUInt32BE(headerJson.length, 0);
    
    return Buffer.concat([
      headerLength,
      Buffer.from(headerJson, 'utf8'),
      encrypted
    ]);
  },

  /**
   * Decrypt password-protected DEK backup from cloud storage
   * @param {string} password User-supplied password
   * @param {Buffer} encryptedData Encrypted DEK data from cloud
   * @returns {Promise<Buffer>} The decrypted DEK
   */
  decryptPasswordProtectedDEKBackup: async (password, encryptedData) => {
    if (!password) {
      throw new Error('Password is required for DEK decryption');
    }
    
    if (!Buffer.isBuffer(encryptedData) || encryptedData.length < 4) {
      throw new Error('Invalid encrypted data format');
    }
    
    // Read header length
    const headerLength = encryptedData.readUInt32BE(0);
    if (headerLength > encryptedData.length - 4) {
      throw new Error('Invalid header length');
    }
    
    // Parse header
    const headerJson = encryptedData.slice(4, 4 + headerLength).toString('utf8');
    const header = JSON.parse(headerJson);
    
    // Validate header
    if (header.version !== 1 || header.algorithm !== 'aes-256-gcm' || header.kdf !== 'pbkdf2') {
      throw new Error('Unsupported backup format');
    }
    
    // Extract encrypted DEK
    const encrypted = encryptedData.slice(4 + headerLength);
    
    // Derive key using same parameters
    const salt = Buffer.from(header.salt, 'hex');
    const derivedKey = await new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, header.iterations, 32, 'sha256', (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
    
    // Decrypt DEK
    const iv = Buffer.from(header.iv, 'hex');
    const authTag = Buffer.from(header.authTag, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  },

  /**
   * Get current DEK for backup
   * @returns {Promise<Buffer>} Current DEK
   */
  getCurrentDEK: async () => {
    return await module.exports.getMasterKey();
  },
  
  /**
   * Export all keys to a file (should be used with caution!)
   * @param {string} exportPath The path to export keys to
   * @param {string} password A password to protect the export
   * @returns {Promise<void>}
   */
  exportKeys: async (exportPath, password) => {
    // Get all keys
    const masterKey = await module.exports.getMasterKey();
    const fileKeys = store.get('fileKeys') || {};
    
    // Create export object
    const exportData = {
      masterKey: masterKey.toString('hex'),
      fileKeys
    };
    
    // Encrypt the export
    const salt = crypto.randomBytes(16);
    const key = await module.exports.deriveKeyFromPassword(password);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(exportData)),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Create the output
    const output = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted.toString('hex')
    };
    
    // Write to file
    fs.writeFileSync(exportPath, JSON.stringify(output));
  },
  
  /**
   * Import keys from a file
   * @param {string} importPath The path to import keys from
   * @param {string} password The password protecting the import
   * @returns {Promise<boolean>} True if successful
   */
  importKeys: async (importPath, password) => {
    try {
      // Read the file
      const importData = JSON.parse(fs.readFileSync(importPath, 'utf8'));
      
      // Derive key from password using the stored salt
      const salt = Buffer.from(importData.salt, 'hex');
      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
      
      // Decrypt the data
      const iv = Buffer.from(importData.iv, 'hex');
      const authTag = Buffer.from(importData.authTag, 'hex');
      const encryptedData = Buffer.from(importData.data, 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]).toString();
      
      // Parse the decrypted data
      const parsedData = JSON.parse(decrypted);
      
      // Import the master key
      await keytar.setPassword(KEY_SERVICE, MASTER_KEY_ACCOUNT, parsedData.masterKey);
      
      // Import file keys
      store.set('fileKeys', parsedData.fileKeys);
      
      return true;
    } catch (error) {
      console.error('Error importing keys:', error);
      return false;
    }
  }
}; 