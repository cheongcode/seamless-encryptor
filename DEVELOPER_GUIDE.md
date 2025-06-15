# 🛠️ Developer Guide - Seamless Encryptor Pro

This guide provides a comprehensive overview of the codebase structure, file purposes, and architectural decisions to help team members navigate and contribute effectively.

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Core Files Breakdown](#core-files-breakdown)
- [Main Process Files](#main-process-files)
- [Renderer Process Files](#renderer-process-files)
- [Preload Scripts](#preload-scripts)
- [Cryptographic Modules](#cryptographic-modules)
- [Configuration Files](#configuration-files)
- [Build & Development Files](#build--development-files)
- [Data Flow](#data-flow)
- [Common Development Tasks](#common-development-tasks)
- [Debugging Guide](#debugging-guide)

## 🏗️ Architecture Overview

Seamless Encryptor Pro follows Electron's multi-process architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON APPLICATION                     │
├─────────────────────────────────────────────────────────────┤
│  Main Process (Node.js)          │  Renderer Process (Web)  │
│  ├── File System Operations      │  ├── User Interface      │
│  ├── Encryption/Decryption       │  ├── User Interactions   │
│  ├── Google Drive API            │  ├── Progress Display    │
│  ├── Key Management              │  └── File Queue UI       │
│  └── IPC Handlers                │                           │
├─────────────────────────────────────────────────────────────┤
│              Preload Scripts (Bridge)                       │
│              ├── Secure IPC Communication                   │
│              ├── API Exposure                               │
│              └── Context Isolation                          │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Directory Structure

```
seamless-encryptor/
├── 📁 src/                          # Source code
│   ├── 📁 main/                     # Main process (Node.js backend)
│   ├── 📁 renderer/                 # Renderer process (UI frontend)
│   ├── 📁 preload/                  # Preload scripts (IPC bridge)
│   ├── 📁 crypto/                   # Cryptographic modules
│   └── 📁 config/                   # Configuration utilities
├── 📁 .webpack/                     # Webpack build outputs
├── 📁 node_modules/                 # Dependencies
├── 📄 package.json                  # Project configuration
├── 📄 forge.config.js               # Electron Forge config
├── 📄 webpack.*.config.js           # Webpack configurations
└── 📄 Documentation files           # README, CHANGELOG, etc.
```

## 🔍 Core Files Breakdown

### 🎯 **Entry Points**
| File | Purpose | When to Modify |
|------|---------|----------------|
| `src/main/main.js` | Application entry point, main process | Adding new IPC handlers, core functionality |
| `src/renderer/index.html` | Main UI entry point | Major UI changes, new sections |
| `src/preload/preload.js` | IPC bridge between main and renderer | Adding new API methods |

### 📊 **File Responsibility Matrix**

| Feature | Main Process | Renderer Process | Preload |
|---------|-------------|------------------|---------|
| File Encryption | `main.js` (lines 450-600) | `index.html` (encrypt section) | `preload.js` (encryptFile API) |
| Google Drive | `main.js` (lines 2200-2500) | `index.html` (cloud section) | `preload.js` (cloudApi) |
| Key Management | `main.js` (lines 1650-1850) | `index.html` (keys section) | `preload.js` (key APIs) |
| File Analysis | `main.js` (lines 1360-1500) | `index.html` (analysis modal) | `preload.js` (analyzeFileEntropy) |
| Settings | `main.js` (lines 2050-2200) | `index.html` (settings section) | `preload.js` (settingsApi) |

## 🖥️ Main Process Files

### 📄 `src/main/main.js` (2,600+ lines)
**Purpose**: Core application logic, file operations, encryption, and IPC handlers

#### **Key Sections**:
```javascript
// Lines 1-100: Imports and initialization
// Lines 100-250: Helper functions and utilities
// Lines 250-400: Window creation and app lifecycle
// Lines 400-800: File encryption/decryption handlers
// Lines 800-1200: File management (download, delete, list)
// Lines 1200-1600: Entropy analysis and crypto utilities
// Lines 1600-1900: Key management handlers
// Lines 1900-2100: Settings management
// Lines 2100-2600: Google Drive integration
```

#### **Critical Functions**:
| Function | Lines | Purpose |
|----------|-------|---------|
| `createWindow()` | 235-350 | Creates main application window |
| `encrypt-file handler` | 450-600 | Handles file encryption requests |
| `decrypt-file handler` | 700-900 | Handles file decryption requests |
| `analyze-file-entropy handler` | 1360-1500 | Performs cryptographic analysis |
| `gdrive-connect handler` | 2280-2340 | Google Drive OAuth flow |

#### **When to Modify**:
- Adding new encryption algorithms
- Implementing new cloud providers
- Adding new IPC handlers
- Modifying file storage logic

## 🎨 Renderer Process Files

### 📄 `src/renderer/index.html` (1,800+ lines)
**Purpose**: Main user interface with embedded JavaScript

#### **Key Sections**:
```html
<!-- Lines 1-200: HTML structure and layout -->
<!-- Lines 200-400: Dashboard and navigation -->
<!-- Lines 400-600: File encryption interface -->
<!-- Lines 600-800: Encrypted files management -->
<!-- Lines 800-1000: Google Drive integration -->
<!-- Lines 1000-1200: Key management interface -->
<!-- Lines 1200-1400: Settings interface -->
<!-- Lines 1400-1800: JavaScript functionality -->
```

#### **JavaScript Functions**:
| Function | Lines | Purpose |
|----------|-------|---------|
| `initializeApp()` | 460-500 | App initialization and setup |
| `openFileDialog()` | 720-760 | File selection handling |
| `encryptAllFiles()` | 880-950 | Batch encryption processing |
| `connectGoogleDrive()` | 1170-1220 | Google Drive connection flow |
| `generateEncryptionKey()` | 1064-1090 | Key generation interface |
| `createCustomKey()` | 1090-1170 | Custom key creation modal |

#### **UI Sections**:
| Section | Lines | Purpose |
|---------|-------|---------|
| Dashboard | 200-300 | Statistics and overview |
| Encrypt Files | 300-500 | File upload and encryption |
| Encrypted Files | 500-700 | File management and decryption |
| Google Drive | 700-900 | Cloud integration |
| Key Management | 900-1100 | Key operations |
| Settings | 1100-1300 | Application preferences |

### 📄 `src/renderer/renderer.js` (600+ lines)
**Purpose**: Alternative renderer entry point (webpack-based)

#### **When to Use**:
- When working with webpack-compiled renderer
- For modular JavaScript development
- Testing renderer functionality independently

## 🌉 Preload Scripts

### 📄 `src/preload/preload.js` (240 lines)
**Purpose**: Secure bridge between main and renderer processes

#### **API Sections**:
```javascript
// Lines 1-30: Setup and utilities
// Lines 30-120: Main API (file operations, encryption)
// Lines 120-180: Settings API
// Lines 180-220: Cloud API (Google Drive)
// Lines 220-240: Event listeners and cleanup
```

#### **Exposed APIs**:
| API Group | Methods | Purpose |
|-----------|---------|---------|
| `window.api` | encryptFile, decryptFile, openFileDialog, etc. | Core file operations |
| `window.settingsApi` | getAppSettings, setAppSettings, etc. | Settings management |
| `window.cloudApi` | connectGDrive, listGDriveFiles, etc. | Cloud integration |

#### **When to Modify**:
- Adding new IPC methods
- Exposing new APIs to renderer
- Modifying security context

## 🔐 Cryptographic Modules

### 📄 `src/crypto/encryptionMethods.js` (400+ lines)
**Purpose**: Encryption algorithm implementations

#### **Key Functions**:
| Function | Purpose | Algorithms |
|----------|---------|------------|
| `encrypt()` | Main encryption function | AES-256-GCM, ChaCha20-Poly1305 |
| `decrypt()` | Main decryption function | All supported algorithms |
| `generateIV()` | IV generation | Cryptographically secure |
| `deriveKey()` | Key derivation | PBKDF2 implementation |

### 📄 `src/crypto/entropyAnalyzer.js` (300+ lines)
**Purpose**: Cryptographic quality analysis

#### **Key Functions**:
| Function | Purpose | Output |
|----------|---------|--------|
| `analyzeEntropy()` | Shannon entropy calculation | Entropy score (0-8) |
| `generateHistogram()` | Byte distribution analysis | 256-element array |
| `assessQuality()` | Security rating | Poor/Good/Excellent |

### 📄 `src/crypto/encryption.js` (200+ lines)
**Purpose**: Low-level encryption utilities

#### **When to Modify**:
- Adding new encryption algorithms
- Modifying key derivation parameters
- Implementing new analysis methods

## ⚙️ Configuration Files

### 📄 `src/config/keyManager.js` (300+ lines)
**Purpose**: Secure key storage and management

#### **Key Functions**:
| Function | Purpose | Storage |
|----------|---------|---------|
| `generateMasterKey()` | Create new master key | OS keychain |
| `getMasterKey()` | Retrieve stored key | Encrypted storage |
| `exportKeys()` | Backup key data | Encrypted file |
| `importKeys()` | Restore key data | Encrypted file |

#### **When to Modify**:
- Changing key storage mechanisms
- Adding new key types
- Modifying security parameters

## 🔧 Build & Development Files

### 📄 `forge.config.js` (60 lines)
**Purpose**: Electron Forge build configuration

#### **Key Sections**:
```javascript
// Lines 1-20: Basic configuration
// Lines 20-40: Webpack plugin setup
// Lines 40-60: Platform-specific makers
```

### 📄 `webpack.*.config.js` Files
| File | Purpose | Target |
|------|---------|--------|
| `webpack.main.config.js` | Main process bundling | Node.js backend |
| `webpack.renderer.config.js` | Renderer process bundling | Web frontend |
| `webpack.preload.config.js` | Preload script bundling | Bridge scripts |

### 📄 `package.json` (80 lines)
**Purpose**: Project configuration and dependencies

#### **Key Scripts**:
| Script | Command | Purpose |
|--------|---------|---------|
| `start` | `electron-forge start` | Development mode |
| `make` | `electron-forge make` | Build distributables |
| `lint` | `eslint src/` | Code quality check |

## 🔄 Data Flow

### **File Encryption Flow**:
```
1. User selects files (renderer/index.html)
   ↓
2. File dialog opens (preload/preload.js → main/main.js)
   ↓
3. Files added to queue (renderer/index.html)
   ↓
4. Encryption triggered (renderer → preload → main)
   ↓
5. File read and encrypted (main/main.js + crypto/)
   ↓
6. Encrypted file saved (main/main.js)
   ↓
7. UI updated with results (main → preload → renderer)
```

### **Google Drive Integration Flow**:
```
1. User clicks connect (renderer/index.html)
   ↓
2. OAuth URL generated (main/main.js)
   ↓
3. Browser opens for auth (shell.openExternal)
   ↓
4. User enters auth code (renderer modal)
   ↓
5. Token exchange (main/main.js + Google APIs)
   ↓
6. Connection status updated (main → renderer)
```

## 🛠️ Common Development Tasks

### **Adding a New Encryption Algorithm**:
1. **Add algorithm to** `src/crypto/encryptionMethods.js`
2. **Update algorithm list in** `src/main/main.js`
3. **Add UI option in** `src/renderer/index.html`
4. **Test with various file types**

### **Adding a New IPC Handler**:
1. **Add handler in** `src/main/main.js`:
   ```javascript
   ipcMain.handle('your-new-handler', async (event, ...args) => {
     // Implementation
   });
   ```
2. **Expose in** `src/preload/preload.js`:
   ```javascript
   yourNewMethod: (...args) => safeInvoke('your-new-handler', ...args)
   ```
3. **Use in** `src/renderer/index.html`:
   ```javascript
   const result = await window.api.yourNewMethod(...args);
   ```

### **Adding a New UI Section**:
1. **Add HTML structure** in `src/renderer/index.html`
2. **Add navigation item** in sidebar
3. **Implement JavaScript functions** for interactions
4. **Add corresponding IPC handlers** if needed

### **Modifying File Storage**:
1. **Update storage logic** in `src/main/main.js`
2. **Modify file format** in encryption functions
3. **Update analysis functions** in `src/crypto/`
4. **Test backward compatibility**

## 🐛 Debugging Guide

### **Debug Modes**:
```bash
# Enable all debug output
DEBUG=* npm start

# Enable specific debug categories
DEBUG=main,crypto npm start

# Enable Electron debug
npm start --inspect
```

### **Common Debug Locations**:
| Issue Type | Check Files | Look For |
|------------|-------------|----------|
| IPC Communication | `preload.js`, `main.js` | Console logs, error messages |
| File Operations | `main.js` (lines 400-1200) | File system errors, paths |
| Encryption Issues | `crypto/` modules | Algorithm errors, key issues |
| UI Problems | `renderer/index.html` | JavaScript errors, DOM issues |
| Build Issues | `webpack.*.config.js`, `forge.config.js` | Configuration errors |

### **Debug Console Commands**:
```javascript
// In renderer console
window.api.testIpc() // Test IPC communication
window.api.checkKeyStatus() // Check key status
window.cloudApi.getGDriveStatus() // Check Google Drive

// In main process console (via --inspect)
console.log(encryptionKey) // Check key state
console.log(store.get('gdriveTokens')) // Check stored tokens
```

### **Log File Locations**:
- **Application logs**: `~/Library/Logs/seamless-encryptor/` (macOS)
- **Crash reports**: `~/Library/Application Support/seamless-encryptor/`
- **Encrypted files**: `~/Library/Application Support/seamless-encryptor/encrypted/`

## 📚 Quick Reference

### **File Modification Frequency**:
| File | Frequency | Typical Changes |
|------|-----------|----------------|
| `src/main/main.js` | High | New features, IPC handlers |
| `src/renderer/index.html` | High | UI improvements, new sections |
| `src/preload/preload.js` | Medium | New API methods |
| `src/crypto/*.js` | Low | New algorithms, security updates |
| `src/config/*.js` | Low | Configuration changes |

### **Testing Checklist**:
- [ ] File encryption/decryption works
- [ ] Google Drive connection functions
- [ ] Key generation and management
- [ ] UI responsiveness across sections
- [ ] Cross-platform compatibility
- [ ] Error handling and recovery

### **Performance Considerations**:
- **Large files**: Use streaming for files >100MB
- **Memory usage**: Clear sensitive data after use
- **UI responsiveness**: Use async operations
- **Startup time**: Lazy load non-critical modules

---

## 🎯 Team Workflow

### **Before Making Changes**:
1. **Read this guide** and understand the architecture
2. **Check existing issues** and discussions
3. **Test current functionality** to understand baseline
4. **Plan your changes** and discuss with team

### **During Development**:
1. **Follow coding standards** in CONTRIBUTING.md
2. **Add appropriate logging** for debugging
3. **Test incrementally** as you develop
4. **Document complex logic** with comments

### **Before Committing**:
1. **Test all affected functionality**
2. **Run linting**: `npm run lint`
3. **Update documentation** if needed
4. **Follow commit message conventions**

This guide should help you navigate the codebase efficiently and understand how all the pieces fit together! 🚀 