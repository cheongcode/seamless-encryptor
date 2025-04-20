const crypto = require('crypto');

/**
 * Generate a random encryption key
 * @returns {Buffer} 32-byte encryption key
 */
function generateKey() {
    return crypto.randomBytes(32);
}

/**
 * Encrypt data using AES-256-GCM
 * @param {Buffer} data - Data to encrypt
 * @param {Buffer} key - 32-byte encryption key
 * @returns {Object} Object containing encryptedData, iv, and authTag
 */
function encrypt(data, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
        encryptedData: encrypted,
        iv,
        tag: authTag
    };
}

/**
 * Decrypt data using AES-256-GCM
 * @param {Object} encryptedObj - Object containing encryptedData, iv, and tag
 * @param {Buffer} key - 32-byte encryption key
 * @returns {Buffer} Decrypted data
 */
function decrypt(encryptedObj, key) {
    const { encryptedData, iv, tag } = encryptedObj;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    return Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
    ]);
}

/**
 * Encrypt a file key with the master key
 * @param {Buffer} fileKey - File encryption key
 * @param {Buffer} masterKey - Master encryption key
 * @returns {Object} Encrypted key data
 */
function encryptKey(fileKey, masterKey) {
    return encrypt(fileKey, masterKey);
}

/**
 * Decrypt a file key with the master key
 * @param {Object} encryptedKey - Encrypted key data
 * @param {Buffer} masterKey - Master encryption key
 * @returns {Buffer} Decrypted file key
 */
function decryptKey(encryptedKey, masterKey) {
    return decrypt(encryptedKey, masterKey);
}

module.exports = {
    generateKey,
    encrypt,
    decrypt,
    encryptKey,
    decryptKey,
    randomBytes: crypto.randomBytes,
    createCipheriv: crypto.createCipheriv,
    createDecipheriv: crypto.createDecipheriv
}; 