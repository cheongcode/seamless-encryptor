# �� Seamless Encryptor - Cross-Platform Encrypted File Storage System

A secure, cross-platform file encryption and cloud storage system compatible with both Windows and macOS, leveraging native keychains, strong cryptography, and cloud APIs.

![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Encryption](https://img.shields.io/badge/encryption-AES%20256%20%7C%20ChaCha20-red)

## 🌟 Key Features

### ✅ Cross-Platform Key Storage (KEK/DEK Architecture)
- **Windows**: Stores Key Encryption Key (KEK) using `keytar` in Windows Credential Manager
- **macOS**: Stores KEK using `keytar` in macOS Keychain (with Secure Enclave support)
- **Advanced Architecture**: Master KEK encrypts individual Data Encryption Keys (DEKs)
- **Memory Security**: Local DEK caching is memory-only for enhanced security

### ✅ Password-Protected DEK Cloud Backup
- **User-Controlled Security**: Password supplied by user, never stored on disk or cloud
- **Strong Key Derivation**: PBKDF2 with 100,000 iterations using SHA-256
- **AES-256-GCM Encryption**: DEK encrypted before cloud upload as `.key.enc` files
- **Recovery Capability**: Only user with password can decrypt and recover DEK

### ✅ Advanced File Encryption with Standardized Headers
- **Primary Algorithm**: AES-256-GCM (Galois/Counter Mode with built-in authentication)
- **Additional Support**: ChaCha20-Poly1305, XChaCha20-Poly1305, AES-256-CBC
- **Custom File Format**:
  ```
  ┌─────────────────┬─────────────┬──────────────┬─────────────┬──────────────┬─────────────┬────────┬──────────┬─────────────┐
  │ Magic Bytes     │ Version     │ Algorithm ID │ IV Length   │ Tag Length   │ DEK Hash    │ IV     │ Auth Tag │ Ciphertext  │
  │ "ETCR" (4)      │ (1 byte)    │ (1 byte)     │ (1 byte)    │ (1 byte)     │ SHA-256 (32)│ (var)  │ (var)    │ (remaining) │
  └─────────────────┴─────────────┴──────────────┴─────────────┴──────────────┴─────────────┴────────┴──────────┴─────────────┘
  ```
- **File Extension**: All encrypted files use `.etcr` extension
- **Integrity Verification**: DEK hash (SHA-256) included in headers for validation

### ✅ Google Drive Vault with Organized Structure
Creates and manages hierarchical encrypted vault on Google Drive:
```
/EncryptedVault/
  └── /{user-uuid}/
      ├── /YYYY-MM-DD/           # Date-based organization
      │   ├── file1.jpg.etcr
      │   ├── document.pdf.etcr
      │   └── manifest.json      # Filename mappings & metadata
      └── /keys/
          └── {dek-hash}.key.enc # Password-protected DEK backups
```

**Manifest System Features**:
- **Original → Encrypted Filename Mapping**
- **DEK Hash Tracking**
- **Upload Timestamps**
- **File Metadata Storage**
- **Automatic Updates**

### ✅ Multi-Algorithm Encryption Support

#### AES-256-GCM (Default)
- **Key Size**: 256 bits
- **Mode**: Galois/Counter Mode
- **Authentication**: Built-in AEAD
- **Performance**: Excellent on modern hardware with AES-NI

#### ChaCha20-Poly1305
- **Key Size**: 256 bits
- **Type**: Stream cipher with authentication
- **Resistance**: Quantum-resistant design
- **Performance**: Excellent on all platforms

#### XChaCha20-Poly1305
- **Key Size**: 256 bits
- **Nonce Size**: Extended (192 bits)
- **Benefits**: Larger nonce space, enhanced security
- **Use Case**: High-volume encryption scenarios

## 🔧 Installation & Setup

### Prerequisites
- **Node.js**: v16 or higher
- **Platform**: Windows 10+ or macOS 10.14+
- **Google Account**: For cloud vault functionality

### Quick Start
```bash
# Clone the repository
git clone https://github.com/your-repo/seamless-encryptor.git
cd seamless-encryptor

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Google Drive API credentials

# Start development
npm run dev

# Build for production
npm run build
```

### Google Drive API Setup
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API
4. Create OAuth 2.0 credentials
5. Add credentials to `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
   ```

## 🛡️ Security Architecture

### Key Management Hierarchy
```
┌─────────────────────────────────────────────────────────────┐
│                    USER PASSWORD                             │
│                         │                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │  OS Keychain/Store  │ ◄── KEK (Master Key)   │
│              └─────────────────────┘                        │
│                         │                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │   Encrypted DEKs    │ ◄── Per-file keys      │
│              └─────────────────────┘                        │
│                         │                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │  Encrypted Files    │ ◄── Your data          │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Cloud Security Model
- **Zero-Knowledge**: Cloud provider cannot access your data
- **Password Independence**: Cloud DEK backups require separate user password
- **Key Rotation**: Support for DEK rotation without changing master password
- **Multi-Device**: Secure DEK distribution to trusted devices (future)

## 🚀 Usage Guide

### Basic File Encryption
```javascript
// Encrypt a file
const result = await window.api.encryptFile('/path/to/file.txt', 'aes-256-gcm');

// Upload to secure vault with DEK backup
await window.api.uploadToVault({
  fileId: result.fileId,
  fileName: 'file.txt',
  password: 'your-backup-password' // Optional DEK backup
});
```

### DEK Backup & Recovery
```javascript
// Create password-protected DEK backup
await window.api.createDEKBackup({ password: 'secure-password' });

// Restore DEK from cloud backup
await window.api.restoreDEKBackup({ 
  password: 'secure-password',
  dekHash: 'hash-of-dek'
});
```

### Vault Information
```javascript
// Get vault structure info
const vaultInfo = await window.api.getVaultInfo();
console.log(`Vault path: ${vaultInfo.vaultPath}`);
console.log(`User UUID: ${vaultInfo.userUUID}`);
```

## 📁 Project Structure

```
seamless-encryptor/
├── src/
│   ├── main/
│   │   └── main.js              # Main process with IPC handlers
│   ├── renderer/
│   │   ├── index.html           # Main UI
│   │   ├── cloud.html           # Cloud management UI
│   │   ├── settings.html        # Application settings
│   │   └── js/
│   │       ├── cloud.js         # Cloud integration
│   │       └── crypto/          # Crypto utilities
│   ├── config/
│   │   └── keyManager.js        # Key management system
│   └── crypto/
│       ├── encryption.js        # Core encryption
│       ├── encryptionMethods.js # Algorithm implementations
│       └── cryptoUtil.js        # Crypto utilities
├── .env                         # Environment variables
└── package.json                 # Dependencies & scripts
```

## 🎯 Advanced Features

### Optional & Future Enhancements
- **Key Rotation**: Rotate DEKs without changing KEK/password
- **MFA Integration**: 
  - macOS: Touch ID biometric unlocking
  - Windows: Windows Hello integration
- **Integrity Verification**: GCM tags + separate HMACs
- **Multi-Device Sync**: Secure DEK distribution to trusted devices
- **Encrypted Sharing**: Re-wrap DEKs with different keys for sharing
- **Audit Logging**: Comprehensive security event logging

### Quantum Resistance Preparation
- ChaCha20 algorithms provide quantum-resistant alternatives
- Future: Post-quantum cryptography integration
- Forward secrecy through key rotation capabilities

## 🔍 API Reference

### Main Process APIs
```javascript
// File Operations
ipcMain.handle('encrypt-file', (event, filePath, method) => {})
ipcMain.handle('decrypt-file', (event, params) => {})

// Cloud Vault Operations  
ipcMain.handle('upload-to-gdrive', (event, {fileId, fileName, password}) => {})
ipcMain.handle('get-vault-info', (event) => {})

// DEK Management
ipcMain.handle('create-dek-backup', (event, {password}) => {})
ipcMain.handle('restore-dek-backup', (event, {password, dekHash}) => {})

// Google Drive Integration
ipcMain.handle('gdrive-connect', (event) => {})
ipcMain.handle('gdrive-list-files', (event, {parentFolderId, pageToken}) => {})
```

### Key Manager APIs
```javascript
// Core Key Operations
keyManager.getMasterKey()                    // Get KEK from OS keychain
keyManager.deriveKeyFromPassword(password)   // PBKDF2 key derivation
keyManager.saveKeyForFile(fileId, key)       // Store DEK for file
keyManager.getKeyForFile(fileId)             // Retrieve DEK for file

// DEK Backup Operations
keyManager.createPasswordProtectedDEKBackup(password, dek)  // Create backup
keyManager.decryptPasswordProtectedDEKBackup(password, data) // Restore backup
keyManager.getCurrentDEK()                   // Get current DEK
```

## 🔒 Security Considerations

### Threat Model Protection
- **Local Attacks**: OS keychain protection, memory-only key storage
- **Cloud Attacks**: Zero-knowledge encryption, separate password protection
- **Network Attacks**: TLS transport, authenticated encryption
- **Physical Access**: Platform-specific hardware security (TPM, Secure Enclave)

### Best Practices
1. **Strong Passwords**: Use unique, complex passwords for DEK backups
2. **Regular Backups**: Create DEK backups before key rotation
3. **Secure Recovery**: Store backup passwords securely (password manager)
4. **Key Rotation**: Rotate DEKs periodically for forward secrecy
5. **Audit Reviews**: Monitor vault access and file operations

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## 📚 Documentation

- **Developer Guide**: [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
- **User Manual**: [USER_MANUAL.md](USER_MANUAL.md)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

---

**🔐 Your files. Your keys. Your security.** 