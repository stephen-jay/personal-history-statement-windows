const { BrowserWindow, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function writePhsPdfFromHtml(parentWindow, html, defaultName) {
  const FOLIO_PAGE_SIZE_MICRONS = {
    width: 215900, // 8.5 in
    height: 330200, // 13 in
  };
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
      pageSize: FOLIO_PAGE_SIZE_MICRONS,
      preferCSSPageSize: true,
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

function registerExportHandlers(ipcMain, getMainWindow) {
  ipcMain.handle('export:phsPdf', async function (event, payload) {
    var html = payload && payload.html;
    var defaultName = (payload && payload.defaultName) || 'Personnel-History-Statement.pdf';
    if (!html || typeof html !== 'string') return { ok: false, error: 'Missing HTML' };
    var parent = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
    return writePhsPdfFromHtml(parent, html, defaultName);
  });

  ipcMain.handle('export:phsWord', async function (event, payload) {
    var html = payload && payload.html;
    var defaultName = (payload && payload.defaultName) || 'Personnel-History-Statement.doc';
    if (!html || typeof html !== 'string') return { ok: false, error: 'Missing HTML' };
    var parent = BrowserWindow.fromWebContents(event.sender) || getMainWindow();
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
}

module.exports = {
  registerExportHandlers
};
