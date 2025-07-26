const crypto = require('crypto');

// Safely load dependencies
let sodium;
let miscreant;

try {
  sodium = require('libsodium-wrappers');
  console.log('Successfully loaded libsodium-wrappers');
} catch (error) {
  console.warn('Failed to load libsodium-wrappers:', error.message);
  console.warn('ChaCha20-Poly1305 encryption will not be available');
  sodium = null;
}

try {
  miscreant = require('miscreant');
  console.log('Successfully loaded miscreant');
} catch (error) {
  console.warn('Failed to load miscreant:', error.message);
  miscreant = null;
}

let currentEncryptionMethod = 'aes-256-gcm'; // Default method

/**
 * Collection of encryption algorithms with standardized interfaces
 */
module.exports = {
  /**
   * Encrypt data using the specified algorithm
   * @param {Buffer} data - The data to encrypt
   * @param {Buffer} key - The encryption key (32 bytes)
   * @param {string} algorithm - Optional algorithm to use, if not specified the default (AES-256-GCM) is used
   * @returns {Object} - Object containing the encrypted data and algorithm used
   */
  encrypt: async (data, key, algorithm = 'aes-256-gcm') => {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data);
    }
    
    let result;
    
    // Select the encryption algorithm
    switch (algorithm) {
      case 'aes-256-gcm':
        result = encryptAesGcm(data, key);
        break;
      case 'aes-256-cbc':
        result = encryptAesCbc(data, key);
        break;
      case 'chacha20-poly1305':
        if (!sodium) {
          console.warn('ChaCha20-Poly1305 not available, falling back to AES-256-GCM');
          result = encryptAesGcm(data, key);
        } else {
          result = await encryptChacha20(data, key);
        }
        break;
      default:
        console.warn(`Unsupported encryption algorithm: ${algorithm}, falling back to AES-256-GCM`);
        result = encryptAesGcm(data, key);
    }
    
    // Standardize the result
    const { encryptedData, ...metadata } = result;
    
    // Prefix with algorithm and format version
    const prefix = Buffer.from([
      0x01, // Format version
      getAlgorithmCode(algorithm)
    ]);
    
    // Serialize metadata
    const metadataBuffer = serializeMetadata(metadata);
    
    // Combine all parts
    return {
      algorithm,
      encryptedData: Buffer.concat([
        prefix,
        metadataBuffer,
        encryptedData
      ])
    };
  },
  
  /**
   * Decrypt data using the appropriate algorithm based on the encrypted data format
   * @param {Object} params - Object containing encryptedData and algorithm
   * @param {Buffer} key - Encryption key (32 bytes)
   * @returns {Buffer} - Decrypted data
   */
  decrypt: async ({ encryptedData, algorithm }, key) => {
    if (!Buffer.isBuffer(encryptedData)) {
      encryptedData = Buffer.from(encryptedData);
    }
    
    // Always parse the standardized format created by encrypt()
    if (encryptedData.length < 2) {
      throw new Error('Invalid encrypted data format: too short');
    }
    
    const formatVersion = encryptedData[0];
    const algorithmCode = encryptedData[1];
    
    if (formatVersion !== 0x01) {
      throw new Error(`Unsupported format version: ${formatVersion}`);
    }
    
    const detectedAlgorithm = getAlgorithmFromCode(algorithmCode);
    const { metadata, data } = parseEncryptedData(encryptedData.slice(2));
    
    // Use provided algorithm or detected algorithm
    const useAlgorithm = algorithm || detectedAlgorithm;
    
    // Decrypt based on algorithm
    switch (useAlgorithm) {
      case 'aes-256-gcm':
        return decryptAesGcm(data, key, metadata);
      case 'aes-256-cbc':
        return decryptAesCbc(data, key, metadata);
      case 'chacha20-poly1305':
        if (!sodium) {
          throw new Error('ChaCha20-Poly1305 decryption is not available (libsodium-wrappers missing)');
        }
        return await decryptChacha20(data, key, metadata);
      default:
        throw new Error(`Unsupported decryption algorithm: ${useAlgorithm}`);
    }
  },
  
  /**
   * List available encryption algorithms
   * @returns {Array<Object>} - Array of algorithm objects with name, code, and description
   */
  listAlgorithms: () => {
    const algorithms = [
      {
        name: 'aes-256-gcm',
        code: 0x01,
        description: 'AES-256-GCM - A secure authenticated encryption algorithm with good performance',
        strength: 'High'
      },
      {
        name: 'aes-256-cbc',
        code: 0x02,
        description: 'AES-256-CBC - A widely compatible block cipher encryption',
        strength: 'Medium-High'
      }
    ];
    
    // Add ChaCha20-Poly1305 only if sodium is available
    if (sodium) {
      algorithms.push({
        name: 'chacha20-poly1305',
        code: 0x03,
        description: 'ChaCha20-Poly1305 - A modern stream cipher with high performance on devices without AES hardware acceleration',
        strength: 'High'
      });
    }
    
    return algorithms;
  },
  
  /**
   * Get all available encryption methods
   * @returns {Array<string>} - Array of encryption method names
   */
  getAllEncryptionMethods: () => {
    const methods = [
      'aes-256-gcm',    // Authenticated encryption, most secure
      'aes-256-cbc',    // Block cipher, widely compatible
      'aes-256-ctr',    // Counter mode, good for streaming
      'aes-256-ofb'     // Output feedback mode, self-synchronizing
    ];
    
    // Add ChaCha20 methods only if sodium is available
    if (sodium) {
      methods.push('chacha20-poly1305');   // Modern stream cipher with authentication
      methods.push('xchacha20-poly1305');  // Extended nonce ChaCha20
    }
    
    return methods;
  },
  
  /**
   * Get current encryption method
   * @returns {string} - Current encryption method
   */
  getEncryptionMethod: () => {
    return currentEncryptionMethod;
  },
  
  /**
   * Set encryption method
   * @param {string} method - Encryption method to set
   * @returns {boolean} - Success status
   */
  setEncryptionMethod: (method) => {
    const supportedMethods = module.exports.getAllEncryptionMethods();
    if (supportedMethods.includes(method)) {
      currentEncryptionMethod = method;
      return true;
    }
    return false;
  }
};

/**
 * AES-256-GCM encryption
 */
function encryptAesGcm(data, key) {
  const iv = crypto.randomBytes(12); // GCM recommends 12 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    iv,
    authTag
  };
}

/**
 * AES-256-GCM decryption
 */
function decryptAesGcm(data, key, metadata = null) {
  let iv, authTag, encryptedData;
  
  if (metadata) {
    // Use provided metadata
    ({ iv, authTag } = metadata);
    encryptedData = data;
  } else {
    // Extract metadata from the data
    const ivLength = 12;
    const authTagLength = 16;
    
    iv = data.slice(0, ivLength);
    authTag = data.slice(ivLength, ivLength + authTagLength);
    encryptedData = data.slice(ivLength + authTagLength);
  }
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([
    decipher.update(encryptedData),
    decipher.final()
  ]);
}

/**
 * AES-256-CBC encryption
 */
function encryptAesCbc(data, key) {
  const iv = crypto.randomBytes(16); // CBC requires a 16-byte IV
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final()
  ]);
  
  return {
    encryptedData: encrypted,
    iv
  };
}

/**
 * AES-256-CBC decryption
 */
function decryptAesCbc(data, key, metadata = null) {
  let iv, encryptedData;
  
  if (metadata) {
    // Use provided metadata
    ({ iv } = metadata);
    encryptedData = data;
  } else {
    // Extract metadata from the data
    const ivLength = 16;
    
    iv = data.slice(0, ivLength);
    encryptedData = data.slice(ivLength);
  }
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  return Buffer.concat([
    decipher.update(encryptedData),
    decipher.final()
  ]);
}

/**
 * ChaCha20-Poly1305 encryption
 */
async function encryptChacha20(data, key) {
  if (!sodium) {
    throw new Error('libsodium-wrappers not available');
  }
  
  await sodium.ready;
  
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_NPUBBYTES);
  const encryptedData = sodium.crypto_aead_chacha20poly1305_encrypt(
    data,
    null, // No additional data
    null, // No secret nonce
    nonce,
    key
  );
  
  return {
    encryptedData,
    nonce
  };
}

/**
 * ChaCha20-Poly1305 decryption
 */
async function decryptChacha20(data, key, metadata = null) {
  if (!sodium) {
    throw new Error('libsodium-wrappers not available');
  }
  
  await sodium.ready;
  
  let nonce, encryptedData;
  
  if (metadata) {
    // Use provided metadata
    ({ nonce } = metadata);
    encryptedData = data;
  } else {
    // Extract metadata from the data
    const nonceLength = sodium.crypto_aead_chacha20poly1305_NPUBBYTES;
    
    nonce = data.slice(0, nonceLength);
    encryptedData = data.slice(nonceLength);
  }
  
  return sodium.crypto_aead_chacha20poly1305_decrypt(
    null, // No secret nonce
    encryptedData,
    null, // No additional data
    nonce,
    key
  );
}

/**
 * Serialize metadata for storage
 */
function serializeMetadata(metadata) {
  const chunks = [];
  
  for (const [fieldName, value] of Object.entries(metadata)) {
    if (!Buffer.isBuffer(value)) {
      continue; // Skip non-buffer values
    }
    
    const fieldTypeCode = getFieldTypeCode(fieldName);
    if (fieldTypeCode === 0) {
      continue; // Skip unknown fields
    }
    
    // Add field header: type code (1 byte) + length (1 byte)
    const header = Buffer.from([fieldTypeCode, value.length]);
    chunks.push(header);
    chunks.push(value);
  }
  
  // Combine all chunks
  const combinedSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = Buffer.concat(chunks, combinedSize);
  
  // Prepend with the total metadata length
  const lengthPrefix = Buffer.alloc(2);
  lengthPrefix.writeUInt16BE(result.length, 0);
  
  return Buffer.concat([lengthPrefix, result]);
}

/**
 * Parse encrypted data to extract metadata and payload
 */
function parseEncryptedData(data) {
  // First 2 bytes are the metadata length
  if (data.length < 2) {
    throw new Error('Invalid data format: too short to contain metadata length');
  }
  
  const metadataLength = data.readUInt16BE(0);
  
  if (data.length < 2 + metadataLength) {
    throw new Error('Invalid data format: declared metadata length exceeds available data');
  }
  
  const metadataBytes = data.slice(2, 2 + metadataLength);
  const payload = data.slice(2 + metadataLength);
  
  // Parse metadata fields
  const metadata = {};
  let offset = 0;
  
  while (offset < metadataBytes.length) {
    // Each field has a type code (1 byte) and length (1 byte)
    if (offset + 2 > metadataBytes.length) {
      break;
    }
    
    const fieldTypeCode = metadataBytes[offset++];
    const fieldLength = metadataBytes[offset++];
    
    if (offset + fieldLength > metadataBytes.length) {
      break;
    }
    
    const fieldValue = metadataBytes.slice(offset, offset + fieldLength);
    offset += fieldLength;
    
    const fieldName = getFieldNameFromCode(fieldTypeCode);
    if (fieldName) {
      metadata[fieldName] = fieldValue;
    }
  }
  
  return {
    metadata,
    data: payload
  };
}

/**
 * Get field type code for metadata serialization
 */
function getFieldTypeCode(fieldName) {
  const codes = {
    iv: 0x01,
    authTag: 0x02,
    nonce: 0x03,
    salt: 0x04
  };
  
  return codes[fieldName] || 0;
}

/**
 * Get field name from type code
 */
function getFieldNameFromCode(code) {
  const names = {
    0x01: 'iv',
    0x02: 'authTag',
    0x03: 'nonce',
    0x04: 'salt'
  };
  
  return names[code] || null;
}

/**
 * Get algorithm code for serialization
 */
function getAlgorithmCode(algorithm) {
  const codes = {
    'aes-256-gcm': 0x01,
    'aes-256-cbc': 0x02,
    'chacha20-poly1305': 0x03,
    'xchacha20-poly1305': 0x04
  };
  
  return codes[algorithm] || 0x01; // Default to AES-GCM if unknown
}

/**
 * Get algorithm name from code
 */
function getAlgorithmFromCode(code) {
  const algorithms = {
    0x01: 'aes-256-gcm',
    0x02: 'aes-256-cbc',
    0x03: 'chacha20-poly1305',
    0x04: 'xchacha20-poly1305'
  };
  
  return algorithms[code] || 'aes-256-gcm'; // Default to AES-GCM if unknown
} 