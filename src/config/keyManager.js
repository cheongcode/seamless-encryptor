const crypto = require('crypto');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

let logger;
try {
  logger = require('../utils/logger');
} catch (e) {
  logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    trace: () => {},
    wrapFunction: (context, fn) => fn
  };
}

function getKeyStoragePath() {
  if (!app) {
    logger.warn('KeyManager', 'App not available, cannot get storage path');
    return '';
  }
  const storagePath = path.join(app.getPath('userData'), 'keys');
  logger.trace('KeyManager', 'Key storage path', { storagePath });
  return storagePath;
}

function ensureKeyStorageExists() {
  const storagePath = getKeyStoragePath();
  if (!storagePath) {
    logger.warn('KeyManager', 'No storage path available');
    return;
  }
  
  if (!fs.existsSync(storagePath)) {
    logger.info('KeyManager', 'Creating key storage directory', { storagePath });
    fs.mkdirSync(storagePath, { recursive: true });
  } else {
    logger.trace('KeyManager', 'Key storage directory exists', { storagePath });
  }
}

const generateMasterKey = logger.wrapFunction('KeyManager', () => {
  logger.info('KeyManager', 'Generating new master key');
  const key = crypto.randomBytes(32);
  logger.debug('KeyManager', 'Master key generated', { keyLength: key.length });
  return key;
}, 'generateMasterKey');

let masterKey = null;

const getMasterKey = logger.wrapFunction('KeyManager', async () => {
  if (masterKey) {
    logger.trace('KeyManager', 'Returning cached master key');
    return masterKey;
  }
  
  logger.debug('KeyManager', 'Loading or creating master key');
  
  ensureKeyStorageExists();
  const keyPath = path.join(getKeyStoragePath(), 'master.key');
  
  if (fs.existsSync(keyPath)) {
    logger.info('KeyManager', 'Loading existing master key', { keyPath });
    masterKey = await fs.promises.readFile(keyPath);
    
    if (!Buffer.isBuffer(masterKey) || masterKey.length !== 32) {
      logger.error('KeyManager', 'Invalid master key loaded from disk', {
        keyType: typeof masterKey,
        keyLength: masterKey?.length || 0
      });
      throw new Error('Invalid master key found on disk');
    }
    
    logger.info('KeyManager', 'Master key loaded successfully');
  } else {
    logger.info('KeyManager', 'No existing key found, generating new one');
    masterKey = generateMasterKey();
    await fs.promises.writeFile(keyPath, masterKey);
    logger.info('KeyManager', 'New master key saved to disk');
  }
  
  return masterKey;
}, 'getMasterKey');

const setMasterKey = logger.wrapFunction('KeyManager', async (keyBuffer) => {
  logger.info('KeyManager', 'Setting new master key');
  
  if (!Buffer.isBuffer(keyBuffer)) {
    logger.error('KeyManager', 'Master key must be a Buffer', { 
      keyType: typeof keyBuffer 
    });
    throw new Error('Master key must be a Buffer');
  }
  
  if (keyBuffer.length !== 32) {
    logger.error('KeyManager', 'Master key must be 32 bytes', { 
      keyLength: keyBuffer.length 
    });
    throw new Error('Master key must be a 32-byte Buffer');
  }
  
  ensureKeyStorageExists();
  const keyPath = path.join(getKeyStoragePath(), 'master.key');
  
  if (fs.existsSync(keyPath)) {
    const backupPath = `${keyPath}.backup.${Date.now()}`;
    logger.info('KeyManager', 'Backing up existing key', { backupPath });
    await fs.promises.copyFile(keyPath, backupPath);
  }
  
  await fs.promises.writeFile(keyPath, keyBuffer);
  masterKey = keyBuffer;
  
  logger.info('KeyManager', 'Master key set successfully');
  return true;
}, 'setMasterKey');

module.exports = {
  generateMasterKey,
  getMasterKey,
  setMasterKey
}; 