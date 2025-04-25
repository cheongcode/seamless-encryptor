const crypto = require('crypto');

/**
 * Generate a random encryption key
 */
function generateKey() {
    return crypto.randomBytes(32);
}

/**
 * Encrypt data using AES-256-GCM
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
 */
function encryptKey(fileKey, masterKey) {
    return encrypt(fileKey, masterKey);
}

/**
 * Decrypt a file key with the master key
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