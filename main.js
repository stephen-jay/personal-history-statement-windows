const electron = require('electron');
if (!electron || typeof electron === 'string' || !electron.app) {
  console.error('This app must be started with Electron. Use "npm start" or run the built .exe.');
  process.exit(1);
}
const { app, BrowserWindow, ipcMain, dialog } = electron;
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const dotenv = require('dotenv');
const { autoUpdater } = require('electron-updater');

// --- Internal Modules ---
const { initDatabase } = require('./src/main/database');
const { registerExportHandlers } = require('./src/main/export');
const auth = require('./src/main/auth');
const { registerIpcHandlers } = require('./src/main/ipc');
const dbSync = require('./src/main/db-sync');

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
  DATABASE_URL: process.env.DATABASE_URL || '',
  USE_POSTGRES_READ: /^(1|true|yes)$/i.test(String(process.env.USE_POSTGRES_READ || 'true')),
  USE_POSTGRES_WRITE: /^(1|true|yes)$/i.test(String(process.env.USE_POSTGRES_WRITE || 'true')),
  ENABLE_DUAL_WRITE: /^(1|true|yes)$/i.test(String(process.env.ENABLE_DUAL_WRITE || 'true')),
  USE_REMOTE_API: /^(1|true|yes)$/i.test(String(process.env.USE_REMOTE_API || 'false')),
  REMOTE_API_BASE: String(process.env.REMOTE_API_BASE || 'http://localhost:3210'),
  IMAGE_UPLOAD_DIR: path.join(app.getPath('userData'), 'personnel-images')
};

if (!fs.existsSync(config.IMAGE_UPLOAD_DIR)) {
  fs.mkdirSync(config.IMAGE_UPLOAD_DIR, { recursive: true });
}

initDatabase(config.DATABASE_URL, path.join(app.getPath('userData'), 'personnel-data.json'));
auth.initAuth(app.getPath('userData'));
auth.loadAuthSessionFromDisk();
registerIpcHandlers(ipcMain, app, config);

// Start periodic primary→Supabase sync. Only fires when the primary tier
// is actively reachable, so Supabase keeps a recent mirror without slowing
// down user writes.
if (process.env.SUPABASE_DB_URL) {
  dbSync.startPeriodicSync();
}

// --- Electron Window Management ---
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-accelerated-video-encode');
app.commandLine.appendSwitch('disable-features', 'GPU,DirectComposition,DirectCompositionVideoOverlays');
app.commandLine.appendSwitch('disable-direct-composition');
app.commandLine.appendSwitch('disable-direct-composition-video-overlays');

let mainWindow;
let rfidWatcherProcess = null;

function forwardCardDetected(cardUID) {
  if (!mainWindow || !mainWindow.webContents) return;
  try {
    mainWindow.webContents.send('card-detected', cardUID);
  } catch (_) {}
}

app.on('card-detected', function (evtOrUid, maybeCardUID) {
  const cardUID = maybeCardUID != null ? maybeCardUID : evtOrUid;
  forwardCardDetected(cardUID);
});

function resolveRfidWatcherScriptPath() {
  const candidates = [
    process.env.RFID_WATCHER_PATH,
    path.join(process.cwd(), 'RFID', 'card_watcher.py'),
    path.join(__dirname, 'RFID', 'card_watcher.py'),
    path.join(process.resourcesPath || '', 'RFID', 'card_watcher.py'),
    path.join(process.cwd(), 'RFID', 'card_system.py'),
    path.join(__dirname, 'RFID', 'card_system.py'),
    path.join(process.resourcesPath || '', 'RFID', 'card_system.py')
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }
  return null;
}

function startRfidWatcher() {
  if (rfidWatcherProcess) return;
  const scriptPath = resolveRfidWatcherScriptPath();
  if (!scriptPath) {
    console.warn('[RFID] watcher script not found; card detection will remain idle.');
    return;
  }

  const pythonBin = String(process.env.PYTHON_BIN || process.env.PYTHON || 'python').trim() || 'python';
  try {
    rfidWatcherProcess = spawn(pythonBin, ['-u', scriptPath, 'watch'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
  } catch (e) {
    console.error('[RFID] failed to start watcher:', e && e.message ? e.message : e);
    rfidWatcherProcess = null;
    return;
  }

  let stdoutBuffer = '';
  rfidWatcherProcess.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString('utf8');
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || '';
    lines.forEach((line) => {
      const text = String(line || '').trim();
      if (!text) return;
      if (text.startsWith('CARD_DETECTED ')) {
        const payloadText = text.slice('CARD_DETECTED '.length).trim();
        try {
          const payload = JSON.parse(payloadText);
          if (payload && (payload.card_id || payload.cardUID || payload.cardUid)) {
            forwardCardDetected(payload);
          }
        } catch (e) {
          console.warn('[RFID] could not parse card payload:', e && e.message ? e.message : e);
        }
        return;
      }
      if (text.startsWith('RFID_STATUS ')) {
        const statusText = text.slice('RFID_STATUS '.length).trim();
        console.log('[RFID]', text);
        try {
          if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('card-status', { kind: 'status', message: statusText });
        } catch (_) {}
        return;
      }
      if (text.startsWith('RFID_ERROR ')) {
        const statusText = text.slice('RFID_ERROR '.length).trim();
        console.log('[RFID]', text);
        try {
          if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('card-status', { kind: 'error', message: statusText });
        } catch (_) {}
        return;
      }
      console.log('[RFID]', text);
    });
  });

  rfidWatcherProcess.stderr.on('data', (chunk) => {
    const text = String(chunk || '').trim();
    if (text) console.error('[RFID]', text);
  });

  rfidWatcherProcess.on('exit', (code, signal) => {
    console.warn('[RFID] watcher exited:', code, signal || '');
    rfidWatcherProcess = null;
  });
}

function stopRfidWatcher() {
  if (!rfidWatcherProcess) return;
  try {
    rfidWatcherProcess.kill();
  } catch (_) {}
  rfidWatcherProcess = null;
}

// Allow renderer to query whether the RFID watcher process is running
try {
  const { ipcMain } = require('electron');
  ipcMain.handle && ipcMain.handle('rfid:status', async () => {
    return { watcherRunning: !!rfidWatcherProcess };
  });
} catch (_) {}

function setupAutoUpdates() {
  // IPC handlers for renderer-initiated actions (always register to avoid errors in dev)
  ipcMain.handle('update:download', async () => {
    try { if (!app.isPackaged) return { ok: false, error: 'Not available in development' }; await autoUpdater.downloadUpdate(); return { ok: true }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  });
  ipcMain.handle('update:install', async () => {
    try { if (!app.isPackaged) return { ok: false, error: 'Not available in development' }; autoUpdater.quitAndInstall(); return { ok: true }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  });
  ipcMain.handle('update:check', async () => {
    try { if (!app.isPackaged) return { ok: false, error: 'Not available in development' }; await autoUpdater.checkForUpdates(); return { ok: true }; } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e) }; }
  });

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

  // Show a native confirm dialog if the renderer's beforeunload blocks navigation.
  // This fires when the provisioning wizard is open and the user tries to reload.
  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Leave', 'Stay'],
      defaultId: 1,
      cancelId: 1,
      title: 'Provisioning Incomplete',
      message: 'Provisioning is not complete.',
      detail: 'If you reload now, credentials will not be set up for this personnel.\n\nAre you sure you want to leave?',
    });
    if (choice === 0) {
      // "Leave" — allow the reload by preventing the prevention
      event.preventDefault();
    }
    // "Stay" (choice === 1) — do nothing; unload stays blocked
  });

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
  startRfidWatcher();
});

app.on('window-all-closed', () => {
  stopRfidWatcher();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  stopRfidWatcher();
  try { dbSync.stopPeriodicSync(); } catch (_) {}
});
