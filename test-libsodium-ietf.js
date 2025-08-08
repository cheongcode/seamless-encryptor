#!/usr/bin/env node

/**
 * Test libsodium IETF variants
 */

const crypto = require('crypto');

let sodium;
try {
  sodium = require('libsodium-wrappers');
} catch (error) {
  console.error('Cannot load libsodium-wrappers:', error.message);
  process.exit(1);
}

async function testIETFVariants() {
  await sodium.ready;
  
  console.log('🔍 Testing libsodium IETF variants...\n');
  
  const testData = 'Hello, ChaCha20!';
  const testKey = crypto.randomBytes(32);
  
  console.log(`📊 Test data: "${testData}" (${testData.length} chars)`);
  console.log(`🔑 Test key length: ${testKey.length} bytes`);
  
  try {
    // Test ChaCha20-Poly1305 IETF
    console.log('\n🧪 Testing ChaCha20-Poly1305 IETF...');
    console.log(`📏 IETF nonce length: ${sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES} bytes`);
    console.log(`📏 IETF auth tag length: ${sodium.crypto_aead_chacha20poly1305_ietf_ABYTES} bytes`);
    
    const nonce_ietf = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);
    const dataArray = new Uint8Array(Buffer.from(testData));
    const keyArray = new Uint8Array(testKey);
    const nonceArray = new Uint8Array(nonce_ietf);
    
    console.log(`🎲 Generated IETF nonce: ${Buffer.from(nonceArray).toString('hex')} (${nonceArray.length} bytes)`);
    
    // Encrypt with IETF variant
    console.log('🔒 Encrypting with IETF variant...');
    const encrypted_ietf = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
      dataArray,
      null,       // additional_data
      null,       // secret_nonce
      nonceArray,
      keyArray
    );
    
    console.log(`✅ IETF encryption successful: ${encrypted_ietf.length} bytes`);
    
    // Decrypt with IETF variant
    console.log('🔓 Decrypting with IETF variant...');
    const decrypted_ietf = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
      encrypted_ietf,
      null,       // additional_data
      nonceArray,
      keyArray
    );
    
    console.log(`✅ IETF decryption successful!`);
    console.log(`📋 Decrypted: "${Buffer.from(decrypted_ietf).toString()}" (${decrypted_ietf.length} bytes)`);
    
    if (Buffer.from(testData).equals(Buffer.from(decrypted_ietf))) {
      console.log('🎉 ChaCha20-Poly1305 IETF test PASSED!');
    } else {
      throw new Error('IETF decrypted data does not match original');
    }
    
    // Test XChaCha20-Poly1305 IETF
    console.log('\n🧪 Testing XChaCha20-Poly1305 IETF...');
    console.log(`📏 XChaCha20 IETF nonce length: ${sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES} bytes`);
    console.log(`📏 XChaCha20 IETF auth tag length: ${sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES} bytes`);
    
    const nonce_xchacha = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const xnonceArray = new Uint8Array(nonce_xchacha);
    
    console.log(`🎲 Generated XChaCha20 nonce: ${Buffer.from(xnonceArray).toString('hex')} (${xnonceArray.length} bytes)`);
    
    // Encrypt with XChaCha20
    console.log('🔒 Encrypting with XChaCha20 IETF...');
    const encrypted_xchacha = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      dataArray,
      null,        // additional_data
      null,        // secret_nonce
      xnonceArray,
      keyArray
    );
    
    console.log(`✅ XChaCha20 encryption successful: ${encrypted_xchacha.length} bytes`);
    
    // Decrypt with XChaCha20
    console.log('🔓 Decrypting with XChaCha20 IETF...');
    const decrypted_xchacha = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      encrypted_xchacha,
      null,        // additional_data
      xnonceArray,
      keyArray
    );
    
    console.log(`✅ XChaCha20 decryption successful!`);
    console.log(`📋 Decrypted: "${Buffer.from(decrypted_xchacha).toString()}" (${decrypted_xchacha.length} bytes)`);
    
    if (Buffer.from(testData).equals(Buffer.from(decrypted_xchacha))) {
      console.log('🎉 XChaCha20-Poly1305 IETF test PASSED!');
    } else {
      throw new Error('XChaCha20 decrypted data does not match original');
    }
    
    console.log('\n🎉 ALL IETF TESTS PASSED!');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testIETFVariants().catch(console.error);

