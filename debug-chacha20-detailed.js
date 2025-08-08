#!/usr/bin/env node

/**
 * Detailed debug script for ChaCha20 encryption/decryption
 */

const crypto = require('crypto');

// Load libsodium directly to test the raw functions
let sodium;
try {
  sodium = require('libsodium-wrappers');
} catch (error) {
  console.error('Cannot load libsodium-wrappers:', error.message);
  process.exit(1);
}

async function debugRawChaCha20() {
  console.log('🔍 Testing raw ChaCha20 functions...\n');
  
  await sodium.ready;
  
  const testData = Buffer.from('Hello, World!');
  const testKey = crypto.randomBytes(32);
  
  console.log(`📊 Test data: "${testData.toString()}" (${testData.length} bytes)`);
  console.log(`🔑 Test key: ${testKey.toString('hex').substring(0, 16)}... (${testKey.length} bytes)`);
  console.log(`📏 Nonce size: ${sodium.crypto_aead_chacha20poly1305_NPUBBYTES} bytes\n`);
  
  try {
    // Step 1: Generate nonce and encrypt
    console.log('Step 1: Raw ChaCha20 encryption...');
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_NPUBBYTES);
    console.log(`🎲 Generated nonce: ${nonce.toString('hex')} (${nonce.length} bytes)`);
    
    const encryptedRaw = sodium.crypto_aead_chacha20poly1305_encrypt(
      testData,
      null, // No additional data
      null, // No secret nonce
      nonce,
      testKey
    );
    
    console.log(`✅ Raw encryption successful: ${encryptedRaw.length} bytes`);
    console.log(`📦 Raw encrypted data: ${encryptedRaw.toString('hex')}`);
    
    // Step 2: Decrypt with the correct parameters
    console.log('\nStep 2: Raw ChaCha20 decryption...');
    
    console.log(`🔓 Decrypting with:`);
    console.log(`  - Ciphertext: ${encryptedRaw.toString('hex')} (${encryptedRaw.length} bytes)`);
    console.log(`  - Nonce: ${nonce.toString('hex')} (${nonce.length} bytes)`);
    console.log(`  - Key: ${testKey.toString('hex').substring(0, 16)}... (${testKey.length} bytes)`);
    
    const decryptedRaw = sodium.crypto_aead_chacha20poly1305_decrypt(
      encryptedRaw,
      null, // No additional data
      nonce,
      testKey
    );
    
    console.log(`✅ Raw decryption successful: ${decryptedRaw.length} bytes`);
    console.log(`📋 Decrypted data: "${decryptedRaw.toString()}"`);
    
    if (testData.equals(decryptedRaw)) {
      console.log('🎉 Raw ChaCha20 test PASSED!\n');
    } else {
      throw new Error('Raw decrypted data does not match original');
    }
    
    // Step 3: Test the format that our encrypt function creates
    console.log('Step 3: Testing our encrypt/decrypt functions...');
    
    // Simulate what our encryptChacha20 function does
    const ourEncryptResult = {
      encryptedData: encryptedRaw,
      nonce: nonce
    };
    
    console.log(`📦 Our encrypt result:`);
    console.log(`  - encryptedData: ${ourEncryptResult.encryptedData.toString('hex')} (${ourEncryptResult.encryptedData.length} bytes)`);
    console.log(`  - nonce: ${ourEncryptResult.nonce.toString('hex')} (${ourEncryptResult.nonce.length} bytes)`);
    console.log(`  - nonce is Buffer: ${Buffer.isBuffer(ourEncryptResult.nonce)}`);
    
    // Simulate what happens in the main encrypt function
    const { encryptedData, ...metadata } = ourEncryptResult;
    
    console.log(`\n📋 Extracted metadata:`);
    console.log(`  - metadata object:`, metadata);
    console.log(`  - metadata keys:`, Object.keys(metadata));
    console.log(`  - nonce in metadata: ${metadata.nonce ? metadata.nonce.toString('hex') : 'undefined'}`);
    console.log(`  - nonce is Buffer: ${Buffer.isBuffer(metadata.nonce)}`);
    
    // Now test our decrypt function logic
    console.log('\nStep 4: Testing our decrypt logic...');
    
    // Test without metadata (should extract from data)
    const testPayload = Buffer.concat([nonce, encryptedRaw]);
    console.log(`🔍 Test payload (nonce + encrypted): ${testPayload.toString('hex')} (${testPayload.length} bytes)`);
    
    // Extract like our function does
    const nonceLength = sodium.crypto_aead_chacha20poly1305_NPUBBYTES;
    const extractedNonce = testPayload.slice(0, nonceLength);
    const extractedEncrypted = testPayload.slice(nonceLength);
    
    console.log(`📤 Extracted nonce: ${extractedNonce.toString('hex')} (${extractedNonce.length} bytes)`);
    console.log(`📤 Extracted encrypted: ${extractedEncrypted.toString('hex')} (${extractedEncrypted.length} bytes)`);
    
    // Test decryption with extracted values
    const decryptedExtracted = sodium.crypto_aead_chacha20poly1305_decrypt(
      extractedEncrypted,
      null, // No additional data
      extractedNonce,
      testKey
    );
    
    console.log(`✅ Decryption with extracted values successful!`);
    console.log(`📋 Decrypted: "${decryptedExtracted.toString()}"`);
    
    if (testData.equals(decryptedExtracted)) {
      console.log('🎉 Extraction method test PASSED!');
    } else {
      throw new Error('Extraction method decrypted data does not match original');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

debugRawChaCha20().catch(console.error);

