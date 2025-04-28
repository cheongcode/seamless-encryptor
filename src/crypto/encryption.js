const crypto = require('crypto');

/**
 * Basic encryption utilities
 */
module.exports = {
  /**
   * Generate a secure encryption key
   * @param {number} keySize - Size of the key in bytes (default: 32 for AES-256)
   * @returns {Buffer} - Random bytes to use as encryption key
   */
  generateKey: (keySize = 32) => {
    return crypto.randomBytes(keySize);
  },

  /**
   * Encrypt data using AES-256-GCM
   * @param {Buffer} data - Data to encrypt
   * @param {Buffer} key - Encryption key (32 bytes)
   * @returns {Object} - Object containing iv, authTag, and encrypted data
   */
  encryptAES_GCM: (data, key) => {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data);
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv,
      authTag,
      encryptedData: encrypted
    };
  },

  /**
   * Decrypt data that was encrypted with AES-256-GCM
   * @param {Object} params - Object containing iv, authTag, and encryptedData
   * @param {Buffer} key - Encryption key (32 bytes)
   * @returns {Buffer} - Decrypted data
   */
  decryptAES_GCM: (params, key) => {
    const { iv, authTag, encryptedData } = params;
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
  },

  /**
   * Encrypt data using AES-256-CBC
   * @param {Buffer} data - Data to encrypt
   * @param {Buffer} key - Encryption key (32 bytes)
   * @returns {Object} - Object containing iv and encrypted data
   */
  encryptAES_CBC: (data, key) => {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data);
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    return {
      iv,
      encryptedData: encrypted
    };
  },

  /**
   * Decrypt data that was encrypted with AES-256-CBC
   * @param {Object} params - Object containing iv and encryptedData
   * @param {Buffer} key - Encryption key (32 bytes)
   * @returns {Buffer} - Decrypted data
   */
  decryptAES_CBC: (params, key) => {
    const { iv, encryptedData } = params;
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    return Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
  },

  /**
   * Generate a secure hash of data
   * @param {Buffer|string} data - Data to hash
   * @param {string} algorithm - Hash algorithm to use (default: 'sha256')
   * @returns {string} - Hex-encoded hash
   */
  hash: (data, algorithm = 'sha256') => {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data);
    }
    return crypto.createHash(algorithm).update(data).digest('hex');
  },
  
  /**
   * Derive a key from a password using PBKDF2
   * @param {string} password - Password to derive key from
   * @param {Buffer} salt - Salt for key derivation (should be at least 16 bytes)
   * @param {number} keySize - Size of the key in bytes (default: 32 for AES-256)
   * @param {number} iterations - Number of iterations (higher is more secure but slower)
   * @returns {Buffer} - Derived key
   */
  deriveKey: (password, salt, keySize = 32, iterations = 100000) => {
    return crypto.pbkdf2Sync(password, salt, iterations, keySize, 'sha256');
  }
}; 