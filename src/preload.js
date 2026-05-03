const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('personnelApi', {
  getAll: () => ipcRenderer.invoke('personnel:getAll'),
  save: (record) => ipcRenderer.invoke('personnel:save', record),
  delete: (id, version) => ipcRenderer.invoke('personnel:delete', id, version),
  getHistory: (id) => ipcRenderer.invoke('personnel:getHistory', id),
});

contextBridge.exposeInMainWorld('authApi', {
  login: (username, password) => ipcRenderer.invoke('auth:login', { username: username, password: password }),
  getSession: () => ipcRenderer.invoke('auth:session'),
  logout: () => ipcRenderer.invoke('auth:logout'),
});

contextBridge.exposeInMainWorld('adminApi', {
  getRoles: () => ipcRenderer.invoke('admin:roles'),
  createUser: (payload) => ipcRenderer.invoke('admin:createUser', payload),
  listUsers: () => ipcRenderer.invoke('admin:listUsers'),
  updateUserRole: (userId, roleName) => ipcRenderer.invoke('admin:updateUserRole', { userId, roleName }),
  deleteUser: (userId) => ipcRenderer.invoke('admin:deleteUser', { userId }),
  getAuditLogs: () => ipcRenderer.invoke('admin:auditLogs'),
});

contextBridge.exposeInMainWorld('exportApi', {
  savePhsPdf: (payload) => ipcRenderer.invoke('export:phsPdf', payload),
  savePhsWord: (payload) => ipcRenderer.invoke('export:phsWord', payload),
});

contextBridge.exposeInMainWorld('updateApi', {
  onUpdateAvailable: (cb) => {
    ipcRenderer.on('update:available', (evt, info) => { try { cb(info); } catch (_) {} });
  },
  onUpdateNotAvailable: (cb) => {
    ipcRenderer.on('update:not-available', (evt, info) => { try { cb(info); } catch (_) {} });
  },
  onUpdateError: (cb) => {
    ipcRenderer.on('update:error', (evt, payload) => { try { cb(payload); } catch (_) {} });
  },
  onDownloadProgress: (cb) => {
    ipcRenderer.on('update:progress', (evt, progress) => { try { cb(progress); } catch (_) {} });
  },
  onUpdateDownloaded: (cb) => {
    ipcRenderer.on('update:downloaded', (evt, info) => { try { cb(info); } catch (_) {} });
  },
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  checkForUpdates: () => ipcRenderer.invoke('update:check')
});
