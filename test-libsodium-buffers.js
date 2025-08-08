#!/usr/bin/env node

/**
 * Test libsodium API with explicit buffer conversions
 */

const crypto = require('crypto');

let sodium;
try {
  sodium = require('libsodium-wrappers');
} catch (error) {
  console.error('Cannot load libsodium-wrappers:', error.message);
  process.exit(1);
}

async function testWithBuffers() {
  await sodium.ready;
  
  console.log('🔍 Testing libsodium with explicit buffer handling...\n');
  
  const testData = 'Hello!';
  const testKey = crypto.randomBytes(32);
  
  console.log(`📊 Test data: "${testData}" (${testData.length} chars)`);
  console.log(`🔑 Test key length: ${testKey.length} bytes`);
  
  try {
    // Generate a nonce - try different ways
    console.log('\n🎲 Generating nonce...');
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_NPUBBYTES);
    console.log(`📏 Nonce type: ${typeof nonce}, constructor: ${nonce.constructor.name}`);
    console.log(`📏 Nonce length: ${nonce.length} bytes`);
    
    // Convert to Uint8Array if needed
    const nonceArray = new Uint8Array(nonce);
    const keyArray = new Uint8Array(testKey);
    const dataArray = new Uint8Array(Buffer.from(testData));
    
    console.log(`\n🔄 Converted types:`);
    console.log(`  - Data: ${dataArray.constructor.name} (${dataArray.length} bytes)`);
    console.log(`  - Key: ${keyArray.constructor.name} (${keyArray.length} bytes)`);
    console.log(`  - Nonce: ${nonceArray.constructor.name} (${nonceArray.length} bytes)`);
    
    // Encrypt
    console.log('\n🔒 Encrypting...');
    const encrypted = sodium.crypto_aead_chacha20poly1305_encrypt(
      dataArray,
      null,       // additional_data
      null,       // secret_nonce
      nonceArray,
      keyArray
    );
    
    console.log(`✅ Encryption successful`);
    console.log(`📦 Encrypted type: ${typeof encrypted}, constructor: ${encrypted.constructor.name}`);
    console.log(`📦 Encrypted length: ${encrypted.length} bytes`);
    
    // Decrypt
    console.log('\n🔓 Decrypting...');
    const decrypted = sodium.crypto_aead_chacha20poly1305_decrypt(
      encrypted,
      null,       // additional_data
      nonceArray,
      keyArray
    );
    
    console.log(`✅ Decryption successful`);
    console.log(`📋 Decrypted type: ${typeof decrypted}, constructor: ${decrypted.constructor.name}`);
    console.log(`📋 Decrypted: "${Buffer.from(decrypted).toString()}" (${decrypted.length} bytes)`);
    
    const originalBuffer = Buffer.from(testData);
    const decryptedBuffer = Buffer.from(decrypted);
    
    if (originalBuffer.equals(decryptedBuffer)) {
      console.log('\n🎉 SUCCESS: Decrypted data matches original!');
      return true;
    } else {
      throw new Error('Decrypted data does not match original');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Error type:', error.constructor.name);
    
    // Try alternative API if available
    console.log('\n🔄 Trying alternative approach...');
    
    try {
      // Check if there are other ChaCha20 functions available
      console.log('Available crypto functions:');
      const cryptoFunctions = Object.keys(sodium).filter(key => key.includes('chacha20'));
      cryptoFunctions.forEach(func => console.log(`  - ${func}`));
      
      return false;
    } catch (altError) {
      console.error('Alternative approach failed:', altError.message);
      return false;
    }
  }
}

testWithBuffers().catch(console.error);

