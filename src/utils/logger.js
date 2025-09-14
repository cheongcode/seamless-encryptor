const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor() {
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
      TRACE: 4
    };
    
    this.currentLevel = process.env.NODE_ENV === 'development' ? this.logLevels.DEBUG : this.logLevels.INFO;
    this.logDir = null;
    this.logFile = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    
    try {
      if (app) {
        this.logDir = path.join(app.getPath('userData'), 'logs');
        if (!fs.existsSync(this.logDir)) {
          fs.mkdirSync(this.logDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().split('T')[0];
        this.logFile = path.join(this.logDir, `seamless-encryptor-${timestamp}.log`);
      }
      this.initialized = true;
      this.info('Logger', 'Logging system initialized', { logFile: this.logFile });
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  formatMessage(level, context, message, data = null) {
    const timestamp = new Date().toISOString();
    const baseMsg = `[${timestamp}] [${level}] [${context}] ${message}`;
    
    if (data) {
      return `${baseMsg} ${JSON.stringify(data, null, 2)}`;
    }
    return baseMsg;
  }

  writeToFile(formattedMessage) {
    if (!this.logFile) return;
    
    try {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(level, context, message, data = null) {
    if (!this.initialized) this.initialize();
    
    const levelValue = this.logLevels[level];
    if (levelValue > this.currentLevel) return;

    const formattedMessage = this.formatMessage(level, context, message, data);
    
    switch (level) {
      case 'ERROR':
        console.error(`\x1b[31m${formattedMessage}\x1b[0m`);
        break;
      case 'WARN':
        console.warn(`\x1b[33m${formattedMessage}\x1b[0m`);
        break;
      case 'INFO':
        console.info(`\x1b[36m${formattedMessage}\x1b[0m`);
        break;
      case 'DEBUG':
        console.log(`\x1b[35m${formattedMessage}\x1b[0m`);
        break;
      case 'TRACE':
        console.log(`\x1b[37m${formattedMessage}\x1b[0m`);
        break;
      default:
        console.log(formattedMessage);
    }

    this.writeToFile(formattedMessage);
  }

  error(context, message, data = null) {
    this.log('ERROR', context, message, data);
  }

  warn(context, message, data = null) {
    this.log('WARN', context, message, data);
  }

  info(context, message, data = null) {
    this.log('INFO', context, message, data);
  }

  debug(context, message, data = null) {
    this.log('DEBUG', context, message, data);
  }

  trace(context, message, data = null) {
    this.log('TRACE', context, message, data);
  }

  startTimer(context, operation) {
    const timerKey = `${context}:${operation}`;
    this.debug(context, `Starting operation: ${operation}`);
    return {
      end: () => {
        this.debug(context, `Completed operation: ${operation}`);
      }
    };
  }

  wrapFunction(context, fn, functionName) {
    return async (...args) => {
      const timer = this.startTimer(context, functionName);
      try {
        this.trace(context, `Calling ${functionName}`, { args: args.length });
        const result = await fn(...args);
        this.trace(context, `${functionName} completed successfully`);
        timer.end();
        return result;
      } catch (error) {
        this.error(context, `${functionName} failed`, { error: error.message, stack: error.stack });
        timer.end();
        throw error;
      }
    };
  }

  cleanupOldLogs() {
    if (!this.logDir) return;
    
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      
      files.forEach(file => {
        if (file.startsWith('seamless-encryptor-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            this.info('Logger', `Cleaned up old log file: ${file}`);
          }
        }
      });
    } catch (error) {
      this.error('Logger', 'Failed to cleanup old logs', { error: error.message });
    }
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
