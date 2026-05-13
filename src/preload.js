const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('personnelApi', {
  getAll: () => ipcRenderer.invoke('personnel:getAll'),
  save: (record) => ipcRenderer.invoke('personnel:save', record),
  delete: (id, version) => ipcRenderer.invoke('personnel:delete', id, version),
  getHistory: (id) => ipcRenderer.invoke('personnel:getHistory', id),
});

contextBridge.exposeInMainWorld('authApi', {
  login: (username, password) => ipcRenderer.invoke('auth:login', { username: username, password: password }),
  beginLogin: (username) => ipcRenderer.invoke('auth:beginLogin', { username }),
  verifyCardStep: (challengeId, cardUid) => ipcRenderer.invoke('auth:verifyCard', { challengeId, cardUid }),
  enrollTotp: (challengeId) => ipcRenderer.invoke('auth:enrollTotp', { challengeId }),
  verifyTotp: (challengeId, token) => ipcRenderer.invoke('auth:verifyTotp', { challengeId, token }),
  getSession: () => ipcRenderer.invoke('auth:session'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  changePassword: (currentPassword, newPassword) =>
    ipcRenderer.invoke('auth:changePassword', { currentPassword, newPassword }),
  createUser: (payload) => ipcRenderer.invoke('admin:createUser', payload),
  enrollTotpForUser: (userId) => ipcRenderer.invoke('admin:enrollTotpForUser', { userId }),
  verifyTotpForUser: (userId, token) => ipcRenderer.invoke('admin:verifyTotpForUser', { userId, token }),
});

contextBridge.exposeInMainWorld('adminApi', {
  getRoles: () => ipcRenderer.invoke('admin:roles'),
  createUser: (payload) => ipcRenderer.invoke('admin:createUser', payload),
  listUsers: () => ipcRenderer.invoke('admin:listUsers'),
  updateUserRole: (userId, roleName) => ipcRenderer.invoke('admin:updateUserRole', { userId, roleName }),
  deleteUser: (userId) => ipcRenderer.invoke('admin:deleteUser', { userId }),
  getAuditLogs: () => ipcRenderer.invoke('admin:auditLogs'),
  resetTotp: (targetUserId) => ipcRenderer.invoke('auth:adminResetTotp', { targetUserId }),
});

contextBridge.exposeInMainWorld('exportApi', {
  savePhsPdf: (payload) => ipcRenderer.invoke('export:phsPdf', payload),
  savePhsWord: (payload) => ipcRenderer.invoke('export:phsWord', payload),
});

contextBridge.exposeInMainWorld('cardApi', {
  onCardDetected: (cb) => {
    ipcRenderer.on('card-detected', (evt, cardUID) => {
      try { cb(cardUID); } catch (_) {}
    });
  },
  onCardStatus: (cb) => {
    ipcRenderer.on('card-status', (evt, payload) => {
      try { cb(payload); } catch (_) {}
    });
  }
  ,getStatus: () => ipcRenderer.invoke('rfid:status')
});

contextBridge.exposeInMainWorld('cardManagementApi', {
  listCards: () => ipcRenderer.invoke('cards:list'),
  getCards: () => ipcRenderer.invoke('cards:list'),
  dbStatus: () => ipcRenderer.invoke('db:status'),
  lookupCard: (payload) => ipcRenderer.invoke('cards:lookup', payload),
  loginLookupCard: (payload) => ipcRenderer.invoke('cards:loginLookup', payload),
  registerCard: (payload) => ipcRenderer.invoke('cards:register', payload),
  assignCard: (payload) => {
    const body = payload || {};
    return ipcRenderer.invoke('cards:assign', {
      card_uid: body.card_uid || body.cardId,
      personnel_id: body.personnel_id || body.personnelId,
      assigned_username: body.assigned_username || body.username,
    });
  },
  unassignCard: (payload) => ipcRenderer.invoke('cards:unassign', payload),
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

// Expose app-level info (version)
contextBridge.exposeInMainWorld('appApi', {
  getVersion: async () => {
    try {
      const res = await ipcRenderer.invoke('app:version');
      return res && res.version ? String(res.version) : null;
    } catch (e) {
      return null;
    }
  }
});
