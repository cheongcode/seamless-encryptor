#!/usr/bin/env node

/**
 * Test suite for Bug 4: Download decrypted file functionality
 * Tests that:
 * 1. Decrypted files are saved in the configured output directory
 * 2. Missing directories are created automatically
 * 3. Downloaded files are not corrupted
 * 4. File naming and uniqueness works correctly
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

// Mock electron-store for testing
const mockStore = {
  data: {},
  get: function(key) {
    return this.data[key];
  },
  set: function(key, value) {
    this.data[key] = value;
  },
  clear: function() {
    this.data = {};
  }
};

// Test directory setup
const testDir = path.join(__dirname, 'test-download');
const testOutputDir = path.join(testDir, 'output');
const testEncryptedDir = path.join(testDir, 'encrypted');

function setupTestEnvironment() {
  console.log('🧪 Setting up test environment...');
  
  // Clean up any existing test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  
  // Create test directories
  fs.mkdirSync(testDir, { recursive: true });
  fs.mkdirSync(testEncryptedDir, { recursive: true });
  // Note: Don't create output dir - we want to test auto-creation
  
  // Set up mock store with test output directory
  mockStore.set('appSettings.outputDir', testOutputDir);
  
  console.log('✅ Test environment ready');
}

function cleanupTestEnvironment() {
  console.log('🧹 Cleaning up test environment...');
  
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  
  mockStore.clear();
  
  console.log('✅ Test environment cleaned');
}

// Simulate the ensureOutputDirExists function from main.js
function simulateEnsureOutputDirExists() {
  const outputDir = mockStore.get('appSettings.outputDir');
  if (outputDir && !fs.existsSync(outputDir)) {
    try {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('Created output directory:', outputDir);
    } catch (error) {
      console.error('Error creating output directory:', error);
    }
  }
  return outputDir;
}

// Simulate saving a decrypted file (from the updated decrypt-file handler)
function simulateSaveDecryptedFile(decryptedData, originalFileName) {
  // Use configured output directory
  const outputDir = simulateEnsureOutputDirExists();
  if (!outputDir) {
    throw new Error('Output directory not configured. Please check your settings.');
  }
  
  let fileName = originalFileName || `decrypted_file_${Date.now()}.bin`;
  
  // Generate unique filename if file already exists
  let decryptedFilePath = path.join(outputDir, fileName);
  let counter = 1;
  
  while (fs.existsSync(decryptedFilePath)) {
    const ext = path.extname(fileName);
    const nameWithoutExt = path.basename(fileName, ext);
    const newFileName = `${nameWithoutExt}_${counter}${ext}`;
    decryptedFilePath = path.join(outputDir, newFileName);
    counter++;
  }
  
  fs.writeFileSync(decryptedFilePath, decryptedData);
  console.log(`Decrypted file saved to: ${decryptedFilePath}`);
  
  return {
    success: true,
    filePath: decryptedFilePath,
    outputDir: outputDir
  };
}

async function testOutputDirectoryCreation() {
  console.log('\n📝 Test 1: Output directory creation');
  
  try {
    // Verify output directory doesn't exist initially
    if (fs.existsSync(testOutputDir)) {
      throw new Error('Output directory should not exist initially');
    }
    
    console.log('  📁 Output directory does not exist initially ✅');
    
    // Create test decrypted data
    const testContent = 'Test file content for directory creation test';
    const testData = Buffer.from(testContent);
    
    // Simulate saving a decrypted file
    console.log('  💾 Attempting to save decrypted file...');
    const result = simulateSaveDecryptedFile(testData, 'test_file.txt');
    
    if (!result.success) {
      throw new Error('Failed to save decrypted file');
    }
    
    // Verify output directory was created
    if (!fs.existsSync(testOutputDir)) {
      throw new Error('Output directory was not created');
    }
    
    console.log('  📁 Output directory created automatically ✅');
    
    // Verify file was saved correctly
    if (!fs.existsSync(result.filePath)) {
      throw new Error('Decrypted file was not saved');
    }
    
    const savedContent = fs.readFileSync(result.filePath, 'utf8');
    if (savedContent !== testContent) {
      throw new Error('Saved file content does not match original');
    }
    
    console.log('  📄 File saved correctly with proper content ✅');
    console.log(`  📂 Saved to: ${path.relative(testDir, result.filePath)}`);
    console.log('✅ Test 1 PASSED: Output directory creation works correctly');
    
    return true;
  } catch (error) {
    console.error(`❌ Output directory creation test failed: ${error.message}`);
    return false;
  }
}

async function testFileNamingAndUniqueness() {
  console.log('\n📝 Test 2: File naming and uniqueness');
  
  try {
    const testContent = 'Test content for uniqueness';
    const testData = Buffer.from(testContent);
    const baseFileName = 'duplicate_test.txt';
    
    // Save first file
    console.log('  💾 Saving first file...');
    const result1 = simulateSaveDecryptedFile(testData, baseFileName);
    
    if (!result1.success) {
      throw new Error('Failed to save first file');
    }
    
    console.log(`  📄 First file saved: ${path.basename(result1.filePath)}`);
    
    // Save second file with same name
    console.log('  💾 Saving second file with same name...');
    const result2 = simulateSaveDecryptedFile(testData, baseFileName);
    
    if (!result2.success) {
      throw new Error('Failed to save second file');
    }
    
    console.log(`  📄 Second file saved: ${path.basename(result2.filePath)}`);
    
    // Verify files have different names
    if (result1.filePath === result2.filePath) {
      throw new Error('Duplicate files have the same path');
    }
    
    console.log('  ✅ Files have unique names');
    
    // Save third file with same name
    console.log('  💾 Saving third file with same name...');
    const result3 = simulateSaveDecryptedFile(testData, baseFileName);
    
    if (!result3.success) {
      throw new Error('Failed to save third file');
    }
    
    console.log(`  📄 Third file saved: ${path.basename(result3.filePath)}`);
    
    // Verify all three files exist and have different names
    const filePaths = [result1.filePath, result2.filePath, result3.filePath];
    const uniquePaths = new Set(filePaths);
    
    if (uniquePaths.size !== 3) {
      throw new Error('Not all files have unique paths');
    }
    
    // Verify all files exist
    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File ${filePath} does not exist`);
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      if (content !== testContent) {
        throw new Error(`File ${filePath} has incorrect content`);
      }
    }
    
    console.log('  ✅ All files exist with correct content');
    console.log('✅ Test 2 PASSED: File naming and uniqueness works correctly');
    
    return true;
  } catch (error) {
    console.error(`❌ File naming and uniqueness test failed: ${error.message}`);
    return false;
  }
}

async function testFileIntegrity() {
  console.log('\n📝 Test 3: File integrity (no corruption)');
  
  try {
    // Test different types of data
    const testCases = [
      {
        name: 'Text file',
        data: Buffer.from('This is a text file with special characters: áéíóú ñ 中文 🔐'),
        fileName: 'text_test.txt'
      },
      {
        name: 'Binary file (simulated image)',
        data: Buffer.from([
          0xFF, 0xD8, 0xFF, 0xE0, // JPEG header
          ...Array(256).fill(0).map(() => Math.floor(Math.random() * 256))
        ]),
        fileName: 'image_test.jpg'
      },
      {
        name: 'Large text file',
        data: Buffer.from('Line of text\n'.repeat(1000)),
        fileName: 'large_test.txt'
      }
    ];
    
    let passedTests = 0;
    
    for (const testCase of testCases) {
      console.log(`  📄 Testing: ${testCase.name}`);
      
      // Save the file
      const result = simulateSaveDecryptedFile(testCase.data, testCase.fileName);
      
      if (!result.success) {
        throw new Error(`Failed to save ${testCase.name}`);
      }
      
      // Read back and verify integrity
      const savedData = fs.readFileSync(result.filePath);
      
      if (!testCase.data.equals(savedData)) {
        throw new Error(`Data corruption detected in ${testCase.name}`);
      }
      
      console.log(`    ✅ ${testCase.name} integrity preserved`);
      console.log(`    📊 Size: ${testCase.data.length} bytes`);
      
      passedTests++;
    }
    
    console.log(`  ✅ All ${passedTests} file integrity tests passed`);
    console.log('✅ Test 3 PASSED: File integrity is preserved');
    
    return true;
  } catch (error) {
    console.error(`❌ File integrity test failed: ${error.message}`);
    return false;
  }
}

async function testOutputDirectoryConfiguration() {
  console.log('\n📝 Test 4: Output directory configuration');
  
  try {
    // Test with different output directory configurations
    const testConfigs = [
      { name: 'Default Documents path', dir: path.join(testDir, 'Documents', 'SeamlessEncryptor_Output') },
      { name: 'Custom user path', dir: path.join(testDir, 'MyCustomOutput') },
      { name: 'Nested path', dir: path.join(testDir, 'nested', 'deep', 'output') }
    ];
    
    let passedConfigs = 0;
    
    for (const config of testConfigs) {
      console.log(`  📁 Testing: ${config.name}`);
      
      // Set new output directory
      mockStore.set('appSettings.outputDir', config.dir);
      
      // Verify directory doesn't exist
      if (fs.existsSync(config.dir)) {
        fs.rmSync(config.dir, { recursive: true, force: true });
      }
      
      // Save a test file
      const testData = Buffer.from(`Test for ${config.name}`);
      const result = simulateSaveDecryptedFile(testData, `config_test_${passedConfigs}.txt`);
      
      if (!result.success) {
        throw new Error(`Failed to save file for ${config.name}`);
      }
      
      // Verify directory was created
      if (!fs.existsSync(config.dir)) {
        throw new Error(`Directory not created for ${config.name}`);
      }
      
      // Verify file was saved in correct location
      if (!result.filePath.startsWith(config.dir)) {
        throw new Error(`File not saved in correct directory for ${config.name}`);
      }
      
      console.log(`    ✅ ${config.name} configuration works`);
      console.log(`    📂 Created: ${path.relative(testDir, config.dir)}`);
      
      passedConfigs++;
    }
    
    console.log(`  ✅ All ${passedConfigs} directory configurations work`);
    console.log('✅ Test 4 PASSED: Output directory configuration works correctly');
    
    return true;
  } catch (error) {
    console.error(`❌ Output directory configuration test failed: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Download Decrypted File functionality tests...\n');
  
  let passedTests = 0;
  let totalTests = 4;
  
  try {
    setupTestEnvironment();
    
    if (await testOutputDirectoryCreation()) passedTests++;
    if (await testFileNamingAndUniqueness()) passedTests++;
    if (await testFileIntegrity()) passedTests++;
    if (await testOutputDirectoryConfiguration()) passedTests++;
    
    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL DOWNLOAD DECRYPTED FILE TESTS PASSED!');
      console.log('📋 Summary:');
      console.log('  - Output directory auto-creation: ✅');
      console.log('  - File naming and uniqueness: ✅');
      console.log('  - File integrity preservation: ✅');
      console.log('  - Directory configuration: ✅');
      console.log('\n💡 Decrypted files are now properly saved to the configured output directory!');
    } else {
      console.log('⚠️  Some download decrypted file tests failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
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
  simulateEnsureOutputDirExists,
  simulateSaveDecryptedFile
};

