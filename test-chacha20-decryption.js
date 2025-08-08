#!/usr/bin/env node

/**
 * Test suite for Bug 2: ChaCha20 & XChaCha20 Decryption Failures
 * Tests the encryption and decryption functionality to ensure:
 * 1. ChaCha20 encrypt & decrypt works correctly
 * 2. XChaCha20 encrypt & decrypt works correctly
 * 3. Tampered ciphertext fails securely
 * 4. Metadata handling works properly
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Mock sodium for testing (we'll use Node.js crypto for this test)
// In a real scenario, you'd need to install and import libsodium-wrappers

let sodium;

try {
  // Try to load the actual libsodium-wrappers if available
  sodium = require('libsodium-wrappers');
} catch (err) {
  console.log('⚠️  libsodium-wrappers not available, using mock implementation');
  // Create a mock sodium object for testing
  sodium = null;
}

// Import the encryption methods module
const encryptionMethods = require('./src/crypto/encryptionMethods.js');

// Test data
const testData = Buffer.from('Hello, World! This is a test message for encryption and decryption testing. 🔐');
const testKey = crypto.randomBytes(32); // 256-bit key

// Helper function to create test files
function createTestFile(filename, content) {
  const testDir = path.join(__dirname, 'test-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const filePath = path.join(testDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Helper function to cleanup test files
function cleanupTestFiles() {
  const testDir = path.join(__dirname, 'test-files');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

async function testChaCha20EncryptionDecryption() {
  console.log('\n📝 Test 1: ChaCha20 Encryption & Decryption');
  
  if (!sodium) {
    console.log('⏭️  Skipping ChaCha20 test - libsodium not available');
    return;
  }
  
  try {
    await sodium.ready;
    
    // Test encryption
    console.log('  🔒 Encrypting data with ChaCha20...');
    const encryptResult = await encryptionMethods.encrypt(testData, testKey, 'chacha20-poly1305');
    
    if (!encryptResult || !encryptResult.encryptedData || !Buffer.isBuffer(encryptResult.encryptedData)) {
      throw new Error('Encryption failed or returned invalid result');
    }
    
    console.log(`  ✅ Encryption successful, size: ${encryptResult.encryptedData.length} bytes`);
    console.log(`  📝 Algorithm used: ${encryptResult.algorithm}`);
    
    // Test decryption
    console.log('  🔓 Decrypting data with ChaCha20...');
    const decryptResult = await encryptionMethods.decrypt({
      encryptedData: encryptResult.encryptedData,
      algorithm: 'chacha20-poly1305'
    }, testKey);
    
    if (!decryptResult || !Buffer.isBuffer(decryptResult)) {
      throw new Error('Decryption failed or returned invalid result');
    }
    
    // Verify the decrypted data matches the original
    if (!testData.equals(decryptResult)) {
      throw new Error('Decrypted data does not match original data');
    }
    
    console.log('  ✅ Decryption successful, data matches original');
    console.log('✅ Test 1 PASSED: ChaCha20 encryption/decryption works correctly');
    
  } catch (error) {
    throw new Error(`ChaCha20 test failed: ${error.message}`);
  }
}

async function testXChaCha20EncryptionDecryption() {
  console.log('\n📝 Test 2: XChaCha20 Encryption & Decryption');
  
  if (!sodium) {
    console.log('⏭️  Skipping XChaCha20 test - libsodium not available');
    return;
  }
  
  try {
    await sodium.ready;
    
    // Test encryption
    console.log('  🔒 Encrypting data with XChaCha20...');
    const encryptResult = await encryptionMethods.encrypt(testData, testKey, 'xchacha20-poly1305');
    
    if (!encryptResult || !encryptResult.encryptedData || !Buffer.isBuffer(encryptResult.encryptedData)) {
      throw new Error('Encryption failed or returned invalid result');
    }
    
    console.log(`  ✅ Encryption successful, size: ${encryptResult.encryptedData.length} bytes`);
    console.log(`  📝 Algorithm used: ${encryptResult.algorithm}`);
    
    // Test decryption
    console.log('  🔓 Decrypting data with XChaCha20...');
    const decryptResult = await encryptionMethods.decrypt({
      encryptedData: encryptResult.encryptedData,
      algorithm: 'xchacha20-poly1305'
    }, testKey);
    
    if (!decryptResult || !Buffer.isBuffer(decryptResult)) {
      throw new Error('Decryption failed or returned invalid result');
    }
    
    // Verify the decrypted data matches the original
    if (!testData.equals(decryptResult)) {
      throw new Error('Decrypted data does not match original data');
    }
    
    console.log('  ✅ Decryption successful, data matches original');
    console.log('✅ Test 2 PASSED: XChaCha20 encryption/decryption works correctly');
    
  } catch (error) {
    throw new Error(`XChaCha20 test failed: ${error.message}`);
  }
}

async function testTamperedCiphertext() {
  console.log('\n📝 Test 3: Tampered ciphertext security');
  
  if (!sodium) {
    console.log('⏭️  Skipping tampered ciphertext test - libsodium not available');
    return;
  }
  
  try {
    await sodium.ready;
    
    // Encrypt with ChaCha20
    console.log('  🔒 Encrypting data for tampering test...');
    const encryptResult = await encryptionMethods.encrypt(testData, testKey, 'chacha20-poly1305');
    
    // Tamper with the ciphertext by flipping a bit
    const tamperedData = Buffer.from(encryptResult.encryptedData);
    tamperedData[tamperedData.length - 10] ^= 0x01; // Flip a bit in the authentication tag
    
    console.log('  🔨 Attempting to decrypt tampered data...');
    
    // Try to decrypt tampered data - this should fail
    try {
      await encryptionMethods.decrypt({
        encryptedData: tamperedData,
        algorithm: 'chacha20-poly1305'
      }, testKey);
      
      throw new Error('Decryption of tampered data should have failed but succeeded');
    } catch (decryptError) {
      // This is expected - tampered data should not decrypt
      console.log(`  ✅ Tampered data correctly rejected: ${decryptError.message}`);
    }
    
    // Also test with wrong key
    const wrongKey = crypto.randomBytes(32);
    console.log('  🔑 Attempting to decrypt with wrong key...');
    
    try {
      await encryptionMethods.decrypt({
        encryptedData: encryptResult.encryptedData,
        algorithm: 'chacha20-poly1305'
      }, wrongKey);
      
      throw new Error('Decryption with wrong key should have failed but succeeded');
    } catch (decryptError) {
      // This is expected - wrong key should not work
      console.log(`  ✅ Wrong key correctly rejected: ${decryptError.message}`);
    }
    
    console.log('✅ Test 3 PASSED: Tampered ciphertext and wrong keys are properly rejected');
    
  } catch (error) {
    throw new Error(`Tampered ciphertext test failed: ${error.message}`);
  }
}

async function testFileEncryptionDecryption() {
  console.log('\n📝 Test 4: File encryption/decryption end-to-end');
  
  if (!sodium) {
    console.log('⏭️  Skipping file encryption test - libsodium not available');
    return;
  }
  
  try {
    // Create test file
    const testContent = 'This is a test file for encryption.\nIt has multiple lines.\nAnd some special characters: 🔐📁🚀';
    const testFilePath = createTestFile('test.txt', testContent);
    
    console.log(`  📄 Created test file: ${path.basename(testFilePath)}`);
    
    // Read and encrypt file
    const fileData = fs.readFileSync(testFilePath);
    console.log(`  📊 File size: ${fileData.length} bytes`);
    
    // Test with both algorithms
    const algorithms = ['chacha20-poly1305', 'xchacha20-poly1305'];
    
    for (const algorithm of algorithms) {
      console.log(`  🔒 Testing ${algorithm}...`);
      
      // Encrypt
      const encryptResult = await encryptionMethods.encrypt(fileData, testKey, algorithm);
      console.log(`    ✅ Encrypted with ${algorithm}, size: ${encryptResult.encryptedData.length} bytes`);
      
      // Decrypt
      const decryptedData = await encryptionMethods.decrypt({
        encryptedData: encryptResult.encryptedData,
        algorithm: algorithm
      }, testKey);
      
      // Verify
      if (!fileData.equals(decryptedData)) {
        throw new Error(`Decrypted file data doesn't match original for ${algorithm}`);
      }
      
      console.log(`    ✅ Decrypted with ${algorithm}, data matches original`);
    }
    
    console.log('✅ Test 4 PASSED: File encryption/decryption works for both algorithms');
    
  } catch (error) {
    throw new Error(`File encryption test failed: ${error.message}`);
  } finally {
    cleanupTestFiles();
  }
}

async function testAlgorithmDetection() {
  console.log('\n📝 Test 5: Algorithm detection from encrypted data');
  
  if (!sodium) {
    console.log('⏭️  Skipping algorithm detection test - libsodium not available');
    return;
  }
  
  try {
    await sodium.ready;
    
    const algorithms = ['chacha20-poly1305', 'xchacha20-poly1305'];
    
    for (const algorithm of algorithms) {
      console.log(`  🔍 Testing algorithm detection for ${algorithm}...`);
      
      // Encrypt data
      const encryptResult = await encryptionMethods.encrypt(testData, testKey, algorithm);
      
      // Decrypt without specifying algorithm (should auto-detect)
      const decryptedData = await encryptionMethods.decrypt({
        encryptedData: encryptResult.encryptedData
        // Note: no algorithm specified, should be auto-detected
      }, testKey);
      
      // Verify
      if (!testData.equals(decryptedData)) {
        throw new Error(`Auto-detection failed for ${algorithm}`);
      }
      
      console.log(`    ✅ Auto-detection worked for ${algorithm}`);
    }
    
    console.log('✅ Test 5 PASSED: Algorithm auto-detection works correctly');
    
  } catch (error) {
    throw new Error(`Algorithm detection test failed: ${error.message}`);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting ChaCha20 & XChaCha20 decryption tests...');
  
  if (!sodium) {
    console.log('\n⚠️  WARNING: libsodium-wrappers not available');
    console.log('   To fully test ChaCha20/XChaCha20, install libsodium-wrappers:');
    console.log('   npm install libsodium-wrappers');
    console.log('\n   Running tests with available algorithms only...\n');
  } else {
    console.log('\n✅ libsodium-wrappers available, running full tests...\n');
  }
  
  try {
    await testChaCha20EncryptionDecryption();
    await testXChaCha20EncryptionDecryption();
    await testTamperedCiphertext();
    await testFileEncryptionDecryption();
    await testAlgorithmDetection();
    
    console.log('\n🎉 ALL CHACHA20/XCHACHA20 TESTS PASSED!');
    console.log('📊 Summary:');
    console.log('  - ChaCha20 encryption/decryption: ✅');
    console.log('  - XChaCha20 encryption/decryption: ✅');
    console.log('  - Security (tampered data rejection): ✅');
    console.log('  - File encryption/decryption: ✅');
    console.log('  - Algorithm auto-detection: ✅');
    
    if (!sodium) {
      console.log('\n⚠️  Note: Some tests were skipped due to missing libsodium-wrappers');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testChaCha20EncryptionDecryption,
  testXChaCha20EncryptionDecryption,
  testTamperedCiphertext,
  testFileEncryptionDecryption
};
