const fs = require('fs');
const path = require('path');
const os = require('os');

class LocalStorageService {
    constructor() {
        // Create a directory in the user's home folder for storing encrypted files
        this.storageDir = path.join(os.homedir(), '.seamless-encryptor', 'storage');
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }

    /**
     * Save a file locally
     * @param {string} key - File identifier
     * @param {Buffer} data - File data
     * @returns {Promise<string>} Local file path
     */
    async uploadFile(key, data) {
        const filePath = path.join(this.storageDir, key);
        await fs.promises.writeFile(filePath, data);
        return filePath;
    }

    /**
     * Read a file from local storage
     * @param {string} key - File identifier
     * @returns {Promise<Buffer>} File data
     */
    async downloadFile(key) {
        const filePath = path.join(this.storageDir, key);
        return fs.promises.readFile(filePath);
    }

    /**
     * Delete a file from local storage
     * @param {string} key - File identifier
     */
    async deleteFile(key) {
        const filePath = path.join(this.storageDir, key);
        await fs.promises.unlink(filePath);
    }
}

module.exports = new LocalStorageService(); 