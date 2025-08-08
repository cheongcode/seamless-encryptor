#!/usr/bin/env node

/**
 * Test libsodium API to understand the correct parameter order
 */

const crypto = require('crypto');

let sodium;
try {
  sodium = require('libsodium-wrappers');
} catch (error) {
  console.error('Cannot load libsodium-wrappers:', error.message);
  process.exit(1);
}

async function testLibsodiumAPI() {
  await sodium.ready;
  
  console.log('🔍 Testing libsodium ChaCha20-Poly1305 API...\n');
  
  const testData = Buffer.from('Hello!');
  const testKey = crypto.randomBytes(32);
  
  console.log(`📊 Test data: "${testData.toString()}" (${testData.length} bytes)`);
  console.log(`🔑 Test key length: ${testKey.length} bytes`);
  console.log(`📏 Expected key length: ${sodium.crypto_aead_chacha20poly1305_KEYBYTES} bytes`);
  console.log(`📏 Nonce length: ${sodium.crypto_aead_chacha20poly1305_NPUBBYTES} bytes`);
  console.log(`📏 Auth tag length: ${sodium.crypto_aead_chacha20poly1305_ABYTES} bytes`);
  
  try {
    // Generate a proper nonce
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_NPUBBYTES);
    console.log(`\n🎲 Generated nonce: ${Buffer.from(nonce).toString('hex')} (${nonce.length} bytes)`);
    
    // Encrypt
    console.log('\n🔒 Encrypting...');
    const encrypted = sodium.crypto_aead_chacha20poly1305_encrypt(
      testData,
      null, // additional_data
      null, // secret_nonce (not used in this API)
      nonce,
      testKey
    );
    
    console.log(`✅ Encryption successful`);
    console.log(`📦 Encrypted length: ${encrypted.length} bytes (data: ${testData.length} + auth tag: ${sodium.crypto_aead_chacha20poly1305_ABYTES})`);
    console.log(`📦 Encrypted data: ${Buffer.from(encrypted).toString('hex')}`);
    
    // Decrypt with correct parameter order
    console.log('\n🔓 Decrypting...');
    console.log(`🔓 Parameters:`);
    console.log(`  - encrypted: ${Buffer.from(encrypted).toString('hex')} (${encrypted.length} bytes, type: ${typeof encrypted})`);
    console.log(`  - additional_data: null`);
    console.log(`  - nonce: ${Buffer.from(nonce).toString('hex')} (${nonce.length} bytes, type: ${typeof nonce})`);
    console.log(`  - key: ${Buffer.from(testKey).toString('hex').substring(0, 16)}... (${testKey.length} bytes, type: ${typeof testKey})`);
    
    const decrypted = sodium.crypto_aead_chacha20poly1305_decrypt(
      encrypted,    // ciphertext
      null,         // additional_data
      nonce,        // public_nonce
      testKey       // key
    );
    
    console.log(`✅ Decryption successful`);
    console.log(`📋 Decrypted: "${Buffer.from(decrypted).toString()}" (${decrypted.length} bytes)`);
    
    if (Buffer.from(decrypted).equals(testData)) {
      console.log('\n🎉 SUCCESS: Decrypted data matches original!');
    } else {
      throw new Error('Decrypted data does not match original');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Error type:', error.constructor.name);
    console.error('Stack trace:', error.stack);
  }
}

testLibsodiumAPI().catch(console.error);

