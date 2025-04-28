# Seamless Encryptor

A modern, secure file encryption application built with Electron and TailwindCSS.

## Features

- **Strong Encryption**: Secure your files with AES-256-GCM, ChaCha20-Poly1305, or XChaCha20-Poly1305 encryption
- **Beautiful UI**: Modern glassmorphism interface with a dark neon aesthetic
- **Intuitive Workflow**: Simple drag-and-drop or file selection interface
- **Progress Feedback**: Real-time encryption/decryption progress tracking
- **Key Management**: Create and manage encryption keys
- **Fully Responsive**: Works on any screen size

## Screenshots

(Screenshots will be added here)

## Recent Updates

This application has been recently improved with the following changes:

- **Consolidated Code**: Eliminated redundant files by combining functionality:
  - Merged multiple preload scripts into a single, comprehensive preload.js
  - Combined renderer-basic.js and renderer.js into a unified renderer
  - Enhanced error handling and logging throughout
- **Improved UI Components**: Better responsiveness and user feedback
- **Enhanced Drag & Drop**: More intuitive file handling
- **Unified Key Management**: Streamlined key generation and handling
- **Better Error Handling**: More descriptive error messages and recovery

## Development and Troubleshooting

### Running the Application

The application can be started in several ways:

- **Standard Start**: `npm run start` - Basic startup
- **Complete Build and Start**: `npm run start:full` - Build Tailwind CSS, webpack, then start
- **Windows Optimized Start**: `npm run start:win` - Parallel build and start for Windows
- **Development Mode**: `npm run dev` - Start with hot reloading and file watching

### Prerequisites

- Node.js (v14 or later)
- npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/seamless-encryptor.git
cd seamless-encryptor
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

This will:
- Start the Electron application
- Watch for changes in the source files
- Compile TailwindCSS on changes
- Hot-reload on file changes

### Building

To build the application for production:

```bash
npm run build
```

This creates distributables in the `dist` directory.

## Project Structure

```
seamless-encryptor/
├── src/                  # Source code
│   ├── crypto/           # Encryption implementation
│   ├── preload/          # Preload scripts for IPC
│   ├── renderer/         # UI components and logic
│   ├── main/             # Main process code
│   └── config/           # Application configuration
├── dist/                 # Build outputs
└── .webpack/             # Webpack temporary files
```

## How It Works

Seamless Encryptor uses a secure encryption pipeline:

1. **File Selection**: Select files to encrypt via the UI
2. **Key Generation**: A secure encryption key is used (generated if needed)
3. **Encryption**: Files are encrypted using the selected algorithm
4. **Storage**: Encrypted files are stored locally with metadata
5. **Decryption**: Files can be decrypted with the same key

## Security Notes

- All encryption is performed locally on your device
- No data is sent to external servers
- Keys are stored securely in your system's keychain when available
- Always back up your encryption keys - if you lose them, your files cannot be recovered

## License

MIT

## Contributors

- YourUsername - Initial work 