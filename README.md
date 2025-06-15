# 🔐 Seamless Encryptor Pro

A professional-grade, cross-platform file encryption application built with Electron, featuring military-grade encryption, Google Drive integration, and advanced cryptographic analysis tools.

![Seamless Encryptor Pro](https://img.shields.io/badge/Encryption-AES--256--GCM-blue) ![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey) ![License](https://img.shields.io/badge/License-MIT-green) ![Version](https://img.shields.io/badge/Version-1.0.0-orange)

## ✨ Features

### 🛡️ **Advanced Encryption**
- **Military-Grade Algorithms**: AES-256-GCM, ChaCha20-Poly1305, XChaCha20-Poly1305
- **Custom Key Creation**: Generate keys from secure passphrases
- **Automatic Key Generation**: Cryptographically secure random key generation
- **Key Import/Export**: Secure key management and backup
- **Multiple Encryption Methods**: Choose the best algorithm for your needs

### 📊 **Cryptographic Analysis**
- **Entropy Analysis**: Real-time cryptographic quality assessment
- **Security Rating**: Automatic evaluation of encryption strength
- **Byte Distribution Visualization**: Histogram analysis of encrypted data
- **File Integrity Verification**: Ensure your encrypted files are secure

### ☁️ **Cloud Integration**
- **Google Drive Sync**: Automatic backup of encrypted files
- **OAuth 2.0 Authentication**: Secure Google account integration
- **Auto-Upload**: Optional automatic cloud backup
- **File Management**: Browse and manage cloud-stored encrypted files

### 🎨 **Modern User Interface**
- **Dark Theme**: Professional, eye-friendly interface
- **Responsive Design**: Optimized for all screen sizes
- **Real-time Progress**: Live encryption/decryption progress tracking
- **Drag & Drop**: Intuitive file handling
- **Toast Notifications**: Clear status updates and feedback

### 🔧 **Advanced Features**
- **Batch Processing**: Encrypt multiple files simultaneously
- **File Queue Management**: Organize and prioritize encryption tasks
- **Settings Persistence**: Customizable application preferences
- **Cross-Platform**: Windows, macOS, and Linux support
- **Secure File Deletion**: Optional secure deletion of original files

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/seamless-encryptor.git
   cd seamless-encryptor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Google Drive API credentials (optional)
   ```

4. **Start the application**
   ```bash
   npm start
   ```

### Building for Production

```bash
# Build for current platform
npm run make

# Build for all platforms
npm run make -- --platform=win32,darwin,linux
```

## ⚙️ Configuration

### Google Drive Integration Setup

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Google Drive API

2. **Create OAuth 2.0 Credentials**
   - Navigate to "Credentials" in the API & Services section
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Desktop Application"
   - Download the credentials JSON

3. **Configure Environment Variables**
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   GOOGLE_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
   ```

### Application Settings

The application supports various customizable settings:

- **Output Directory**: Choose where decrypted files are saved
- **Auto-Delete**: Automatically delete original files after encryption
- **Notifications**: Enable/disable system notifications
- **Confirm Actions**: Require confirmation for destructive operations
- **Auto-Upload**: Automatically upload encrypted files to Google Drive

## 🏗️ Technical Stack

### Core Technologies
- **[Electron](https://electronjs.org/)** - Cross-platform desktop framework
- **[Node.js](https://nodejs.org/)** - JavaScript runtime
- **[Webpack](https://webpack.js.org/)** - Module bundler
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework

### Encryption & Security
- **Node.js Crypto Module** - Native cryptographic functions
- **AES-256-GCM** - Advanced Encryption Standard with Galois/Counter Mode
- **ChaCha20-Poly1305** - Modern stream cipher with authentication
- **PBKDF2** - Password-Based Key Derivation Function
- **Secure Random Generation** - Cryptographically secure randomness

### Cloud & APIs
- **[Google APIs](https://github.com/googleapis/google-api-nodejs-client)** - Google Drive integration
- **OAuth 2.0** - Secure authentication protocol
- **[Electron Store](https://github.com/sindresorhus/electron-store)** - Persistent settings storage

### Development Tools
- **[Electron Forge](https://www.electronforge.io/)** - Build and packaging
- **[ESLint](https://eslint.org/)** - Code linting
- **[Prettier](https://prettier.io/)** - Code formatting
- **[dotenv](https://github.com/motdotla/dotenv)** - Environment variable management

## 📁 Project Structure

```
seamless-encryptor/
├── src/
│   ├── main/                 # Main process (Node.js)
│   │   └── main.js          # Application entry point
│   ├── renderer/            # Renderer process (UI)
│   │   ├── index.html       # Main application UI
│   │   ├── assets/          # Static assets
│   │   └── js/              # JavaScript modules
│   ├── preload/             # Preload scripts
│   │   └── preload.js       # IPC bridge
│   ├── config/              # Configuration modules
│   │   └── keyManager.js    # Key management utilities
│   └── crypto/              # Cryptographic modules
│       ├── encryption.js    # Encryption algorithms
│       ├── entropyAnalyzer.js # Cryptographic analysis
│       └── encryptionMethods.js # Method implementations
├── .env                     # Environment variables (create from .env.example)
├── forge.config.js          # Electron Forge configuration
├── webpack.*.config.js      # Webpack configurations
└── package.json             # Project dependencies
```

## 🔐 Security Features

### Encryption Algorithms

#### AES-256-GCM (Default)
- **Key Size**: 256 bits
- **Mode**: Galois/Counter Mode
- **Authentication**: Built-in AEAD
- **Performance**: Excellent on modern hardware

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

### Key Management
- **Secure Generation**: Cryptographically secure random number generation
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Storage**: Encrypted local storage with OS keychain integration
- **Backup**: Secure key export/import functionality

### File Format
```
Encrypted File Structure:
┌─────────────────┬──────────────┬─────────────┬──────────────┐
│ Magic Bytes     │ Algorithm ID │ IV Length   │ Tag Length   │
│ (2 bytes)       │ (1 byte)     │ (1 byte)    │ (1 byte)     │
├─────────────────┼──────────────┼─────────────┼──────────────┤
│ Reserved        │ IV           │ Auth Tag    │ Ciphertext   │
│ (1 byte)        │ (variable)   │ (variable)  │ (variable)   │
└─────────────────┴──────────────┴─────────────┴──────────────┘
```

## 🧪 Testing

### Manual Testing
1. **File Encryption**: Test with various file types and sizes
2. **Key Management**: Verify key generation, import, and export
3. **Google Drive**: Test cloud sync and authentication
4. **Entropy Analysis**: Verify cryptographic quality assessment
5. **Cross-Platform**: Test on different operating systems

### Automated Testing
```bash
# Run unit tests (when available)
npm test

# Run integration tests
npm run test:integration

# Run security audit
npm audit
```

## 🐛 Troubleshooting

### Common Issues

#### "Encryption key not found"
- **Solution**: Generate a new key or import an existing one
- **Prevention**: Always create a key before encrypting files

#### "Google Drive connection failed"
- **Solution**: Check your internet connection and API credentials
- **Prevention**: Ensure `.env` file has correct Google API credentials

#### "Decryption failed"
- **Solution**: Verify you're using the correct key
- **Prevention**: Keep secure backups of your encryption keys

#### "File not found" during download
- **Solution**: Check if the encrypted file still exists
- **Prevention**: Avoid manually deleting encrypted files

### Debug Mode
Enable debug mode for detailed logging:
```bash
DEBUG=* npm start
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure security best practices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Electron Team** - For the amazing cross-platform framework
- **Node.js Crypto Team** - For robust cryptographic primitives
- **Google** - For the Drive API and OAuth infrastructure
- **Tailwind CSS** - For the beautiful utility-first CSS framework
- **Open Source Community** - For the countless libraries and tools

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/seamless-encryptor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/seamless-encryptor/discussions)
- **Email**: support@seamlessencryptor.com

## 🔮 Roadmap

### Upcoming Features
- [ ] **Multi-language Support** - Internationalization
- [ ] **Plugin System** - Extensible architecture
- [ ] **Command Line Interface** - Headless operation
- [ ] **Additional Cloud Providers** - Dropbox, OneDrive support
- [ ] **File Compression** - Built-in compression before encryption
- [ ] **Secure Messaging** - Encrypted communication features
- [ ] **Mobile Apps** - iOS and Android companions

### Performance Improvements
- [ ] **Streaming Encryption** - Handle large files efficiently
- [ ] **Multi-threading** - Parallel processing
- [ ] **Memory Optimization** - Reduced memory footprint
- [ ] **Caching System** - Improved performance

---

<div align="center">

**Made with ❤️ by the Seamless Encryptor Team**

[⭐ Star this repo](https://github.com/yourusername/seamless-encryptor) | [🐛 Report Bug](https://github.com/yourusername/seamless-encryptor/issues) | [💡 Request Feature](https://github.com/yourusername/seamless-encryptor/issues)

</div> 