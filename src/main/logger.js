const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'api-server.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create log directory:', e.message);
  }
}

function ensureLogRotation() {
  try {
    const stats = fs.statSync(LOG_FILE);
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (stats.size > maxSize) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveName = path.join(LOG_DIR, `api-server-${timestamp}.log.gz`);
      const { execSync } = require('child_process');
      try {
        execSync(`gzip -c "${LOG_FILE}" > "${archiveName}"`);
        fs.truncateSync(LOG_FILE, 0);
      } catch (_) {
        // If gzip fails, just truncate
        fs.truncateSync(LOG_FILE, 0);
      }
    }
  } catch (_) {
    // Ignore errors (file might not exist yet)
  }
}

function formatLog(level, message, metadata) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(metadata && typeof metadata === 'object' ? metadata : {})
  };
  return JSON.stringify(logEntry);
}

function writeLog(level, message, metadata) {
  try {
    ensureLogRotation();
    const logEntry = formatLog(level, message, metadata);
    fs.appendFileSync(LOG_FILE, logEntry + '\n', 'utf8');
    // Also log to console
    console.log(`[${level}]`, message, metadata ? metadata : '');
  } catch (e) {
    console.error('Failed to write log:', e.message);
  }
}

module.exports = {
  info: (msg, meta) => writeLog('INFO', msg, meta),
  warn: (msg, meta) => writeLog('WARN', msg, meta),
  error: (msg, meta) => writeLog('ERROR', msg, meta),
  debug: (msg, meta) => writeLog('DEBUG', msg, meta),
  http: (method, path, status, duration, meta) => 
    writeLog('HTTP', `${method} ${path}`, { status, duration_ms: duration, ...meta })
};
