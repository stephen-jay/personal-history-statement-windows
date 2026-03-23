const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { buildPhsDocxBuffer } = require('./src/build-phs-docx');

// Force software rendering — must be before app is ready (fixes "failed to create shared context")
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-accelerated-video-encode');
app.commandLine.appendSwitch('disable-features', 'GPU');

let mainWindow;
const DATA_FILE = path.join(app.getPath('userData'), 'personnel-data.json');
const SAMPLE_DATA_PATH = path.join(__dirname, 'data', 'sample-personnel.json');
const REMOVED_FIELDS = new Set(['brOfSvc']);

function sampleSeedMarkerPath() {
  return path.join(app.getPath('userData'), '.sample-personnel-seeded');
}

function loadSeedRecords() {
  try {
    const raw = fs.readFileSync(SAMPLE_DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    var now = new Date().toISOString();
    return parsed.map(function (r) {
      return Object.assign({}, r, { updatedAt: r.updatedAt || now });
    });
  } catch (e) {
    console.warn('Could not load data/sample-personnel.json:', e.message);
    return [];
  }
}

function writeSeedData() {
  var seed = loadSeedRecords();
  fs.writeFileSync(DATA_FILE, JSON.stringify(seed.length ? seed : [], null, 2), 'utf8');
  if (seed.length) fs.writeFileSync(sampleSeedMarkerPath(), 'v1', 'utf8');
}

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      writeSeedData();
      return true;
    }
    var raw = fs.readFileSync(DATA_FILE, 'utf8');
    var arr = [];
    try {
      arr = JSON.parse(raw);
    } catch (_) {
      arr = [];
    }
    if (Array.isArray(arr) && arr.length === 0 && !fs.existsSync(sampleSeedMarkerPath())) {
      var seed = loadSeedRecords();
      if (seed.length) writeSeedData();
    }
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function getData() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveData(records) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf8');
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
    icon: require('fs').existsSync(path.join(__dirname, 'assets', 'icon.png'))
      ? path.join(__dirname, 'assets', 'icon.png')
      : undefined,
  });

  const indexPath = path.join(__dirname, 'src', 'ui', 'index.html');
  mainWindow.loadURL(pathToFileURL(indexPath).href);
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.setTitle('Personnel Database');
  // Open DevTools so you can see any errors (Console tab)
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

ipcMain.handle('personnel:getAll', () => getData());

ipcMain.handle('personnel:save', (_, record) => {
  const records = getData();
  const id = record.id || String(Date.now());
  const existing = records.findIndex((r) => r.id === id);
  const sanitizedRecord = Object.fromEntries(
    Object.entries(record || {}).filter(([key]) => !REMOVED_FIELDS.has(key))
  );
  const toSave = { ...sanitizedRecord, id, updatedAt: new Date().toISOString() };
  if (existing >= 0) {
    records[existing] = toSave;
  } else {
    records.push(toSave);
  }
  saveData(records);
  return toSave;
});

ipcMain.handle('personnel:delete', (_, id) => {
  const records = getData().filter((r) => r.id !== id);
  saveData(records);
  return true;
});

async function writePhsPdfFromHtml(parentWindow, html, defaultName) {
  const tmp = path.join(
    os.tmpdir(),
    'phs-export-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + '.html'
  );
  fs.writeFileSync(tmp, html, 'utf8');
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  try {
    await win.loadFile(tmp);
    await new Promise(function (resolve) {
      setTimeout(resolve, 450);
    });
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'Letter',
      marginsType: 0,
    });
    win.destroy();
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
    const { canceled, filePath } = await dialog.showSaveDialog(parentWindow || undefined, {
      title: 'Save PDF',
      defaultPath: path.join(app.getPath('documents'), defaultName || 'Personnel-History-Statement.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { ok: false };
    fs.writeFileSync(filePath, pdfBuffer);
    return { ok: true, filePath };
  } catch (err) {
    try {
      win.destroy();
    } catch (_) {}
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
    throw err;
  }
}

ipcMain.handle('export:phsPdf', async function (event, payload) {
  var html = payload && payload.html;
  var defaultName = (payload && payload.defaultName) || 'Personnel-History-Statement.pdf';
  if (!html || typeof html !== 'string') return { ok: false, error: 'Missing HTML' };
  var parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  return writePhsPdfFromHtml(parent, html, defaultName);
});

ipcMain.handle('export:phsWord', async function (event, payload) {
  var html = payload && payload.html;
  var defaultName = (payload && payload.defaultName) || 'Personnel-History-Statement.doc';
  if (!html || typeof html !== 'string') return { ok: false, error: 'Missing HTML' };
  var parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  var result = await dialog.showSaveDialog(parent || undefined, {
    title: 'Save for Microsoft Word',
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: [
      { name: 'Word document', extensions: ['doc'] },
      { name: 'Web page', extensions: ['html'] },
    ],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  var bom = '\ufeff';
  fs.writeFileSync(result.filePath, bom + html, 'utf8');
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle('export:phsDocx', async function (event, payload) {
  var record = payload && payload.record;
  var defaultName = (payload && payload.defaultName) || 'Personnel-History-Statement.docx';
  if (!record || typeof record !== 'object') return { ok: false, error: 'Missing record' };
  var parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  try {
    var buf = await buildPhsDocxBuffer(record);
    var result = await dialog.showSaveDialog(parent || undefined, {
      title: 'Save Word document',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'Word Document', extensions: ['docx'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    fs.writeFileSync(result.filePath, buf);
    return { ok: true, filePath: result.filePath };
  } catch (err) {
    console.error('export:phsDocx', err);
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

