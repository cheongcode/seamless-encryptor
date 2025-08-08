#!/usr/bin/env node

/**
 * Debug script for ChaCha20 encryption/decryption
 */

const crypto = require('crypto');
const encryptionMethods = require('./src/crypto/encryptionMethods.js');

async function debugChaCha20() {
  console.log('🔍 Debugging ChaCha20 encryption/decryption...\n');

  const testData = Buffer.from('Hello, World!');
  const testKey = crypto.randomBytes(32);
  
  console.log(`📊 Test data: "${testData.toString()}" (${testData.length} bytes)`);
  console.log(`🔑 Test key: ${testKey.toString('hex').substring(0, 16)}... (${testKey.length} bytes)\n`);
  
  try {
    // Step 1: Encrypt
    console.log('Step 1: Encrypting...');
    const encryptResult = await encryptionMethods.encrypt(testData, testKey, 'chacha20-poly1305');
    
    console.log(`✅ Encryption result structure:`);
    console.log(`  - Algorithm: ${encryptResult.algorithm}`);
    console.log(`  - Encrypted data length: ${encryptResult.encryptedData.length} bytes`);
    console.log(`  - Encrypted data (hex): ${encryptResult.encryptedData.toString('hex').substring(0, 32)}...`);
    
    // Step 2: Examine the encrypted data structure
    console.log('\nStep 2: Analyzing encrypted data structure...');
    const encData = encryptResult.encryptedData;
    
    if (encData.length >= 2) {
      console.log(`  - Format version: 0x${encData[0].toString(16).padStart(2, '0')}`);
      console.log(`  - Algorithm code: 0x${encData[1].toString(16).padStart(2, '0')}`);
      
      if (encData.length >= 4) {
        const metadataLength = encData.readUInt16BE(2);
        console.log(`  - Metadata length: ${metadataLength} bytes`);
        
        if (encData.length >= 4 + metadataLength) {
          const payloadLength = encData.length - 4 - metadataLength;
          console.log(`  - Payload length: ${payloadLength} bytes`);
        }
      }
    }
    
    // Step 3: Decrypt
    console.log('\nStep 3: Decrypting...');
    const decryptResult = await encryptionMethods.decrypt({
      encryptedData: encryptResult.encryptedData,
      algorithm: 'chacha20-poly1305'
    }, testKey);
    
    console.log(`✅ Decryption successful!`);
    console.log(`📋 Decrypted data: "${decryptResult.toString()}" (${decryptResult.length} bytes)`);
    
    // Step 4: Verify
    if (testData.equals(decryptResult)) {
      console.log('\n🎉 SUCCESS: Decrypted data matches original!');
    } else {
      throw new Error('Decrypted data does not match original');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

debugChaCha20().catch(console.error);

