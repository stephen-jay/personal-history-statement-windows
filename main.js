const electron = require('electron');
if (!electron || typeof electron === 'string' || !electron.app) {
  console.error('This app must be started with Electron. Use "npm start" or run the built .exe.');
  process.exit(1);
}
const { app, BrowserWindow, ipcMain } = electron;
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const dotenv = require('dotenv');
const { autoUpdater } = require('electron-updater');

// --- Internal Modules ---
const { initDatabase } = require('./src/main/database');
const { registerExportHandlers } = require('./src/main/export');
const auth = require('./src/main/auth');
const { registerIpcHandlers } = require('./src/main/ipc');

// --- Configuration Setup ---
dotenv.config({ override: true });

const CONFIG_KEYS = new Set([
  'DATABASE_URL',
  'USE_REMOTE_API',
  'REMOTE_API_BASE',
  'USE_POSTGRES_READ',
  'USE_POSTGRES_WRITE',
  'ENABLE_DUAL_WRITE',
]);

function applyConfigValues(values) {
  if (!values || typeof values !== 'object') return;
  Object.keys(values).forEach(key => {
    if (CONFIG_KEYS.has(key) && values[key] != null) {
      process.env[key] = String(values[key]);
    }
  });
}

function loadConfigFromFile(configPath, loader) {
  try {
    if (!fs.existsSync(configPath)) return;
    const raw = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
    applyConfigValues(loader(raw));
  } catch (e) {
    console.warn('Could not load config file:', configPath, e.message);
  }
}

function loadExternalConfig() {
  const dirs = [
    process.execPath ? path.dirname(process.execPath) : null,
    process.cwd(),
    __dirname,
    process.env.APPDATA ? path.join(process.env.APPDATA, 'APOLLO Personnel Database') : null,
    process.env.APPDATA ? path.join(process.env.APPDATA, 'apollo-personnel-db') : null
  ];
  try { dirs.push(app.getPath('userData')); } catch (_) {}
  
  const uniqueDirs = Array.from(new Set(dirs.filter(Boolean)));
  uniqueDirs.forEach(dir => {
    loadConfigFromFile(path.join(dir, 'app-config.json'), text => JSON.parse(text));
    loadConfigFromFile(path.join(dir, '.env.local'), text => dotenv.parse(text));
  });
}

loadExternalConfig();

// --- Initialization ---
const config = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://apollo_app:ApolloApp2026@10.10.218.144:5432/apollo_db',
  USE_POSTGRES_READ: /^(1|true|yes)$/i.test(String(process.env.USE_POSTGRES_READ || 'true')),
  USE_POSTGRES_WRITE: /^(1|true|yes)$/i.test(String(process.env.USE_POSTGRES_WRITE || 'true')),
  ENABLE_DUAL_WRITE: /^(1|true|yes)$/i.test(String(process.env.ENABLE_DUAL_WRITE || 'true')),
  USE_REMOTE_API: /^(1|true|yes)$/i.test(String(process.env.USE_REMOTE_API || 'false')),
  REMOTE_API_BASE: String(process.env.REMOTE_API_BASE || 'http://10.10.218.144:3210'),
  IMAGE_UPLOAD_DIR: path.join(app.getPath('userData'), 'personnel-images')
};

if (!fs.existsSync(config.IMAGE_UPLOAD_DIR)) {
  fs.mkdirSync(config.IMAGE_UPLOAD_DIR, { recursive: true });
}

initDatabase(config.DATABASE_URL, path.join(app.getPath('userData'), 'personnel-data.json'));
auth.initAuth(app.getPath('userData'));
auth.loadAuthSessionFromDisk();
registerIpcHandlers(ipcMain, app, config);

// --- Electron Window Management ---
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-accelerated-video-encode');
app.commandLine.appendSwitch('disable-features', 'GPU');

let mainWindow;

function setupAutoUpdates() {
  if (!app.isPackaged) return;

  console.log('[UPDATE] Auto-updater setup starting (packaged mode)');

  // Do not auto-download updates — user clicks "Update Now" to start.
  autoUpdater.autoDownload = false;
  autoUpdater.allowPrerelease = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', error => {
    const msg = error && error.message ? error.message : String(error);
    console.error('[UPDATE] Error:', msg);
    try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update:error', { message: msg }); } catch (_) {}
  });
  autoUpdater.on('update-available', info => {
    console.log('[UPDATE] Update available:', info && info.version ? info.version : '(unknown)');
    try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update:available', info); } catch (_) {}
  });
  autoUpdater.on('update-not-available', info => {
    console.log('[UPDATE] No update available. Current:', info && info.version ? info.version : '(unknown)');
    try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update:not-available', info); } catch (_) {}
  });
  autoUpdater.on('download-progress', progress => {
    console.log('[UPDATE] Download progress:', progress && progress.percent ? progress.percent + '%' : '(unknown)');
    try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update:progress', progress); } catch (_) {}
  });
  autoUpdater.on('update-downloaded', info => {
    console.log('[UPDATE] Update downloaded:', info && info.version ? info.version : '(unknown)');
    try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update:downloaded', info); } catch (_) {}
  });

  // Initial silent check for updates
  console.log('[UPDATE] Checking for updates...');
  autoUpdater.checkForUpdates().catch(error => {
    const msg = error && error.message ? error.message : String(error);
    console.error('[UPDATE] Check failed:', msg);
    try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update:error', { message: msg }); } catch (_) {}
  });

  // IPC handlers for renderer-initiated actions
  ipcMain.handle('update:download', async () => {
    try { await autoUpdater.downloadUpdate(); return { ok: true }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  });
  ipcMain.handle('update:install', async () => {
    try { autoUpdater.quitAndInstall(); return { ok: true }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  });
  ipcMain.handle('update:check', async () => {
    try { await autoUpdater.checkForUpdates(); return { ok: true }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: fs.existsSync(path.join(__dirname, 'assets', 'icon.ico'))
      ? path.join(__dirname, 'assets', 'icon.ico')
      : undefined,
  });

  const loginPath = path.join(__dirname, 'src', 'ui', 'login.html');
  mainWindow.loadURL(pathToFileURL(loginPath).href);
  mainWindow.maximize();
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.setTitle('Personnel Database');

  registerExportHandlers(ipcMain, () => mainWindow);

  // Expose app version to renderer on demand
  ipcMain.handle('app:version', async () => {
    try {
      let ver = null;
      try { ver = app.getVersion ? app.getVersion() : null; } catch (_) { ver = null; }
      if (!ver) {
        try { ver = require(path.join(__dirname, 'package.json')).version; } catch (_) { ver = ver || null; }
      }
      return { version: ver };
    } catch (e) {
      return { version: null };
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
