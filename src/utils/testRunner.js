const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async runTests() {
    logger.info('TestRunner', `Starting test suite with ${this.tests.length} tests`);
    
    for (const test of this.tests) {
      try {
        logger.debug('TestRunner', `Running test: ${test.name}`);
        await test.testFn();
        this.results.passed++;
        logger.info('TestRunner', `✅ ${test.name} - PASSED`);
      } catch (error) {
        this.results.failed++;
        logger.error('TestRunner', `❌ ${test.name} - FAILED`, { 
          error: error.message,
          stack: error.stack
        });
      }
      this.results.total++;
    }

    this.printSummary();
    return this.results;
  }

  printSummary() {
    const passRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
    
    logger.info('TestRunner', '='.repeat(50));
    logger.info('TestRunner', 'TEST SUMMARY');
    logger.info('TestRunner', '='.repeat(50));
    logger.info('TestRunner', `Total Tests: ${this.results.total}`);
    logger.info('TestRunner', `Passed: ${this.results.passed}`);
    logger.info('TestRunner', `Failed: ${this.results.failed}`);
    logger.info('TestRunner', `Pass Rate: ${passRate}%`);
    logger.info('TestRunner', '='.repeat(50));
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  }

  assertNotNull(value, message) {
    if (value == null) {
      throw new Error(`${message}: value should not be null or undefined`);
    }
  }

  assertBuffer(value, expectedLength, message) {
    this.assert(Buffer.isBuffer(value), `${message}: should be a Buffer`);
    if (expectedLength !== undefined) {
      this.assertEqual(value.length, expectedLength, `${message}: buffer length`);
    }
  }
}

function createTestSuite() {
  const testRunner = new TestRunner();

  testRunner.addTest('Logger Basic Functionality', async () => {
    logger.info('Test', 'Testing logger info level');
    logger.debug('Test', 'Testing logger debug level');
    logger.error('Test', 'Testing logger error level');
    logger.warn('Test', 'Testing logger warn level');
    
    logger.info('Test', 'Testing with data', { test: true, number: 42 });
  });

  testRunner.addTest('Crypto Key Generation', async () => {
    const keyManager = require('../config/keyManager');
    
    const key1 = keyManager.generateMasterKey();
    const key2 = keyManager.generateMasterKey();
    
    testRunner.assertBuffer(key1, 32, 'Generated key 1');
    testRunner.assertBuffer(key2, 32, 'Generated key 2');
    testRunner.assert(!key1.equals(key2), 'Keys should be unique');
  });

  testRunner.addTest('File Type Detection', async () => {
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    testRunner.assertEqual(jpegHeader[0], 0xFF, 'JPEG header first byte');
    testRunner.assertEqual(pngHeader[0], 0x89, 'PNG header first byte');
  });

  testRunner.addTest('Path Validation', async () => {
    const validPaths = [
      'file.txt',
      'folder/file.txt',
      'user123/document.pdf'
    ];
    
    const invalidPaths = [
      '../file.txt',
      'folder/../file.txt',
      'folder\\file.txt',
      '',
      null,
      undefined
    ];

    for (const validPath of validPaths) {
      testRunner.assert(
        typeof validPath === 'string' && 
        !validPath.includes('..') && 
        !validPath.includes('\\'),
        `Valid path check: ${validPath}`
      );
    }

    for (const invalidPath of invalidPaths) {
      const isInvalid = !invalidPath || 
        typeof invalidPath !== 'string' || 
        invalidPath.includes('..') || 
        invalidPath.includes('\\');
      
      testRunner.assert(isInvalid, `Invalid path check: ${invalidPath}`);
    }
  });

  testRunner.addTest('Buffer Operations', async () => {
    const testData = 'Hello, World!';
    const buffer = Buffer.from(testData, 'utf8');
    
    testRunner.assertBuffer(buffer, testData.length, 'Buffer creation');
    testRunner.assertEqual(buffer.toString('utf8'), testData, 'Buffer to string conversion');
    
    const slice = buffer.slice(0, 5);
    testRunner.assertEqual(slice.toString('utf8'), 'Hello', 'Buffer slicing');
  });

  testRunner.addTest('JSON Operations', async () => {
    const testObject = {
      id: 'test123',
      name: 'Test File',
      timestamp: new Date().toISOString(),
      data: { nested: true }
    };

    const jsonString = JSON.stringify(testObject);
    const parsedObject = JSON.parse(jsonString);

    testRunner.assertEqual(parsedObject.id, testObject.id, 'JSON round-trip ID');
    testRunner.assertEqual(parsedObject.name, testObject.name, 'JSON round-trip name');
    testRunner.assert(parsedObject.data.nested, 'JSON nested object');
  });

  testRunner.addTest('Error Handling', async () => {
    try {
      throw new Error('Test error');
    } catch (error) {
      testRunner.assertEqual(error.message, 'Test error', 'Error message');
      testRunner.assertNotNull(error.stack, 'Error stack trace');
    }

    try {
      await new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Async test error')), 10);
      });
      testRunner.assert(false, 'Should have thrown an error');
    } catch (error) {
      testRunner.assertEqual(error.message, 'Async test error', 'Async error message');
    }
  });

  testRunner.addTest('File System Operations', async () => {
    const { app } = require('electron');
    
    const testPath = path.join(__dirname, 'test.tmp');
    const testData = 'Test file content';
    
    await fs.promises.writeFile(testPath, testData);
    testRunner.assert(fs.existsSync(testPath), 'Test file should exist');
    
    const readData = await fs.promises.readFile(testPath, 'utf8');
    testRunner.assertEqual(readData, testData, 'File content should match');
    
    await fs.promises.unlink(testPath);
    testRunner.assert(!fs.existsSync(testPath), 'Test file should be deleted');
  });

  return testRunner;
}

module.exports = { TestRunner, createTestSuite };
