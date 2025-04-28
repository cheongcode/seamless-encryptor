/**
 * Crypto Utility Module
 * Provides additional encryption methods beyond Node.js built-in crypto
 */

const crypto = require('crypto');

// Try to load sodium-native with a fallback mechanism
let sodium;
try {
  sodium = require('sodium-native');
  console.log('Successfully loaded sodium-native');
} catch (error) {
  console.warn('sodium-native could not be loaded:', error.message);
  console.warn('Will use Node.js crypto fallbacks for encryption');
  sodium = null;
}

/**
 * Encrypt data using ChaCha20-Poly1305
 * @param {Buffer} data - The data to encrypt
 * @param {Buffer} key - 32-byte encryption key
 * @param {Buffer} nonce - 12-byte nonce/IV
 * @returns {Object} - Object containing ciphertext and authentication tag
 */
function encryptChaCha20Poly1305(data, key, nonce) {
  try {
    // If sodium-native is available, use it
    if (sodium) {
      return encryptWithSodium(data, key, nonce);
    }
    
    // Fallback to Node.js crypto (if available and supported)
    return encryptWithNodeCrypto(data, key, nonce);
  } catch (error) {
    console.error('Error in ChaCha20-Poly1305 encryption:', error);
    // Ultimate fallback - use AES-GCM
    console.warn('Falling back to AES-GCM encryption');
    return encryptWithAesGcm(data, key, nonce);
  }
}

/**
 * Decrypt data using ChaCha20-Poly1305
 * @param {Buffer} ciphertext - The encrypted data
 * @param {Buffer} key - 32-byte encryption key
 * @param {Buffer} nonce - 12-byte nonce/IV
 * @param {Buffer} tag - Authentication tag
 * @returns {Buffer} - Decrypted data
 */
function decryptChaCha20Poly1305(ciphertext, key, nonce, tag) {
  try {
    // If sodium-native is available, use it
    if (sodium) {
      return decryptWithSodium(ciphertext, key, nonce, tag);
    }
    
    // Fallback to Node.js crypto (if available and supported)
    return decryptWithNodeCrypto(ciphertext, key, nonce, tag);
  } catch (error) {
    console.error('Error in ChaCha20-Poly1305 decryption:', error);
    // Ultimate fallback - use AES-GCM
    console.warn('Falling back to AES-GCM decryption');
    return decryptWithAesGcm(ciphertext, key, nonce, tag);
  }
}

/**
 * Encrypt with sodium-native (more efficient)
 */
function encryptWithSodium(data, key, nonce) {
  if (!sodium) {
    throw new Error('sodium-native is not available');
  }

  // Ensure buffers are correct size
  if (key.length !== sodium.crypto_aead_chacha20poly1305_KEYBYTES) {
    throw new Error(`Invalid key length: ${key.length}. Expected ${sodium.crypto_aead_chacha20poly1305_KEYBYTES} bytes`);
  }
  
  if (nonce.length !== sodium.crypto_aead_chacha20poly1305_NPUBBYTES) {
    // If nonce is not the expected size, resize it
    const newNonce = Buffer.alloc(sodium.crypto_aead_chacha20poly1305_NPUBBYTES);
    nonce.copy(newNonce, 0, 0, Math.min(nonce.length, sodium.crypto_aead_chacha20poly1305_NPUBBYTES));
    nonce = newNonce;
  }
  
  // Create ciphertext buffer (will be data.length + tag size)
  const ciphertext = Buffer.alloc(data.length + sodium.crypto_aead_chacha20poly1305_ABYTES);
  const ciphertextLen = Buffer.alloc(8);
  
  // Encrypt the data
  sodium.crypto_aead_chacha20poly1305_encrypt(
    ciphertext,
    ciphertextLen,
    data,
    null,  // No additional data
    null,  // No additional data
    nonce,
    key
  );
  
  // Extract the tag from the end of the ciphertext
  const actualCiphertextLen = ciphertextLen.readUInt64LE(0);
  const actualCiphertext = ciphertext.slice(0, data.length);
  const tag = ciphertext.slice(data.length, actualCiphertextLen);
  
  return {
    ciphertext: actualCiphertext,
    tag: tag,
  };
}

/**
 * Decrypt with sodium-native
 */
function decryptWithSodium(ciphertext, key, nonce, tag) {
  if (!sodium) {
    throw new Error('sodium-native is not available');
  }

  // Ensure buffers are correct size
  if (key.length !== sodium.crypto_aead_chacha20poly1305_KEYBYTES) {
    throw new Error(`Invalid key length: ${key.length}. Expected ${sodium.crypto_aead_chacha20poly1305_KEYBYTES} bytes`);
  }
  
  if (nonce.length !== sodium.crypto_aead_chacha20poly1305_NPUBBYTES) {
    // Resize nonce if needed
    const newNonce = Buffer.alloc(sodium.crypto_aead_chacha20poly1305_NPUBBYTES);
    nonce.copy(newNonce, 0, 0, Math.min(nonce.length, sodium.crypto_aead_chacha20poly1305_NPUBBYTES));
    nonce = newNonce;
  }
  
  // Combine ciphertext and tag for decryption
  const combinedCiphertext = Buffer.concat([ciphertext, tag]);
  
  // Create output buffer for the decrypted data
  const message = Buffer.alloc(ciphertext.length);
  const messageLen = Buffer.alloc(8);
  
  // Decrypt
  const success = sodium.crypto_aead_chacha20poly1305_decrypt(
    message,
    messageLen,
    null, // No additional data output
    combinedCiphertext,
    null, // No additional data input
    null, // No additional data length
    nonce,
    key
  );
  
  if (!success) {
    throw new Error('Decryption failed: Authentication failed');
  }
  
  const actualMessageLen = messageLen.readUInt64LE(0);
  return message.slice(0, actualMessageLen);
}

/**
 * Encrypt with Node.js crypto module (fallback)
 */
function encryptWithNodeCrypto(data, key, nonce) {
  try {
    const algorithm = 'chacha20-poly1305';
    
    // Create cipher with aead algorithm
    const cipher = crypto.createCipheriv(algorithm, key, nonce, {
      authTagLength: 16
    });
    
    // Encrypt the data
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    return {
      ciphertext,
      tag
    };
  } catch (error) {
    // If ChaCha20-Poly1305 is not supported, fall back to AES-GCM
    if (error.message.includes('not supported')) {
      console.warn('ChaCha20-Poly1305 not supported by Node.js crypto, falling back to AES-GCM');
      return encryptWithAesGcm(data, key, nonce);
    }
    throw error;
  }
}

/**
 * Decrypt with Node.js crypto module (fallback)
 */
function decryptWithNodeCrypto(ciphertext, key, nonce, tag) {
  try {
    const algorithm = 'chacha20-poly1305';
    
    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, key, nonce, {
      authTagLength: 16
    });
    
    // Set auth tag and decrypt
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (error) {
    // If ChaCha20-Poly1305 is not supported, fall back to AES-GCM
    if (error.message.includes('not supported')) {
      console.warn('ChaCha20-Poly1305 not supported by Node.js crypto, falling back to AES-GCM');
      return decryptWithAesGcm(ciphertext, key, nonce, tag);
    }
    throw error;
  }
}

/**
 * Fallback encryption with AES-GCM
 */
function encryptWithAesGcm(data, key, nonce) {
  // Use first 12 bytes of nonce for AES-GCM
  const aesgcmNonce = nonce.length > 12 ? nonce.slice(0, 12) : nonce;
  
  // Adjust key size for AES-256-GCM (32 bytes)
  let aesKey = key;
  if (key.length !== 32) {
    // Create a new key of correct length
    aesKey = crypto.createHash('sha256').update(key).digest();
  }
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, aesgcmNonce);
  
  // Encrypt
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return {
    ciphertext,
    tag
  };
}

/**
 * Fallback decryption with AES-GCM
 */
function decryptWithAesGcm(ciphertext, key, nonce, tag) {
  // Use first 12 bytes of nonce for AES-GCM
  const aesgcmNonce = nonce.length > 12 ? nonce.slice(0, 12) : nonce;
  
  // Adjust key size for AES-256-GCM (32 bytes)
  let aesKey = key;
  if (key.length !== 32) {
    // Create a new key of correct length
    aesKey = crypto.createHash('sha256').update(key).digest();
  }
  
  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, aesgcmNonce);
  
  // Set auth tag and decrypt
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// Export functions
module.exports = {
  encryptChaCha20Poly1305,
  decryptChaCha20Poly1305
};
