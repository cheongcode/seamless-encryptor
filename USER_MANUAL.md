# 📖 Seamless Encryptor User Manual

**Version 1.0.0** | **Cross-Platform Secure File Encryption**

---

## 📚 Table of Contents

1. [Getting Started](#getting-started)
2. [Core Features](#core-features)
3. [File Encryption](#file-encryption)
4. [Google Drive Integration](#google-drive-integration)
5. [Key Management](#key-management)
6. [Security Features](#security-features)
7. [Advanced Usage](#advanced-usage)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## 🚀 Getting Started

### What is Seamless Encryptor?

Seamless Encryptor is a professional-grade, cross-platform file encryption application that provides:
- **Military-grade encryption** with AES-256-GCM, ChaCha20-Poly1305, and XChaCha20-Poly1305
- **Google Drive integration** with encrypted cloud vault
- **Cross-platform key management** using Windows Credential Manager and macOS Keychain
- **Password-protected key backup** for cloud recovery
- **Professional Google Drive-like interface** for seamless file management

### First Launch

When you first launch Seamless Encryptor:

1. **Key Generation**: You'll be prompted to generate your master encryption key
2. **Method Selection**: Choose your preferred encryption algorithm
3. **Secure Storage**: The key will be stored in your system's secure keychain
4. **Ready to Use**: Start encrypting files immediately

---

## 🔧 Core Features

### 🔒 Encryption Methods

#### AES-256-GCM (Recommended)
- **Best for**: General use, excellent performance on modern hardware
- **Security**: NIST-approved, quantum-resistant
- **Performance**: Fastest on systems with AES-NI support
- **Authentication**: Built-in authenticated encryption

#### ChaCha20-Poly1305
- **Best for**: Older hardware, mobile devices
- **Security**: Military-grade, designed by Daniel J. Bernstein
- **Performance**: Consistent across all platforms
- **Benefits**: No hardware dependencies

#### XChaCha20-Poly1305
- **Best for**: High-volume encryption scenarios
- **Security**: Extended nonce space for enhanced security
- **Performance**: Excellent for large files
- **Advanced**: 192-bit nonce for maximum security

### 🗂️ File Format

Encrypted files use the `.etcr` extension with a standardized header:

```
[ETCR Magic][Version][Algorithm][IV Length][Tag Length][DEK Hash][IV][Tag][Data]
```

**Benefits:**
- **Quick identification** of encrypted files
- **Metadata verification** before decryption
- **Algorithm detection** for proper decryption
- **Integrity verification** with DEK hash

---

## 🔐 File Encryption

### Basic Encryption Process

1. **Select Files**: Drag & drop or click to select files
2. **Choose Method**: Select encryption algorithm (AES-256-GCM recommended)
3. **Encrypt**: Files are encrypted with `.etcr` extension
4. **Secure Storage**: Original files can be securely deleted

### Encryption Workflow

```
Original File → Encryption Key → Encrypted File (.etcr)
    ↓              ↓                    ↓
document.pdf → AES-256-GCM → document.pdf.etcr
```

### Decryption Process

1. **Select Encrypted Files**: Choose `.etcr` files to decrypt
2. **Automatic Detection**: Algorithm is automatically detected
3. **Key Verification**: DEK hash is verified for integrity
4. **Decrypt**: Original files are restored

### Batch Operations

- **Multiple Files**: Select multiple files for batch encryption/decryption
- **Folder Support**: Encrypt entire folders (coming soon)
- **Progress Tracking**: Real-time progress for large operations

---

## ☁️ Google Drive Integration

### Professional Google Drive Interface

The cloud interface mirrors Google Drive with enhanced security features:

- **Grid/List Views**: Toggle between card and table layouts
- **Real-time Search**: Find files instantly
- **Breadcrumb Navigation**: Easy folder navigation
- **Context Menus**: Right-click for file operations
- **Drag & Drop**: Upload files with automatic encryption

### Encrypted Vault Structure

Your files are organized in a secure, hierarchical structure:

```
Google Drive/
└── EncryptedVault/
    └── {user-uuid}/                 # Unique user identifier
        ├── 2024-01-27/             # Daily organization
        │   ├── document.pdf.etcr   # Encrypted files
        │   ├── photo.jpg.etcr
        │   └── manifest.json       # Filename mappings
        ├── 2024-01-28/
        │   └── report.docx.etcr
        └── keys/
            └── dek.key.enc         # Password-protected key backup
```

### Cloud Operations

#### Upload Process
1. **Select Files**: Choose files to upload
2. **Automatic Encryption**: Files encrypted locally before upload
3. **Vault Organization**: Files organized by date
4. **Manifest Update**: Filename mappings recorded
5. **Optional Key Backup**: Create password-protected DEK backup

#### Download Process
1. **Browse Vault**: Navigate encrypted files in Google Drive
2. **Select Files**: Choose files to download and decrypt
3. **Automatic Decryption**: Files decrypted during download
4. **Local Storage**: Decrypted files saved to Downloads

#### Seamless Operations
- **One-Click Encrypt & Upload**: Right-click → "Encrypt & Upload"
- **One-Click Decrypt & Download**: Right-click → "Decrypt & Download"
- **Batch Operations**: Select multiple files for bulk operations
- **Real-time Sync**: Changes reflected immediately

---

## 🔑 Key Management

### Master Key (DEK) System

Seamless Encryptor uses a sophisticated key management system:

```
System Keychain (KEK) → Encrypts → Master Key (DEK) → Encrypts → Your Files
      ↓                              ↓                      ↓
Windows Credential    →    Memory-stored key    →    AES-256-GCM
macOS Keychain                                       ChaCha20-Poly1305
                                                     XChaCha20-Poly1305
```

### Key Storage Locations

#### Windows
- **Primary**: Windows Credential Manager
- **Backup**: Optional encrypted backup to Google Drive
- **Access**: Windows Hello integration (if available)

#### macOS
- **Primary**: macOS Keychain
- **Backup**: Optional encrypted backup to Google Drive  
- **Access**: Touch ID integration (if available)

### Key Operations

#### Generate New Key
1. Navigate to **Key Management**
2. Click **"Generate New Key"**
3. Select encryption method
4. Key automatically stored in system keychain

#### Export Key
1. Go to **Key Management → Export**
2. Choose secure export format
3. Save to secure location
4. Use for backup or transfer

#### Import Key
1. Go to **Key Management → Import**
2. Select exported key file
3. Enter passphrase (if protected)
4. Key imported to system keychain

#### Password-Protected Cloud Backup
1. During upload, choose **"Create DEK Backup"**
2. Enter strong password (not stored anywhere)
3. Encrypted key uploaded to `/keys/` folder
4. Use for recovery on new devices

---

## 🛡️ Security Features

### Multi-Layer Security

#### 1. Encryption Layer
- **AES-256-GCM**: Military-grade encryption
- **Authenticated Encryption**: Prevents tampering
- **Unique IVs**: Every encryption uses unique initialization vector

#### 2. Key Protection Layer
- **System Keychain**: OS-level key protection
- **Memory-only Storage**: Keys never written to disk
- **Auto-clear**: Keys cleared on application exit

#### 3. Cloud Security Layer
- **Client-side Encryption**: Files encrypted before upload
- **Password-protected Backups**: Optional DEK cloud backup
- **Manifest Obfuscation**: Original filenames protected

### Security Best Practices

#### Strong Passwords
- Use complex passwords for DEK backups
- Enable 2FA on Google account
- Regularly rotate cloud passwords

#### Key Management
- Regularly export and backup keys
- Use different passwords for different backups
- Store backups in multiple secure locations

#### File Handling
- Verify decrypted files before deleting originals
- Use secure deletion for sensitive originals
- Monitor vault organization regularly

---

## ⚡ Advanced Usage

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + A` | Select all files |
| `Ctrl/Cmd + U` | Upload files |
| `Ctrl/Cmd + F` | Focus search |
| `Escape` | Clear selection |
| `Delete` | Delete selected files |

### Context Menu Actions

Right-click on files for quick actions:
- **Download**: Download file (cloud only)
- **Encrypt & Upload**: Encrypt and upload to vault
- **Decrypt & Download**: Decrypt and download to local
- **Rename**: Rename file
- **Delete**: Delete file permanently

### Power User Features

#### Bulk Operations
- Select multiple files with `Ctrl/Cmd + Click`
- Use `Shift + Click` for range selection
- Batch encrypt/decrypt multiple files simultaneously

#### Search and Filter
- **Real-time Search**: Type to filter files instantly
- **Algorithm Filter**: Filter by encryption method
- **Date Filter**: Filter by encryption date
- **Size Filter**: Filter by file size

#### Custom Organization
- **Manual Folders**: Create custom folder structure
- **Tags**: Add custom tags to files (coming soon)
- **Categories**: Organize by file type automatically

---

## 🔧 Troubleshooting

### Common Issues

#### "No encryption key found"
**Solution:**
1. Generate a new key in Key Management
2. Check system keychain permissions
3. Restart application if needed

#### Google Drive connection fails
**Solutions:**
1. Verify `.env` file contains valid Google API credentials
2. Check internet connection
3. Ensure Google Drive API is enabled in Google Cloud Console
4. Verify OAuth consent screen is configured

#### Files won't decrypt
**Solutions:**
1. Verify you have the correct encryption key
2. Check if file is corrupted
3. Ensure file has `.etcr` extension
4. Try importing key backup if available

#### Slow performance
**Solutions:**
1. Use AES-256-GCM for best performance
2. Close other resource-intensive applications
3. Encrypt smaller batches of files
4. Check available disk space

### Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `AUTH_001` | Invalid Google credentials | Check `.env` configuration |
| `KEY_001` | No encryption key | Generate or import key |
| `FILE_001` | File not found | Check file path and permissions |
| `NET_001` | Network error | Check internet connection |
| `CRYPT_001` | Encryption failed | Verify key and try again |

### Getting Help

1. **Check Logs**: Open Developer Tools → Console for detailed errors
2. **Documentation**: Review this manual and setup guide
3. **GitHub Issues**: Report bugs with detailed information
4. **Community**: Join discussions and get help from users

---

## ❓ FAQ

### General Questions

**Q: Is Seamless Encryptor free to use?**
A: Yes, Seamless Encryptor is open-source and free for personal and commercial use.

**Q: What platforms are supported?**
A: Windows 10+, macOS 10.14+. Linux support coming soon.

**Q: Can I use it without Google Drive?**
A: Yes, local encryption/decryption works without cloud features.

### Security Questions

**Q: How secure is the encryption?**
A: We use military-grade AES-256-GCM and ChaCha20-Poly1305, both approved by security agencies worldwide.

**Q: Where are my keys stored?**
A: Keys are stored in your system's secure keychain (Windows Credential Manager or macOS Keychain).

**Q: Can you access my files?**
A: No, all encryption happens locally. We never have access to your keys or decrypted files.

### Cloud Questions

**Q: Are my files secure in Google Drive?**
A: Yes, files are encrypted before upload. Google only sees encrypted `.etcr` files.

**Q: What happens if I lose my key?**
A: You can restore from a password-protected cloud backup if you created one.

**Q: Can I share encrypted files?**
A: You can share `.etcr` files, but recipients need the decryption key. Secure sharing features coming soon.

### Technical Questions

**Q: What's the maximum file size?**
A: No hard limit, but performance depends on your system. 100MB+ files may take time on older hardware.

**Q: Can I change encryption methods?**
A: Yes, you can decrypt with one method and re-encrypt with another.

**Q: Is the file format compatible with other tools?**
A: The `.etcr` format is custom but documented. We plan to release format specifications.

---

## 🎯 Quick Reference

### Essential Commands
- **New Key**: Key Management → Generate New Key
- **Encrypt File**: Drag & drop → Select method → Encrypt
- **Decrypt File**: Double-click `.etcr` file
- **Connect Google Drive**: Cloud Storage → Connect Drive
- **Upload to Vault**: Right-click file → Encrypt & Upload
- **Download from Vault**: Right-click cloud file → Decrypt & Download

### File Extensions
- `.etcr` - Encrypted file (Seamless Encryptor format)
- `.key` - Exported key file
- `.key.enc` - Password-protected key backup

### Important Paths
- **Windows Keys**: Windows Credential Manager
- **macOS Keys**: macOS Keychain
- **Local Files**: `Documents/SeamlessEncryptor_Output/`
- **Cloud Vault**: `Google Drive/EncryptedVault/{user-uuid}/`

---

**📞 Support**: For additional help, visit our [GitHub repository](https://github.com/your-repo/seamless-encryptor) or create an issue with detailed information about your problem.

**🔒 Remember**: Your security is our priority. Always keep your keys safe and use strong passwords for cloud backups.

---

*Seamless Encryptor v1.0.0 - Professional Cross-Platform File Encryption* 