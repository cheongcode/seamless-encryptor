const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const logger = require('../utils/logger');

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.auth = null;
    this.isAuthenticated = false;
    this.credentials = null;
    this.redirectUri = null;
    this.appFolderName = 'Seamless Encryptor';
    this.appFolderId = null;
  }

  /**
   * Initialize Google Drive service with OAuth2 credentials
   * @param {Object} credentials - OAuth2 credentials from Google Cloud Console
   */
  async initialize(credentials) {
    try {
      logger.info('GoogleDrive', 'Initializing Google Drive service');
      
      this.credentials = credentials;
      this.redirectUri = credentials.redirect_uris[0];
      
      // Create OAuth2 client
      this.auth = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        this.redirectUri
      );

      // Try to load existing tokens
      await this.loadTokens();

      if (this.isAuthenticated) {
        this.drive = google.drive({ version: 'v3', auth: this.auth });
        await this.ensureAppFolder();
        logger.info('GoogleDrive', 'Google Drive service initialized successfully');
      }

      return this.isAuthenticated;
    } catch (error) {
      logger.error('GoogleDrive', 'Failed to initialize Google Drive service', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get OAuth2 authorization URL
   */
  getAuthUrl() {
    if (!this.auth) {
      throw new Error('Google Drive service not initialized');
    }

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ];

    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      redirect_uri: this.redirectUri
    });
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from OAuth2 callback
   */
  async authenticate(code) {
    try {
      logger.info('GoogleDrive', 'Exchanging authorization code for tokens');
      
      const { tokens } = await this.auth.getToken(code);
      this.auth.setCredentials(tokens);
      
      await this.saveTokens(tokens);
      
      this.isAuthenticated = true;
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      
      await this.ensureAppFolder();
      
      logger.info('GoogleDrive', 'Authentication successful');
      return true;
    } catch (error) {
      logger.error('GoogleDrive', 'Authentication failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Load stored tokens from file
   */
  async loadTokens() {
    try {
      const tokenPath = path.join(app.getPath('userData'), 'google-drive-tokens.json');
      
      if (!fs.existsSync(tokenPath)) {
        logger.debug('GoogleDrive', 'No stored tokens found');
        return false;
      }

      const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      this.auth.setCredentials(tokens);
      
      // Check if tokens are still valid
      try {
        await this.auth.getAccessToken();
        this.isAuthenticated = true;
        logger.info('GoogleDrive', 'Loaded and validated stored tokens');
        return true;
      } catch (error) {
        logger.warn('GoogleDrive', 'Stored tokens are invalid', { error: error.message });
        // Try to refresh if we have a refresh token
        if (tokens.refresh_token) {
          try {
            await this.auth.refreshAccessToken();
            const newTokens = this.auth.credentials;
            await this.saveTokens(newTokens);
            this.isAuthenticated = true;
            logger.info('GoogleDrive', 'Refreshed expired tokens');
            return true;
          } catch (refreshError) {
            logger.error('GoogleDrive', 'Failed to refresh tokens', { 
              error: refreshError.message 
            });
          }
        }
        return false;
      }
    } catch (error) {
      logger.error('GoogleDrive', 'Failed to load tokens', { error: error.message });
      return false;
    }
  }

  /**
   * Save tokens to file
   * @param {Object} tokens - OAuth2 tokens
   */
  async saveTokens(tokens) {
    try {
      const tokenPath = path.join(app.getPath('userData'), 'google-drive-tokens.json');
      fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
      logger.debug('GoogleDrive', 'Tokens saved successfully');
    } catch (error) {
      logger.error('GoogleDrive', 'Failed to save tokens', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure app folder exists in Google Drive
   */
  async ensureAppFolder() {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      // Search for existing app folder
      const response = await this.drive.files.list({
        q: `name='${this.appFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        spaces: 'drive'
      });

      if (response.data.files && response.data.files.length > 0) {
        this.appFolderId = response.data.files[0].id;
        logger.debug('GoogleDrive', 'Found existing app folder', { folderId: this.appFolderId });
      } else {
        // Create app folder
        const folderResponse = await this.drive.files.create({
          requestBody: {
            name: this.appFolderName,
            mimeType: 'application/vnd.google-apps.folder'
          }
        });
        
        this.appFolderId = folderResponse.data.id;
        logger.info('GoogleDrive', 'Created app folder', { folderId: this.appFolderId });
      }
    } catch (error) {
      logger.error('GoogleDrive', 'Failed to ensure app folder', { error: error.message });
      throw error;
    }
  }

  /**
   * Upload encrypted file to Google Drive
   * @param {string} filePath - Local file path
   * @param {string} fileName - Name for the file in Drive
   * @param {string} fileId - Unique file ID for organization
   */
  async uploadFile(filePath, fileName, fileId) {
    try {
      if (!this.isAuthenticated || !this.drive) {
        throw new Error('Google Drive not authenticated');
      }

      logger.info('GoogleDrive', 'Starting file upload', { fileName, fileId });

      const fileStats = fs.statSync(filePath);
      const fileStream = fs.createReadStream(filePath);

      const response = await this.drive.files.create({
        requestBody: {
          name: `${fileId}_${fileName}.enc`,
          parents: [this.appFolderId],
          description: `Encrypted file from Seamless Encryptor - Original: ${fileName}`
        },
        media: {
          mimeType: 'application/octet-stream',
          body: fileStream
        }
      });

      logger.info('GoogleDrive', 'File uploaded successfully', {
        fileName,
        fileId,
        driveFileId: response.data.id,
        size: fileStats.size
      });

      return {
        success: true,
        driveFileId: response.data.id,
        fileName: response.data.name,
        size: fileStats.size
      };
    } catch (error) {
      logger.error('GoogleDrive', 'File upload failed', {
        fileName,
        fileId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Download encrypted file from Google Drive
   * @param {string} driveFileId - Google Drive file ID
   * @param {string} localPath - Local path to save the file
   */
  async downloadFile(driveFileId, localPath) {
    try {
      if (!this.isAuthenticated || !this.drive) {
        throw new Error('Google Drive not authenticated');
      }

      logger.info('GoogleDrive', 'Starting file download', { driveFileId, localPath });

      const response = await this.drive.files.get({
        fileId: driveFileId,
        alt: 'media'
      }, { responseType: 'stream' });

      const writeStream = fs.createWriteStream(localPath);
      
      return new Promise((resolve, reject) => {
        response.data.pipe(writeStream);
        
        writeStream.on('finish', () => {
          logger.info('GoogleDrive', 'File downloaded successfully', { 
            driveFileId, 
            localPath 
          });
          resolve({ success: true, localPath });
        });

        writeStream.on('error', (error) => {
          logger.error('GoogleDrive', 'File download failed', {
            driveFileId,
            localPath,
            error: error.message
          });
          reject(error);
        });
      });
    } catch (error) {
      logger.error('GoogleDrive', 'File download failed', {
        driveFileId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * List encrypted files in Google Drive
   */
  async listFiles() {
    try {
      if (!this.isAuthenticated || !this.drive) {
        throw new Error('Google Drive not authenticated');
      }

      const response = await this.drive.files.list({
        q: `parents in '${this.appFolderId}' and trashed=false`,
        fields: 'files(id,name,size,createdTime,modifiedTime,description)',
        orderBy: 'modifiedTime desc'
      });

      const files = response.data.files || [];
      
      logger.debug('GoogleDrive', 'Listed files', { count: files.length });

      return files.map(file => ({
        driveFileId: file.id,
        name: file.name,
        size: parseInt(file.size) || 0,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        description: file.description || '',
        // Extract original filename and file ID from the name
        originalName: this.extractOriginalName(file.name),
        fileId: this.extractFileId(file.name)
      }));
    } catch (error) {
      logger.error('GoogleDrive', 'Failed to list files', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete file from Google Drive
   * @param {string} driveFileId - Google Drive file ID
   */
  async deleteFile(driveFileId) {
    try {
      if (!this.isAuthenticated || !this.drive) {
        throw new Error('Google Drive not authenticated');
      }

      logger.info('GoogleDrive', 'Deleting file', { driveFileId });

      await this.drive.files.delete({
        fileId: driveFileId
      });

      logger.info('GoogleDrive', 'File deleted successfully', { driveFileId });
      return { success: true };
    } catch (error) {
      logger.error('GoogleDrive', 'File deletion failed', {
        driveFileId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user info and storage quota
   */
  async getUserInfo() {
    try {
      if (!this.isAuthenticated || !this.drive) {
        throw new Error('Google Drive not authenticated');
      }

      const response = await this.drive.about.get({
        fields: 'user,storageQuota'
      });

      const user = response.data.user;
      const quota = response.data.storageQuota;

      return {
        user: {
          displayName: user.displayName,
          emailAddress: user.emailAddress,
          photoLink: user.photoLink
        },
        storage: {
          limit: parseInt(quota.limit) || 0,
          usage: parseInt(quota.usage) || 0,
          usageInDrive: parseInt(quota.usageInDrive) || 0
        }
      };
    } catch (error) {
      logger.error('GoogleDrive', 'Failed to get user info', { error: error.message });
      throw error;
    }
  }

  /**
   * Sign out and clear tokens
   */
  async signOut() {
    try {
      const tokenPath = path.join(app.getPath('userData'), 'google-drive-tokens.json');
      
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
      }

      this.auth = null;
      this.drive = null;
      this.isAuthenticated = false;
      this.appFolderId = null;

      logger.info('GoogleDrive', 'Signed out successfully');
      return true;
    } catch (error) {
      logger.error('GoogleDrive', 'Sign out failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract original filename from Drive filename
   * @param {string} driveFileName - Filename in Google Drive
   */
  extractOriginalName(driveFileName) {
    // Format: fileId_originalName.enc
    const match = driveFileName.match(/^[^_]+_(.+)\.enc$/);
    return match ? match[1] : driveFileName.replace('.enc', '');
  }

  /**
   * Extract file ID from Drive filename
   * @param {string} driveFileName - Filename in Google Drive
   */
  extractFileId(driveFileName) {
    // Format: fileId_originalName.enc
    const match = driveFileName.match(/^([^_]+)_/);
    return match ? match[1] : null;
  }

  /**
   * Check if service is authenticated
   */
  isConnected() {
    return this.isAuthenticated && this.drive !== null;
  }
}

module.exports = new GoogleDriveService();
