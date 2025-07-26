# 🚀 Seamless Encryptor Setup Guide

This guide will walk you through setting up Seamless Encryptor with full Google Drive integration.

## 📋 Prerequisites

- **Node.js**: v16 or higher ([Download](https://nodejs.org/))
- **Platform**: Windows 10+ or macOS 10.14+
- **Google Account**: For cloud vault functionality
- **Git**: For cloning the repository

## 🔧 Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/your-repo/seamless-encryptor.git
cd seamless-encryptor
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Google Drive API (REQUIRED for Cloud Features)

#### Step 3.1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select an existing project
3. Name your project (e.g., "Seamless Encryptor")
4. Click "Create"

#### Step 3.2: Enable Google Drive API
1. In the Google Cloud Console, go to **APIs & Services > Library**
2. Search for "Google Drive API"
3. Click on "Google Drive API" and click "Enable"

#### Step 3.3: Create OAuth 2.0 Credentials
1. Go to **APIs & Services > Credentials**
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in app name: "Seamless Encryptor"
   - Add your email as developer contact
   - Skip optional fields and save
4. Choose "Desktop application" as application type
5. Name it "Seamless Encryptor Desktop"
6. Click "Create"
7. **IMPORTANT**: Copy the Client ID and Client Secret

#### Step 3.4: Configure Environment Variables
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your credentials:
   ```env
   GOOGLE_CLIENT_ID=your_actual_client_id_here
   GOOGLE_CLIENT_SECRET=your_actual_client_secret_here
   GOOGLE_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
   ```

### 4. Test Installation
```bash
# Start the application
npm start

# Or for development with auto-reload
npm run dev
```

## 🔐 First-Time Setup

### 1. Generate Encryption Key
1. Launch the application
2. Click "Generate New Key" on the main screen
3. Choose your preferred encryption method (AES-256-GCM recommended)
4. The key will be securely stored in your system keychain

### 2. Connect Google Drive
1. Navigate to the Cloud Storage page
2. Click "Connect Drive"
3. Complete OAuth authorization in your browser
4. Enter the authorization code when prompted
5. Your Google Drive is now connected!

### 3. Test Encryption
1. Select a test file to encrypt
2. Choose encryption method
3. The encrypted file (.etcr) will be created
4. Test decryption to verify everything works

## 🗂️ Understanding the Vault Structure

When you upload encrypted files, they're organized as:
```
Google Drive/
└── EncryptedVault/
    └── {your-user-uuid}/
        ├── 2024-01-27/           # Daily folders
        │   ├── document.pdf.etcr
        │   ├── photo.jpg.etcr
        │   └── manifest.json     # Filename mappings
        └── keys/
            └── dek.key.enc       # Optional key backup
```

## 🔧 Troubleshooting

### Google Drive Connection Issues

**Error: "invalid_client"**
- Verify your Client ID and Client Secret in `.env`
- Ensure Google Drive API is enabled
- Check that OAuth consent screen is configured

**Error: "Access blocked"**
- Make sure the OAuth consent screen is published
- Add your email as a test user if using external user type
- Verify redirect URI is exactly: `urn:ietf:wg:oauth:2.0:oob`

### Encryption Issues

**Error: "No encryption key found"**
- Generate a new key in the Key Management section
- Check system keychain permissions

**Error: "Failed to encrypt file"**
- Ensure file is not corrupted
- Check file permissions
- Try with a smaller test file first

### Performance Issues

**Slow encryption/decryption**
- Use AES-256-GCM for best performance on modern hardware
- Avoid encrypting very large files (>100MB) on low-end devices
- Close other resource-intensive applications

## 🔒 Security Best Practices

1. **Key Management**
   - Never share your encryption keys
   - Use strong passwords for optional cloud key backups
   - Regularly export and backup your keys

2. **File Handling**
   - Always verify decrypted files before deleting originals
   - Use secure deletion for sensitive original files
   - Monitor vault organization regularly

3. **Cloud Security**
   - Use 2FA on your Google account
   - Regularly review Google account activity
   - Limit application permissions if needed

## 📱 Platform-Specific Notes

### Windows
- Encryption keys stored in Windows Credential Manager
- May require administrator rights for first-time setup
- Windows Defender might scan encrypted files (safe to allow)

### macOS
- Encryption keys stored in macOS Keychain
- May prompt for keychain access on first use
- Touch ID integration available for key access

## 🎯 Next Steps

1. **Explore Features**: Try different encryption methods
2. **Organize Files**: Use the vault structure effectively
3. **Backup Strategy**: Set up regular key exports
4. **Advanced Usage**: Explore keyboard shortcuts and batch operations

## 🆘 Getting Help

If you encounter issues:
1. Check the troubleshooting section above
2. Review application logs in the developer console
3. Create an issue on GitHub with detailed error information
4. Include your operating system and Node.js version

---

**🎉 Congratulations!** Your Seamless Encryptor is now ready for secure file encryption and cloud storage. 