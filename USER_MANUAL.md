# Seamless Encryptor - User Manual

## Overview
Seamless Encryptor is a secure file encryption application that lets you protect your sensitive files with strong encryption algorithms.

## Key Management

### Creating a Key
1. Navigate to the Key Management section
2. Click "Generate Key" to create a new encryption key
3. Your new key will be displayed with its ID and creation date

### Importing a Key
1. In the Key Management section, click "Import Key"
2. Select your key file when prompted
3. The application will import and activate the key

### Creating a Custom Key
1. In the Key Management section, click "Create Custom Key"
2. Follow the prompts to create a key with your specific parameters

## File Encryption

### Encrypting Files
1. Ensure you have an active key (check the key status indicator)
2. Select your encryption method from the dropdown menu
3. Drag and drop files onto the application window or click "Browse Files"
4. The application will encrypt your files and display a success notification

### Viewing Encrypted Files
1. Navigate to the Encryption section
2. Your encrypted files will be displayed in the file list
3. Click on a file to view details or perform operations

### Encryption Quality Assessment
1. After encrypting files, each file in the list displays an entropy bar
2. The entropy bar shows the quality of encryption:
   - Green: High entropy (excellent encryption quality)
   - Yellow/Orange: Medium entropy (acceptable encryption quality)
   - Red: Low entropy (poor encryption quality)
3. Hover over the entropy bar to see the exact percentage
4. Higher entropy values (closer to 100%) indicate better encryption quality

## Additional Features

### Encryption Methods
- Choose from multiple encryption algorithms including AES-256-GCM and ChaCha20-Poly1305
- Change the encryption method at any time through the dropdown menu

### File Operations
- Drag and drop support for easy file encryption
- Progress indicators during multi-file encryption
- Status notifications for all operations

### Security Features
- Key status indicators show when you have an active key
- Warnings appear when attempting to encrypt without a key
- Secure key generation and management
- Entropy analysis helps verify the quality of encryption

## Troubleshooting
- If encryption fails, check your key status
- Use the built-in error notifications to identify issues
- For persistent problems, use the browser console with `window.seamlessDebug` tools:
  - `window.seamlessDebug.checkAPI()` - Verify API availability
  - `window.seamlessDebug.testKeyStatus()` - Test key status functionality
  - `window.seamlessDebug.inspectElements()` - Check UI elements 