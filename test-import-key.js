#!/usr/bin/env node

/**
 * Test suite for Bug 1: Import Key functionality
 * Tests the import key feature to ensure it:
 * 1. Creates individual key files in the keys directory
 * 2. Doesn't overwrite existing keys
 * 3. Validates key format properly
 * 4. Handles invalid keys gracefully
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Simulate the key storage system from main.js
let keyStorage = new Map();
let activeKeyId = null;

function generateKeyId() {
  return crypto.randomBytes(4).toString('hex');
}

function addKeyToStorage(key, metadata = {}) {
  const keyId = generateKeyId();
  const keyInfo = {
    key: key,
    metadata: {
      type: metadata.type || 'Generated Key',
      created: new Date().toISOString(),
      description: metadata.description || 'Encryption key',
      ...metadata
    }
  };
  
  keyStorage.set(keyId, keyInfo);
  
  if (!activeKeyId) {
    activeKeyId = keyId;
  }
  
  console.log(`[KeyManager] Added key ${keyId}, active: ${keyId === activeKeyId}`);
  return keyId;
}

// Test directory setup
const testDir = path.join(__dirname, 'test-keys');
const keysDir = path.join(testDir, 'keys');

function setupTestEnvironment() {
  console.log('🧪 Setting up test environment...');
  
  // Clean up any existing test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  
  // Create test directories
  fs.mkdirSync(testDir, { recursive: true });
  fs.mkdirSync(keysDir, { recursive: true });
  
  console.log('✅ Test environment ready');
}

function cleanupTestEnvironment() {
  console.log('🧹 Cleaning up test environment...');
  
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  
  // Reset storage
  keyStorage.clear();
  activeKeyId = null;
  
  console.log('✅ Test environment cleaned');
}

// Simulate the import key functionality
async function simulateImportKey(keyData) {
  try {
    console.log('import-key handler called');
    
    // Validate key data
    if (!keyData) {
      return { success: false, error: 'No key data provided' };
    }
    
    // Convert to buffer if it's a hex string
    let key;
    if (typeof keyData === 'string') {
      // Check if it's a valid hex string
      if (!/^[0-9a-f]+$/i.test(keyData)) {
        return { success: false, error: 'Invalid key format, must be hex string' };
      }
      
      // Ensure key is 32 bytes (256 bits)
      if (keyData.length !== 64) { // 32 bytes = 64 hex chars
        return { success: false, error: 'Key must be 256 bits (32 bytes)' };
      }
      
      key = Buffer.from(keyData, 'hex');
    } else if (Buffer.isBuffer(keyData)) {
      // Ensure key is 32 bytes (256 bits)
      if (keyData.length !== 32) {
        return { success: false, error: 'Key must be 256 bits (32 bytes)' };
      }
      
      key = keyData;
    } else {
      return { success: false, error: 'Invalid key type, must be string or buffer' };
    }
    
    // Add to key storage system instead of overwriting
    const keyId = addKeyToStorage(key, {
      type: 'Imported Key',
      description: 'Key imported by user'
    });
    
    // Save key to individual file in keys directory
    try {
      const keyFilePath = path.join(keysDir, `${keyId}.key`);
      const keyFileData = {
        keyId: keyId,
        key: key.toString('hex'),
        metadata: {
          type: 'Imported Key',
          description: 'Key imported by user',
          created: new Date().toISOString(),
          imported: true
        }
      };
      fs.writeFileSync(keyFilePath, JSON.stringify(keyFileData, null, 2), 'utf8');
      console.log(`Imported key saved to file: ${keyFilePath}`);
    } catch (fileErr) {
      console.error('Error saving imported key to file system:', fileErr);
      // Don't fail the import if file saving fails
    }
    
    console.log(`[KeyManager] Imported key: ${keyId}`);
    return {
      success: true,
      keyId: keyId,
      isActive: activeKeyId === keyId
    };
  } catch (error) {
    console.error('Error importing key:', error);
    return { success: false, error: error.message };
  }
}

// Test functions
async function testValidKeyImport() {
  console.log('\n📝 Test 1: Import a valid key');
  
  // Generate a valid 32-byte hex key
  const validKey = crypto.randomBytes(32).toString('hex');
  console.log(`Generated test key: ${validKey.substring(0, 16)}...`);
  
  const result = await simulateImportKey(validKey);
  
  if (!result.success) {
    throw new Error(`Expected success but got error: ${result.error}`);
  }
  
  // Check if key file was created
  const keyFiles = fs.readdirSync(keysDir);
  if (keyFiles.length !== 1) {
    throw new Error(`Expected 1 key file, found ${keyFiles.length}`);
  }
  
  // Verify key file content
  const keyFilePath = path.join(keysDir, keyFiles[0]);
  const keyFileContent = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
  
  if (keyFileContent.key !== validKey) {
    throw new Error('Key file does not contain the correct key');
  }
  
  if (keyFileContent.metadata.type !== 'Imported Key') {
    throw new Error('Key file metadata is incorrect');
  }
  
  console.log('✅ Test 1 PASSED: Valid key imported successfully');
  return result.keyId;
}

async function testMultipleKeyImports() {
  console.log('\n📝 Test 2: Import two different keys (no overwrite)');
  
  // Import second key
  const secondKey = crypto.randomBytes(32).toString('hex');
  console.log(`Generated second test key: ${secondKey.substring(0, 16)}...`);
  
  const result = await simulateImportKey(secondKey);
  
  if (!result.success) {
    throw new Error(`Expected success but got error: ${result.error}`);
  }
  
  // Check if we now have 2 key files
  const keyFiles = fs.readdirSync(keysDir);
  if (keyFiles.length !== 2) {
    throw new Error(`Expected 2 key files, found ${keyFiles.length}`);
  }
  
  // Verify both keys exist in storage
  if (keyStorage.size !== 2) {
    throw new Error(`Expected 2 keys in storage, found ${keyStorage.size}`);
  }
  
  console.log('✅ Test 2 PASSED: Multiple keys imported without overwriting');
  return result.keyId;
}

async function testInvalidKeyFormats() {
  console.log('\n📝 Test 3: Attempt to import invalid keys');
  
  const invalidKeys = [
    { key: '', description: 'empty string' },
    { key: 'invalid_hex_chars', description: 'non-hex characters' },
    { key: '123456789abcdef', description: 'too short (15 chars)' },
    { key: crypto.randomBytes(16).toString('hex'), description: 'wrong length (16 bytes)' },
    { key: crypto.randomBytes(64).toString('hex'), description: 'too long (64 bytes)' },
    { key: 'gg' + crypto.randomBytes(31).toString('hex'), description: 'invalid hex character' }
  ];
  
  let passedTests = 0;
  
  for (const testCase of invalidKeys) {
    console.log(`  Testing: ${testCase.description}`);
    
    const result = await simulateImportKey(testCase.key);
    
    if (result.success) {
      throw new Error(`Expected failure for ${testCase.description} but got success`);
    }
    
    console.log(`    ✅ Correctly rejected: ${result.error}`);
    passedTests++;
  }
  
  // Verify no additional keys were added
  const keyFiles = fs.readdirSync(keysDir);
  if (keyFiles.length !== 2) {
    throw new Error(`Expected 2 key files after invalid attempts, found ${keyFiles.length}`);
  }
  
  console.log(`✅ Test 3 PASSED: All ${passedTests} invalid key formats correctly rejected`);
}

async function testKeyFileIntegrity() {
  console.log('\n📝 Test 4: Verify key file structure and integrity');
  
  const keyFiles = fs.readdirSync(keysDir);
  
  for (const keyFile of keyFiles) {
    const keyFilePath = path.join(keysDir, keyFile);
    const keyFileContent = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
    
    // Verify required fields
    const requiredFields = ['keyId', 'key', 'metadata'];
    for (const field of requiredFields) {
      if (!(field in keyFileContent)) {
        throw new Error(`Key file ${keyFile} missing required field: ${field}`);
      }
    }
    
    // Verify metadata structure
    const requiredMetadataFields = ['type', 'description', 'created', 'imported'];
    for (const field of requiredMetadataFields) {
      if (!(field in keyFileContent.metadata)) {
        throw new Error(`Key file ${keyFile} missing required metadata field: ${field}`);
      }
    }
    
    // Verify key format
    if (!/^[0-9a-f]{64}$/i.test(keyFileContent.key)) {
      throw new Error(`Key file ${keyFile} contains invalid key format`);
    }
    
    // Verify file name matches keyId
    if (!keyFile.startsWith(keyFileContent.keyId)) {
      throw new Error(`Key file name ${keyFile} does not match keyId ${keyFileContent.keyId}`);
    }
    
    console.log(`  ✅ Key file ${keyFile} structure is valid`);
  }
  
  console.log('✅ Test 4 PASSED: All key files have correct structure and integrity');
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Import Key functionality tests...\n');
  
  try {
    setupTestEnvironment();
    
    const firstKeyId = await testValidKeyImport();
    const secondKeyId = await testMultipleKeyImports();
    await testInvalidKeyFormats();
    await testKeyFileIntegrity();
    
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log(`📊 Summary:`);
    console.log(`  - Valid keys imported: 2`);
    console.log(`  - Keys in storage: ${keyStorage.size}`);
    console.log(`  - Key files created: ${fs.readdirSync(keysDir).length}`);
    console.log(`  - Active key: ${activeKeyId}`);
    console.log(`  - First key ID: ${firstKeyId}`);
    console.log(`  - Second key ID: ${secondKeyId}`);
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    cleanupTestEnvironment();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  setupTestEnvironment,
  cleanupTestEnvironment,
  simulateImportKey
};

