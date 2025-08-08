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

// Get KeyFolder path
const getKeyFolderPath = () => {
  return path.join(app.getPath('userData'), 'KeyFolder');
};

// Ensure KeyFolder exists
const ensureKeyFolderExists = () => {
  const folderPath = getKeyFolderPath();
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log('KeyFolder created at:', folderPath);
  }
  return folderPath;
};

// Generate unique filename for key
const generateKeyFileName = (prefix = 'key') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uuid = crypto.randomUUID().substring(0, 8);
  return `${prefix}_${timestamp}_${uuid}.txt`;
};

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
    // Ensure KeyFolder exists
    ensureKeyFolderExists();
    
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
   * Ensure KeyFolder exists (can be called manually)
   * @returns {string} The KeyFolder path
   */
  ensureKeyFolderExists,

  /**
   * Get KeyFolder path
   * @returns {string} The KeyFolder path
   */
  getKeyFolderPath,

  /**
   * Generate a new encryption key and auto-save to KeyFolder
   * @param {string} keyName Optional name for the key (defaults to 'generated')
   * @returns {Promise<{key: Buffer, filePath: string, fileName: string}>} The generated key and file info
   */
  generateKey: async (keyName = 'generated') => {
    const key = crypto.randomBytes(32);
    const filePath = await module.exports.saveKeyToFile(key, keyName);
    const fileName = path.basename(filePath);
    return { key, filePath, fileName };
  },

  /**
   * Save a key to a file in KeyFolder
   * @param {Buffer} key The key to save
   * @param {string} prefix Optional prefix for the filename
   * @returns {Promise<string>} The file path where the key was saved
   */
  saveKeyToFile: async (key, prefix = 'key') => {
    ensureKeyFolderExists();
    const fileName = generateKeyFileName(prefix);
    const filePath = path.join(getKeyFolderPath(), fileName);
    
    // Create metadata object
    const keyData = {
      key: key.toString('hex'),
      algorithm: 'generated',
      created: new Date().toISOString(),
      keySize: key.length * 8,
      prefix: prefix
    };
    
    // Save to file
    await fs.promises.writeFile(filePath, JSON.stringify(keyData, null, 2));
    console.log('Key saved to:', filePath);
    return filePath;
  },

  /**
   * Import a key and auto-save to KeyFolder
   * @param {Buffer|string} keyData The key data to import
   * @param {string} sourceName Source name for the key
   * @returns {Promise<{filePath: string, fileName: string}>} File info for the imported key
   */
  importKeyToFile: async (keyData, sourceName = 'imported') => {
    let key;
    if (Buffer.isBuffer(keyData)) {
      key = keyData;
    } else if (typeof keyData === 'string') {
      // Try to parse as hex
      try {
        key = Buffer.from(keyData, 'hex');
      } catch (error) {
        // If not hex, treat as base64
        key = Buffer.from(keyData, 'base64');
      }
    } else {
      throw new Error('Invalid key data format');
    }

    const filePath = await module.exports.saveKeyToFile(key, `imported_${sourceName}`);
    const fileName = path.basename(filePath);
    return { filePath, fileName };
  },

  /**
   * List all key files in KeyFolder
   * @returns {Promise<Array>} Array of key file information
   */
  listKeyFiles: async () => {
    ensureKeyFolderExists();
    const keyFolderPath = getKeyFolderPath();
    
    try {
      const files = await fs.promises.readdir(keyFolderPath);
      const keyFiles = files.filter(file => file.endsWith('.txt'));
      
      const keyFileInfo = await Promise.all(keyFiles.map(async (fileName) => {
        const filePath = path.join(keyFolderPath, fileName);
        const stats = await fs.promises.stat(filePath);
        
        let metadata = {};
        try {
          const content = await fs.promises.readFile(filePath, 'utf8');
          metadata = JSON.parse(content);
        } catch (error) {
          // If can't parse as JSON, treat as raw key
          metadata = { 
            key: content.trim(),
            algorithm: 'unknown',
            created: stats.birthtime.toISOString()
          };
        }
        
        return {
          fileName,
          filePath,
          created: stats.birthtime,
          modified: stats.mtime,
          size: stats.size,
          ...metadata
        };
      }));
      
      // Sort by creation date (newest first)
      return keyFileInfo.sort((a, b) => new Date(b.created) - new Date(a.created));
    } catch (error) {
      console.error('Error listing key files:', error);
      return [];
    }
  },

  /**
   * Read a key file
   * @param {string} fileName The key file name
   * @returns {Promise<Object>} The key file content and metadata
   */
  readKeyFile: async (fileName) => {
    const filePath = path.join(getKeyFolderPath(), fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Key file not found: ${fileName}`);
    }
    
    const content = await fs.promises.readFile(filePath, 'utf8');
    const stats = await fs.promises.stat(filePath);
    
    let keyData;
    try {
      keyData = JSON.parse(content);
    } catch (error) {
      // If can't parse as JSON, treat as raw key
      keyData = {
        key: content.trim(),
        algorithm: 'unknown',
        created: stats.birthtime.toISOString()
      };
    }
    
    return {
      fileName,
      filePath,
      created: stats.birthtime,
      modified: stats.mtime,
      size: stats.size,
      ...keyData
    };
  },

  /**
   * Delete a key file
   * @param {string} fileName The key file name to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  deleteKeyFile: async (fileName) => {
    const filePath = path.join(getKeyFolderPath(), fileName);
    
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    try {
      await fs.promises.unlink(filePath);
      console.log('Key file deleted:', filePath);
      return true;
    } catch (error) {
      console.error('Error deleting key file:', error);
      return false;
    }
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
  },

  /**
   * Export a single key to a file
   * @param {string} keyId - The ID of the key to export (or 'master' for master key)
   * @param {string} exportPath - Path where to save the key
   * @param {string} password - Optional password to protect the export
   * @returns {Promise<boolean>} True if successful
   */
  exportKey: async (keyId, exportPath, password = null) => {
    try {
      let keyData;
      
      // Get the key data
      if (keyId === 'master') {
        keyData = await module.exports.getMasterKey();
      } else {
        const fileKeys = store.get('fileKeys') || {};
        keyData = fileKeys[keyId];
      }
      
      if (!keyData) {
        throw new Error(`Key with ID ${keyId} not found`);
      }
      
      const exportData = {
        keyId,
        timestamp: new Date().toISOString(),
        keyData: keyData.toString('hex')
      };
      
      // If password provided, encrypt the export
      if (password) {
        const salt = crypto.randomBytes(16);
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        
        let encrypted = cipher.update(JSON.stringify(exportData), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const finalExport = {
          encrypted: true,
          salt: salt.toString('hex'),
          iv: iv.toString('hex'),
          data: encrypted
        };
        
        fs.writeFileSync(exportPath, JSON.stringify(finalExport, null, 2));
      } else {
        fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      }
      
      console.log(`[KEY] Exported key ${keyId} to ${exportPath}`);
      return true;
      
    } catch (error) {
      console.error(`[KEY] Error exporting key ${keyId}:`, error);
      return false;
    }
  },

  /**
   * Import a single key from a file
   * @param {string} importPath - Path to the key file
   * @param {string} password - Optional password if the key is encrypted
   * @returns {Promise<{success: boolean, keyId?: string, error?: string}>}
   */
  importKey: async (importPath, password = null) => {
    try {
      if (!fs.existsSync(importPath)) {
        return { success: false, error: 'Import file does not exist' };
      }
      
      const importContent = fs.readFileSync(importPath, 'utf8');
      let importData = JSON.parse(importContent);
      
      // If encrypted, decrypt first
      if (importData.encrypted) {
        if (!password) {
          return { success: false, error: 'Password required for encrypted key file' };
        }
        
        const salt = Buffer.from(importData.salt, 'hex');
        const iv = Buffer.from(importData.iv, 'hex');
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(importData.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        importData = JSON.parse(decrypted);
      }
      
      const keyData = Buffer.from(importData.keyData, 'hex');
      const keyId = importData.keyId || `imported_${Date.now()}`;
      
      // Store the key
      if (keyId === 'master') {
        await module.exports.storeMasterKey(keyData);
      } else {
        const fileKeys = store.get('fileKeys') || {};
        fileKeys[keyId] = keyData;
        store.set('fileKeys', fileKeys);
      }
      
      console.log(`[KEY] Imported key ${keyId} from ${importPath}`);
      return { success: true, keyId };
      
    } catch (error) {
      console.error(`[KEY] Error importing key:`, error);
      return { success: false, error: error.message };
    }
  }
}; 